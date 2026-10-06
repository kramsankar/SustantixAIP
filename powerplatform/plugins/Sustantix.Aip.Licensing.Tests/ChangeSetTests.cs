using System;
using System.IO;
using System.Linq;
using Sustantix.Aip.Licensing.Core;
using Xunit;

namespace Sustantix.Aip.Licensing.Tests
{
    public class ChangeSetTests
    {
        private static readonly ChangeModel Model = ChangeModel.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "fixtures", "change-model.json")));
        private const string Id = "11111111-2222-4333-8444-555555555555";

        private static string Set(string items) { return "{\"id\":\"" + Id + "\",\"source\":\"grid\",\"items\":[" + items + "]}"; }

        private static string Refusal(string json, string role = "planner")
        {
            var e = Assert.Throws<ChangeSetException>(() => ChangeSetPlanner.Plan(json, Model, role));
            return e.Code;
        }

        [Fact]
        public void PlansUpdatesWithRowVersionsLookupsByAlternateKeyAndExactAmounts()
        {
            var plan = ChangeSetPlanner.Plan(Set(
                "{\"entity\":\"work_order\",\"op\":\"update\",\"code\":\"WO-1\",\"baseVersion\":7,\"values\":{\"status\":\"IN_PROGRESS\",\"site\":\"SP-01\",\"estimated_cost\":\"1250.5000\",\"sla_hours\":48,\"pm_due_date\":\"2026-10-20\",\"is_active\":false}}"),
                Model, "planner");
            Assert.Equal(Guid.Parse(Id), plan.Id);
            var op = plan.Ops.Single();
            Assert.Equal(OpKind.Update, op.Kind);
            Assert.Equal("sus_work_order", op.Table);
            Assert.Equal(7L, op.RowVersion);
            var status = Assert.IsType<LookupValue>(op.Attributes["sus_statusid"]);
            Assert.Equal("sus_ref_status", status.Table);
            Assert.Equal("work_order/IN_PROGRESS", status.Key);
            Assert.Equal("SP-01", Assert.IsType<LookupValue>(op.Attributes["sus_siteid"]).Key);
            Assert.Equal(1250.5000m, Assert.IsType<MoneyValue>(op.Attributes["sus_estimatedcost"]).Amount);
            Assert.Equal(48, op.Attributes["sus_slahours"]);
            Assert.Equal(new DateTime(2026, 10, 20), op.Attributes["sus_pmduedate"]);
            Assert.False(Assert.IsType<StateValue>(op.Attributes["statecode"]).Active);
        }

        [Fact]
        public void PlansInsertsKeyedOnTheBusinessCodeAndDeletesWithVersions()
        {
            var plan = ChangeSetPlanner.Plan(Set(
                "{\"entity\":\"work_order\",\"op\":\"insert\",\"code\":\"WO-9\",\"values\":{\"description\":\"Replace fan\"}}," +
                "{\"entity\":\"work_order\",\"op\":\"delete\",\"code\":\"WO-8\",\"baseVersion\":3}"), Model, "planner");
            Assert.Equal("WO-9", plan.Ops[0].Attributes["sus_name"]);
            Assert.Equal("Replace fan", plan.Ops[0].Attributes["sus_description"]);
            Assert.Null(plan.Ops[0].RowVersion);
            Assert.Equal(OpKind.Delete, plan.Ops[1].Kind);
            Assert.Equal(3L, plan.Ops[1].RowVersion);
        }

        [Fact]
        public void RefusesWhatTheModelOrRoleDoesNotAllow()
        {
            Assert.Equal("invalid_value", Refusal(Set("{\"entity\":\"work_order\",\"op\":\"update\",\"code\":\"WO-1\",\"baseVersion\":1,\"values\":{\"estimated_cost\":1250.5}}")));
            Assert.Equal("invalid_value", Refusal(Set("{\"entity\":\"work_order\",\"op\":\"update\",\"code\":\"WO-1\",\"baseVersion\":1,\"values\":{\"source_ordinal\":4}}")));
            Assert.Equal("invalid_value", Refusal(Set("{\"entity\":\"work_order\",\"op\":\"update\",\"code\":\"WO-1\",\"baseVersion\":1,\"values\":{\"currency\":\"USD\"}}")));
            Assert.Equal("invalid_value", Refusal(Set("{\"entity\":\"work_order\",\"op\":\"update\",\"code\":\"WO-1\",\"baseVersion\":1,\"values\":{\"pm_due_date\":\"2026-02-30\"}}")));
            Assert.Equal("invalid_change_set", Refusal(Set("{\"entity\":\"work_order\",\"op\":\"update\",\"code\":\"WO-1\",\"values\":{\"sla_hours\":1}}")));
            Assert.Equal("forbidden", Refusal(Set("{\"entity\":\"site\",\"op\":\"update\",\"code\":\"SP-01\",\"baseVersion\":1,\"values\":{\"name\":\"x\"}}")));
            Assert.Equal("read_only", Refusal(Set("{\"entity\":\"plant_telemetry\",\"op\":\"delete\",\"code\":\"x\",\"baseVersion\":1}"), "admin"));
            Assert.Equal("unknown_entity", Refusal(Set("{\"entity\":\"systemuser\",\"op\":\"delete\",\"code\":\"x\",\"baseVersion\":1}")));
            Assert.Equal("forbidden", Refusal(Set("{\"entity\":\"work_order\",\"op\":\"insert\",\"code\":\"W\"}"), "viewer"));
            Assert.Equal("invalid_json", Refusal("{not json"));
            Assert.Equal("invalid_change_set", Refusal("{\"id\":\"nope\",\"items\":[]}"));
        }

        [Fact]
        public void AdministratorsMaintainTenantVocabularyButNotPlatformCodes()
        {
            var plan = ChangeSetPlanner.Plan(Set("{\"entity\":\"ref_status\",\"op\":\"insert\",\"code\":\"work_order:ON_HOLD\",\"values\":{\"label\":\"On hold\"}}"), Model, "admin");
            Assert.Equal("work_order/ON_HOLD", plan.Ops[0].Key);
            Assert.Equal("ON_HOLD", plan.Ops[0].Attributes["sus_code"]);
            Assert.Equal("On hold", plan.Ops[0].Attributes["sus_label"]);
            Assert.Equal("forbidden", Refusal(Set("{\"entity\":\"ref_status\",\"op\":\"update\",\"code\":\"work_order:OPEN\",\"baseVersion\":1,\"values\":{\"label\":\"x\"}}"), "admin"));
            Assert.Equal("invalid_code", Refusal(Set("{\"entity\":\"ref_status\",\"op\":\"insert\",\"code\":\"ON_HOLD\",\"values\":{\"label\":\"x\"}}"), "admin"));
            Assert.Equal("forbidden", Refusal(Set("{\"entity\":\"ref_priority\",\"op\":\"insert\",\"code\":\"P9\",\"values\":{\"label\":\"x\"}}")));
            Assert.Equal("invalid_value", Refusal(Set("{\"entity\":\"ref_priority\",\"op\":\"insert\",\"code\":\"lower\",\"values\":{\"label\":\"x\"}}"), "admin"));
        }

        [Fact]
        public void MapsSecurityRolesToAipRoles()
        {
            Assert.Equal("admin", ChangeSetPlanner.RoleOf(new[] { "Sustantix AIP Administrator" }));
            Assert.Equal("planner", ChangeSetPlanner.RoleOf(new[] { "Basic User", "Sustantix AIP User" }));
            Assert.Equal("viewer", ChangeSetPlanner.RoleOf(new[] { "Basic User" }));
        }

        [Fact]
        public void JsonKeepsNumbersExactAndRoundTrips()
        {
            var v = JsonValue.Parse("{\"a\":0.1,\"b\":[true,null,\"x\\\"y\"],\"c\":123456789012345.6789}");
            Assert.Equal("0.1", v["a"].Text);
            Assert.Equal("123456789012345.6789", v["c"].Text);
            Assert.Equal("{\"a\":0.1,\"b\":[true,null,\"x\\\"y\"],\"c\":123456789012345.6789}", v.ToString());
            Assert.Throws<FormatException>(() => JsonValue.Parse("[1,]"));
            Assert.Throws<FormatException>(() => JsonValue.Parse(new string('[', 100) + new string(']', 100)));
        }
    }
}
