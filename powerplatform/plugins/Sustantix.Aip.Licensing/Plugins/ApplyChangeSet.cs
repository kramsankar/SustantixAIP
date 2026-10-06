using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.ServiceModel;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Sustantix.Aip.Licensing.Core;

namespace Sustantix.Aip.Licensing.Plugins
{
    /// <summary>
    /// Custom API sus_ApplyChangeSet (input ChangeSetJson, output ResultJson): the Dataverse side of the phase 4 write
    /// path. The set is validated against the embedded change model, every update or delete is checked against the row
    /// version it was read at, and all operations run in this message's transaction with the caller's own security
    /// roles, so the set applies completely or not at all. A set already applied under the same id is replayed from
    /// sus_changeset instead of being applied twice. Refusals throw, rolling everything back; their message starts with
    /// "AIPCHANGESET " followed by the JSON the hosts map to an HTTP status (a conflict carries the current row).
    /// </summary>
    public sealed class ApplyChangeSet : IPlugin
    {
        public const string Prefix = "AIPCHANGESET ";
        private const int ConcurrencyVersionMismatch = unchecked((int)0x80060882);
        private const int DuplicateKey = unchecked((int)0x80060892);
        private const int NotFound = unchecked((int)0x80040217);
        private const int NoPrivilege = unchecked((int)0x80040220);

        private static readonly object Gate = new object();
        private static ChangeModel _model;

        private static ChangeModel Model
        {
            get
            {
                lock (Gate)
                {
                    if (_model != null) return _model;
                    using (var s = typeof(ApplyChangeSet).Assembly.GetManifestResourceStream("Sustantix.Aip.Licensing.change-model.json"))
                    using (var r = new StreamReader(s, Encoding.UTF8))
                        return _model = ChangeModel.Parse(r.ReadToEnd());
                }
            }
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var user = factory.CreateOrganizationService(context.UserId);
            var system = factory.CreateOrganizationService(null);


            var json = context.InputParameters.Contains("ChangeSetJson") ? context.InputParameters["ChangeSetJson"] as string : null;
            var model = Model;
            // {"probe":"role"} answers which AIP role the caller holds, so a grid offers only the edits it may make,
            if (json != null && json.Length < 64 && json.Replace(" ", "") == "{\"probe\":\"role\"}")
            {
                // ...and which screens this environment shows as Enterprise Grids (environment variable sus_GridScreens).
                var screens = new System.Text.StringBuilder();
                JsonValue.Quote(screens, LicenseRuntime.ReadEnvironmentVariable(system, "sus_GridScreens") ?? "");
                context.OutputParameters["ResultJson"] = "{\"role\":\"" + ChangeSetPlanner.RoleOf(RolesOf(system, context.InitiatingUserId)) + "\",\"gridScreens\":" + screens + "}";
                return;
            }
            var status = LicenseRuntime.Resolve(serviceProvider);
            if (status.Access != "full") Refuse("license_required", "Sustantix AIP is not licensed for changes in this environment (" + status.Reason + ")");
            ChangeSetPlan plan;
            try
            {
                plan = ChangeSetPlanner.Plan(json, model, ChangeSetPlanner.RoleOf(RolesOf(system, context.InitiatingUserId)));
            }
            catch (ChangeSetException e)
            {
                Refuse(e.Code, e.Message);
                return;
            }

            // Replay: a set already applied under this id returns its stored result.
            var prior = system.RetrieveMultiple(new QueryExpression(model.ChangeSetTable)
            {
                ColumnSet = new ColumnSet("sus_result", "createdby"),
                Criteria = { Conditions = { new ConditionExpression(model.Key, ConditionOperator.Equal, plan.Id.ToString()) } },
                TopCount = 1,
            }).Entities.FirstOrDefault();
            if (prior != null)
            {
                var by = prior.GetAttributeValue<EntityReference>("createdby");
                if (by != null && by.Id != context.InitiatingUserId) Refuse("duplicate", "change set " + plan.Id + " was already used");
                context.OutputParameters["ResultJson"] = Result(plan.Id, prior.GetAttributeValue<string>("sus_result") ?? "[]", true);
                return;
            }

            // Versions first, so a conflict is reported with the current row before anything is written.
            foreach (var op in plan.Ops.Where(o => o.Kind != OpKind.Create))
            {
                var current = Current(user, model, op);
                if (current == null) Refuse("not_found", op.Entity + " " + op.Code + " does not exist", op);
                var version = current.GetAttributeValue<long?>("versionnumber");
                if (version != op.RowVersion) Conflict(model, op, current, version);
            }

            var items = new List<JsonValue>();
            var index = 0;
            foreach (var op in plan.Ops)
            {
                index++;
                try
                {
                    Apply(user, model, op);
                }
                catch (FaultException<OrganizationServiceFault> f)
                {
                    trace?.Trace("change set {0} item {1} refused: {2} {3}", plan.Id, index, f.Detail.ErrorCode, f.Detail.Message);
                    if (f.Detail.ErrorCode == ConcurrencyVersionMismatch) Conflict(model, op, Current(system, model, op), null);
                    if (f.Detail.ErrorCode == DuplicateKey) Refuse("duplicate", "item " + index + ": " + op.Code + " already exists", op);
                    if (f.Detail.ErrorCode == NotFound) Refuse("unknown_reference", "item " + index + ": " + f.Detail.Message, op);
                    if (f.Detail.ErrorCode == NoPrivilege) Refuse("forbidden", "item " + index + ": your security roles do not allow this change", op);
                    Refuse("change_failed", "item " + index + ": " + f.Detail.Message, op);
                }
                items.Add(JsonValue.Obj(new Dictionary<string, JsonValue>
                {
                    { "entity", JsonValue.Str(op.Entity) },
                    { "op", JsonValue.Str(op.Kind == OpKind.Create ? "insert" : op.Kind == OpKind.Update ? "update" : "delete") },
                    { "code", JsonValue.Str(op.Code) },
                    { "rowVersion", JsonValue.Null },
                }));
            }

            var result = JsonValue.Arr(items).ToString();
            var log = new Entity(model.ChangeSetTable);
            log[model.Key] = plan.Id.ToString();
            log["sus_source"] = plan.Source;
            log["sus_itemcount"] = plan.Ops.Count;
            log["sus_result"] = result;
            user.Create(log);
            context.OutputParameters["ResultJson"] = Result(plan.Id, result, false);
        }

