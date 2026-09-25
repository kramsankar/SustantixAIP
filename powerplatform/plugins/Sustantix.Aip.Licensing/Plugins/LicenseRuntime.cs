using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Sustantix.Aip.Licensing.Core;

namespace Sustantix.Aip.Licensing.Plugins
{
    /// <summary>
    /// Resolves the license verdict for the executing organisation. The token lives in the
    /// environment variable sus_LicenseKey; anti-rollback memory lives in sus_licensestate,
    /// which only this assembly (running as SYSTEM) writes.
    /// </summary>
    internal static class LicenseRuntime
    {
        public const string LicenseVariable = "sus_LicenseKey";
        public const string RevocationVariable = "sus_LicenseRevocationList";
        public const string StateTable = "sus_licensestate";
        private const int CacheSeconds = 300;

        private static readonly object Gate = new object();
        private static readonly Dictionary<Guid, Tuple<DateTime, LicenseStatus>> Cache = new Dictionary<Guid, Tuple<DateTime, LicenseStatus>>();
        private static IList<TrustedKey> _keys;

        private static IList<TrustedKey> Keys
        {
            get
            {
                lock (Gate)
                {
                    return _keys ?? (_keys = LicenseVerifier.LoadEmbeddedKeys());
                }
            }
        }

        public static LicenseStatus Resolve(IServiceProvider services, bool bypassCache = false)
        {
            var context = (IPluginExecutionContext)services.GetService(typeof(IPluginExecutionContext));
            var orgId = context.OrganizationId;
            if (!bypassCache)
            {
                lock (Gate)
                {
                    Tuple<DateTime, LicenseStatus> hit;
                    if (Cache.TryGetValue(orgId, out hit) && hit.Item1 > DateTime.UtcNow) return hit.Item2;
                }
            }

            var factory = (IOrganizationServiceFactory)services.GetService(typeof(IOrganizationServiceFactory));
            var system = factory.CreateOrganizationService(null);
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            var verifier = new LicenseVerifier(Keys);
            var token = ReadEnvironmentVariable(system, LicenseVariable);
            var revocation = verifier.VerifyRevocationList(ReadEnvironmentVariable(system, RevocationVariable));
            Entity stateRow;
            var clock = ReadClock(system, out stateRow);
            var status = verifier.Verify(token, orgId, now, clock, revocation);
            PersistClock(system, stateRow, status);

            lock (Gate)
            {
                Cache[orgId] = Tuple.Create(DateTime.UtcNow.AddSeconds(CacheSeconds), status);
            }
            return status;
        }

        internal static string ReadEnvironmentVariable(IOrganizationService svc, string schemaName)
        {
            var q = new QueryExpression("environmentvariabledefinition")
            {
                ColumnSet = new ColumnSet("defaultvalue"),
                Criteria = { Conditions = { new ConditionExpression("schemaname", ConditionOperator.Equal, schemaName) } },
                TopCount = 1,
            };
            var value = q.AddLink("environmentvariablevalue", "environmentvariabledefinitionid", "environmentvariabledefinitionid", JoinOperator.LeftOuter);
            value.EntityAlias = "v";
            value.Columns = new ColumnSet("value");
            var row = svc.RetrieveMultiple(q).Entities.FirstOrDefault();
            if (row == null) return null;
            var current = row.GetAttributeValue<AliasedValue>("v.value")?.Value as string;
            return !string.IsNullOrWhiteSpace(current) ? current : row.GetAttributeValue<string>("defaultvalue");
        }

        private static ClockState ReadClock(IOrganizationService svc, out Entity row)
        {
            var q = new QueryExpression(StateTable)
            {
                ColumnSet = new ColumnSet("sus_name", "sus_firstseen", "sus_lastseen"),
                TopCount = 1,
            };
            q.AddOrder("createdon", OrderType.Ascending);
            row = svc.RetrieveMultiple(q).Entities.FirstOrDefault();
            if (row == null) return null;
            return new ClockState
            {
                Lid = row.GetAttributeValue<string>("sus_name"),
                FirstSeen = row.GetAttributeValue<long?>("sus_firstseen") ?? 0,
                LastSeen = row.GetAttributeValue<long?>("sus_lastseen") ?? 0,
            };
        }

        private static void PersistClock(IOrganizationService svc, Entity row, LicenseStatus status)
        {
            var next = status.NextClock;
            if (next == null) return;
            var e = new Entity(StateTable);
            e["sus_name"] = next.Lid;
            e["sus_firstseen"] = next.FirstSeen;
            e["sus_lastseen"] = next.LastSeen;
            e["sus_verdict"] = status.State;
            if (row == null)
            {
                svc.Create(e);
                return;
            }
            var prevLid = row.GetAttributeValue<string>("sus_name");
            var prevSeen = row.GetAttributeValue<long?>("sus_lastseen") ?? 0;
            // Write at most hourly unless the installed license changed.
            if (prevLid != next.Lid || next.LastSeen - prevSeen >= 3600)
            {
                e.Id = row.Id;
                svc.Update(e);
            }
        }
    }
}
