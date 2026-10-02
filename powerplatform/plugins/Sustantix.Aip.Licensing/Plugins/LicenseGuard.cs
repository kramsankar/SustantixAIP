using System;
using Microsoft.Xrm.Sdk;

namespace Sustantix.Aip.Licensing.Plugins
{
    /// <summary>
    /// Registered (PreValidation, synchronous) on every AIP table for Create, Update, Delete,
    /// Associate, Disassociate, Retrieve and RetrieveMultiple. Writes require full access;
    /// reads are allowed during the paid-edition grace period.
    /// </summary>
    public sealed class LicenseGuard : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var isRead = context.MessageName == "Retrieve" || context.MessageName == "RetrieveMultiple";

            var status = LicenseRuntime.Resolve(serviceProvider);
            trace?.Trace("AIP license {0}/{1} for {2} on {3}", status.State, status.Access, context.MessageName, context.PrimaryEntityName);

            if (status.Access == "full") return;
            if (status.Access == "read_only" && isRead) return;

            var message = status.Access == "read_only"
                ? "Sustantix AIP license is in its read-only grace period (" + status.Reason + "). Renew to continue making changes."
                : "Sustantix AIP is not licensed for this environment (" + status.Reason + "). Contact your Sustantix administrator.";
            throw new InvalidPluginExecutionException(OperationStatus.Failed, message);
        }
    }

    /// <summary>Custom API sus_GetLicenseStatus — returns the server verdict as JSON (output: StatusJson).</summary>
    public sealed class GetLicenseStatus : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var refresh = context.InputParameters.Contains("Refresh") && context.InputParameters["Refresh"] is bool && (bool)context.InputParameters["Refresh"];
            var status = LicenseRuntime.Resolve(serviceProvider, refresh);
            context.OutputParameters["StatusJson"] = Core.LicenseVerifier.ToJson(status);
        }
    }
}
