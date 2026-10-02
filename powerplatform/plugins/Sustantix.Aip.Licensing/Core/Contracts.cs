using System.Collections.Generic;
using System.Runtime.Serialization;

namespace Sustantix.Aip.Licensing.Core
{
    // SXL1 v1 wire contract — must stay identical to packages/license/src/types.ts.

    [DataContract]
    public sealed class CustomerRef
    {
        [DataMember(Name = "id")] public string Id { get; set; }
        [DataMember(Name = "name")] public string Name { get; set; }
    }

    [DataContract]
    public sealed class LicenseBinding
    {
        [DataMember(Name = "orgId", EmitDefaultValue = false)] public string OrgId { get; set; }
        [DataMember(Name = "environmentId", EmitDefaultValue = false)] public string EnvironmentId { get; set; }
        [DataMember(Name = "tenantId", EmitDefaultValue = false)] public string TenantId { get; set; }
        [DataMember(Name = "domains", EmitDefaultValue = false)] public List<string> Domains { get; set; }
    }

    [DataContract]
    public sealed class LicensePayload
    {
        [DataMember(Name = "v")] public int? V { get; set; }
        [DataMember(Name = "lid")] public string Lid { get; set; }
        [DataMember(Name = "customer")] public CustomerRef Customer { get; set; }
        [DataMember(Name = "edition")] public string Edition { get; set; }
        [DataMember(Name = "platform")] public string Platform { get; set; }
        [DataMember(Name = "bind")] public LicenseBinding Bind { get; set; }
        [DataMember(Name = "iat")] public long? Iat { get; set; }
        [DataMember(Name = "nbf")] public long? Nbf { get; set; }
        [DataMember(Name = "exp")] public long? Exp { get; set; }
        [DataMember(Name = "trialDays", EmitDefaultValue = false)] public int? TrialDays { get; set; }
        [DataMember(Name = "graceDays", EmitDefaultValue = false)] public int? GraceDays { get; set; }
        [DataMember(Name = "seats", EmitDefaultValue = false)] public int? Seats { get; set; }
        [DataMember(Name = "modules")] public List<string> Modules { get; set; }
    }

    [DataContract]
    public sealed class RevocationList
    {
        [DataMember(Name = "v")] public int? V { get; set; }
        [DataMember(Name = "iat")] public long? Iat { get; set; }
        [DataMember(Name = "revoked")] public List<string> Revoked { get; set; }
    }

    [DataContract]
    public sealed class TrustedKey
    {
        [DataMember(Name = "kid")] public string Kid { get; set; }
        [DataMember(Name = "kty")] public string Kty { get; set; }
        [DataMember(Name = "n")] public string N { get; set; }
        [DataMember(Name = "e")] public string E { get; set; }
    }

    public sealed class ClockState
    {
        public string Lid { get; set; }
        public long FirstSeen { get; set; }
        public long LastSeen { get; set; }
    }

    [DataContract]
    public sealed class LicenseStatus
    {
        [DataMember(Name = "state", Order = 1)] public string State { get; set; }
        [DataMember(Name = "access", Order = 2)] public string Access { get; set; }
        [DataMember(Name = "reason", Order = 3)] public string Reason { get; set; }
        [DataMember(Name = "lid", Order = 4, EmitDefaultValue = false)] public string Lid { get; set; }
        [DataMember(Name = "edition", Order = 5, EmitDefaultValue = false)] public string Edition { get; set; }
        [DataMember(Name = "customer", Order = 6, EmitDefaultValue = false)] public string Customer { get; set; }
        [DataMember(Name = "modules", Order = 7, EmitDefaultValue = false)] public List<string> Modules { get; set; }
        [DataMember(Name = "daysRemaining", Order = 8, EmitDefaultValue = false)] public long? DaysRemaining { get; set; }
        [DataMember(Name = "expiresAt", Order = 9, EmitDefaultValue = false)] public string ExpiresAt { get; set; }
        [DataMember(Name = "fingerprint", Order = 10, EmitDefaultValue = false)] public string Fingerprint { get; set; }
        [DataMember(Name = "kid", Order = 11, EmitDefaultValue = false)] public string Kid { get; set; }

        public ClockState NextClock { get; set; }
    }
}