        private static void Apply(IOrganizationService svc, ChangeModel model, PlannedOp op)
        {
            if (op.Kind == OpKind.Delete)
            {
                svc.Execute(new DeleteRequest
                {
                    Target = new EntityReference(op.Table, model.Key, op.Key) { RowVersion = op.RowVersion.ToString() },
                    ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches,
                });
                return;
            }
            var entity = op.Kind == OpKind.Create ? new Entity(op.Table) : new Entity(op.Table, model.Key, op.Key) { RowVersion = op.RowVersion.ToString() };
            foreach (var kv in op.Attributes) Set(entity, kv.Key, kv.Value, model.Key);
            if (op.Kind == OpKind.Create) svc.Execute(new CreateRequest { Target = entity });
            else svc.Execute(new UpdateRequest { Target = entity, ConcurrencyBehavior = ConcurrencyBehavior.IfRowVersionMatches });
        }

        private static void Set(Entity entity, string attribute, object value, string key)
        {
            var lookup = value as LookupValue;
            var money = value as MoneyValue;
            var state = value as StateValue;
            if (lookup != null) entity[attribute] = new EntityReference(lookup.Table, key, lookup.Key);
            else if (money != null) entity[attribute] = new Money(money.Amount);
            else if (state != null)
            {
                entity["statecode"] = new OptionSetValue(state.Active ? 0 : 1);
                entity["statuscode"] = new OptionSetValue(state.Active ? 1 : 2);
            }
            else entity[attribute] = value;
        }

        private static Entity Current(IOrganizationService svc, ChangeModel model, PlannedOp op)
        {
            var e = model.Entities[op.Entity];
            var columns = e.Columns.Values.Where(c => c.Attribute != "transactioncurrencyid").Select(c => c.Attribute).Concat(new[] { model.Key, "versionnumber" }).Distinct().ToArray();
            try
            {
                var r = (RetrieveResponse)svc.Execute(new RetrieveRequest { Target = new EntityReference(op.Table, model.Key, op.Key), ColumnSet = new ColumnSet(columns) });
                return r.Entity;
            }
            catch (FaultException<OrganizationServiceFault> f)
            {
                if (f.Detail.ErrorCode == NotFound) return null;
                throw;
            }
        }

        private static void Conflict(ChangeModel model, PlannedOp op, Entity current, long? version)
        {
            var row = new Dictionary<string, JsonValue> { { "code", JsonValue.Str(op.Code) } };
            if (current != null)
            {
                var e = model.Entities[op.Entity];
                foreach (var c in e.Columns.Values)
                {
                    if (!current.Contains(c.Attribute)) continue;
                    var v = current[c.Attribute];
                    var reference = v as EntityReference;
                    var money = v as Money;
                    var option = v as OptionSetValue;
                    if (reference != null) row[c.Name] = reference.Name == null ? JsonValue.Null : JsonValue.Str(c.Scope != null && reference.Name.StartsWith(c.Scope + "/", StringComparison.Ordinal) ? reference.Name.Substring(c.Scope.Length + 1) : reference.Name);
                    else if (money != null) row[c.Name] = JsonValue.Str(money.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));
                    else if (option != null) row[c.Name] = c.Attribute == "statecode" ? JsonValue.Boolean(option.Value == 0) : JsonValue.Num(option.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));
                    else if (v is decimal) row[c.Name] = JsonValue.Str(((decimal)v).ToString(System.Globalization.CultureInfo.InvariantCulture));
                    else if (v is int) row[c.Name] = JsonValue.Num(((int)v).ToString(System.Globalization.CultureInfo.InvariantCulture));
                    else if (v is bool) row[c.Name] = JsonValue.Boolean((bool)v);
                    else if (v is DateTime) row[c.Name] = JsonValue.Str(((DateTime)v).ToString(c.Kind == "date" ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm:ss", System.Globalization.CultureInfo.InvariantCulture));
                    else if (v != null) row[c.Name] = JsonValue.Str(v.ToString());
                }
                var cur = version ?? current.GetAttributeValue<long?>("versionnumber");
                if (cur.HasValue) row["row_version"] = JsonValue.Num(cur.Value.ToString(System.Globalization.CultureInfo.InvariantCulture));
            }
            var detail = new Dictionary<string, JsonValue>
            {
                { "error", JsonValue.Str("conflict") },
                { "message", JsonValue.Str(op.Entity + " " + op.Code + " changed since version " + op.RowVersion) },
                { "entity", JsonValue.Str(op.Entity) },
                { "code", JsonValue.Str(op.Code) },
                { "current", JsonValue.Obj(row) },
            };
            throw new InvalidPluginExecutionException(OperationStatus.Failed, Prefix + JsonValue.Obj(detail));
        }

        private static void Refuse(string code, string message, PlannedOp op = null)
        {
            var detail = new Dictionary<string, JsonValue> { { "error", JsonValue.Str(code) }, { "message", JsonValue.Str(message) } };
            if (op != null)
            {
                detail["entity"] = JsonValue.Str(op.Entity);
                detail["code"] = JsonValue.Str(op.Code);
            }
            throw new InvalidPluginExecutionException(OperationStatus.Failed, Prefix + JsonValue.Obj(detail));
        }

        private static string Result(Guid id, string items, bool replayed)
        {
            return "{\"id\":\"" + id + "\",\"items\":" + items + ",\"replayed\":" + (replayed ? "true" : "false") + "}";
        }

        private static IEnumerable<string> RolesOf(IOrganizationService svc, Guid userId)
        {
            var q = new QueryExpression("role") { ColumnSet = new ColumnSet("name") };
            var link = q.AddLink("systemuserroles", "roleid", "roleid");
            link.LinkCriteria.AddCondition("systemuserid", ConditionOperator.Equal, userId);
            return svc.RetrieveMultiple(q).Entities.Select(r => r.GetAttributeValue<string>("name")).Where(n => n != null).ToList();
        }
    }
}
