using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.Serialization.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Sustantix.Aip.Licensing.Core
{
    /// <summary>
    /// Server-side SXL1 verifier. Behaviour mirrors packages/license/src/verify.ts;
    /// both are exercised against the same signed fixtures.
    /// </summary>
    public sealed class LicenseVerifier
    {
        public const string TokenPrefix = "SXL1";
        public const string RevocationPrefix = "SXR1";
        public const int MaxTrialDays = 90;
        public const int MinRsaBits = 4096;
        public const long ClockRollbackToleranceSec = 3600;
        private const long Day = 86400;

        private static readonly Regex KidPattern = new Regex("^[A-Za-z0-9_-]{1,64}$", RegexOptions.CultureInvariant);
        private static readonly Regex GuidPattern = new Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOptions.CultureInvariant);

        private readonly IList<TrustedKey> _keys;

        public LicenseVerifier(IList<TrustedKey> trustedKeys)
        {
            _keys = trustedKeys ?? new List<TrustedKey>();
        }

        public static IList<TrustedKey> LoadEmbeddedKeys()
        {
            var asm = typeof(LicenseVerifier).Assembly;
            using (var s = asm.GetManifestResourceStream("Sustantix.Aip.Licensing.trusted-keys.json"))
            {
                if (s == null) return new List<TrustedKey>();
                var ser = new DataContractJsonSerializer(typeof(List<TrustedKey>));
                return (List<TrustedKey>)ser.ReadObject(s) ?? new List<TrustedKey>();
            }
        }

        private sealed class Parsed
        {
            public string Kid;
            public byte[] PayloadJson;
            public byte[] Signed;
            public byte[] Signature;
        }

        private static Parsed Parse(string token, string prefix)
        {
            if (string.IsNullOrWhiteSpace(token)) return null;
            var parts = token.Trim().Split('.');
            if (parts.Length != 4 || parts[0] != prefix || !KidPattern.IsMatch(parts[1])) return null;
            try
            {
                return new Parsed
                {
                    Kid = parts[1],
                    PayloadJson = Base64Url.Decode(parts[2]),
                    Signed = Encoding.ASCII.GetBytes(parts[0] + "." + parts[1] + "." + parts[2]),
                    Signature = Base64Url.Decode(parts[3]),
                };
            }
            catch (FormatException)
            {
                return null;
            }
        }

        /// <returns>"ok", "unknown_key" or "invalid_signature".</returns>
        private string CheckSignature(Parsed t)
        {
            var key = _keys.FirstOrDefault(k => k.Kid == t.Kid);
            if (key == null) return "unknown_key";
            try
            {
                var modulus = Base64Url.Decode(key.N);
                var exponent = Base64Url.Decode(key.E);
                if (key.Kty != "RSA" || ModulusBits(modulus) < MinRsaBits) return "invalid_signature";
                using (var rsa = new RSACryptoServiceProvider())
                {
                    rsa.ImportParameters(new RSAParameters { Modulus = modulus, Exponent = exponent });
                    return rsa.VerifyData(t.Signed, t.Signature, HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1)
                        ? "ok"
                        : "invalid_signature";
                }
            }
            catch (CryptographicException)
            {
                return "invalid_signature";
            }
            catch (FormatException)
            {
                return "invalid_signature";
            }
        }

        private static int ModulusBits(byte[] n)
        {
            var i = 0;
            while (i < n.Length && n[i] == 0) i++;
            if (i == n.Length) return 0;
            var top = n[i];
            var bits = 0;
            while (top > 0) { bits++; top >>= 1; }
            return (n.Length - i - 1) * 8 + bits;
        }

        private static T ReadJson<T>(byte[] json) where T : class
        {
            try
            {
                using (var ms = new MemoryStream(json))
                {
                    return new DataContractJsonSerializer(typeof(T)).ReadObject(ms) as T;
                }
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static bool Str(string s) => !string.IsNullOrEmpty(s) && s.Length <= 256;

        public static bool ValidatePayload(LicensePayload p)
        {
            if (p == null || p.V != 1 || !Str(p.Lid) || p.Customer == null || !Str(p.Customer.Id) || !Str(p.Customer.Name)) return false;
            if (p.Edition != "trial" && p.Edition != "standard" && p.Edition != "enterprise") return false;
            if (p.Platform != "powerplatform" && p.Platform != "vercel" && p.Platform != "any") return false;
            if (!p.Iat.HasValue || !p.Nbf.HasValue || !p.Exp.HasValue || p.Exp <= p.Nbf) return false;
            if (p.Modules == null || !p.Modules.All(Str)) return false;
            if (p.Bind == null) return false;
            foreach (var g in new[] { p.Bind.OrgId, p.Bind.EnvironmentId, p.Bind.TenantId })
            {
                if (g != null && !GuidPattern.IsMatch(g.ToLowerInvariant())) return false;
            }
            if (p.Bind.Domains != null && !p.Bind.Domains.All(Str)) return false;
            if ((p.TrialDays ?? 0) < 0 || (p.GraceDays ?? 0) < 0 || (p.Seats ?? 0) < 0) return false;
            return true;
        }

        private static string BindingCheck(LicensePayload p, Guid orgId)
        {
            var b = p.Bind;
            var pinned = b.OrgId != null || b.EnvironmentId != null || b.TenantId != null || (b.Domains != null && b.Domains.Count > 0);
            if (!pinned) return "license carries no environment binding";
            if (b.OrgId == null) return "license is not bound to a Dataverse organisation";
            if (!string.Equals(b.OrgId, orgId.ToString("D"), StringComparison.OrdinalIgnoreCase)) return "Dataverse organisation does not match";
            return null;
        }

        private static string TrialCheck(LicensePayload p)
        {
            if (p.Edition != "trial") return null;
            if (!p.TrialDays.HasValue || p.TrialDays < 1 || p.TrialDays > MaxTrialDays) return "trial length outside policy";
            if (p.Exp.Value - p.Nbf.Value > p.TrialDays.Value * Day + 300) return "trial window exceeds granted days";
            if ((p.GraceDays ?? 0) > 0) return "trials carry no grace period";
            return null;
        }

        public static string Fingerprint(string token)
        {
            using (var sha = SHA256.Create())
            {
                var h = sha.ComputeHash(Encoding.UTF8.GetBytes(token.Trim()));
                return BitConverter.ToString(h, 0, 8).Replace("-", string.Empty).ToUpperInvariant();
            }
        }

        public RevocationList VerifyRevocationList(string token)
        {
            var t = Parse(token, RevocationPrefix);
            if (t == null || CheckSignature(t) != "ok") return null;
            var list = ReadJson<RevocationList>(t.PayloadJson);
            if (list == null || list.V != 1 || !list.Iat.HasValue || list.Revoked == null || !list.Revoked.All(Str)) return null;
            return list;
        }

        private static LicenseStatus Status(string state, string reason, LicensePayload p = null)
        {
            var s = new LicenseStatus
            {
                State = state,
                Access = state == "valid" ? "full" : state == "grace" ? "read_only" : "none",
                Reason = reason,
            };
            if (p != null)
            {
                s.Lid = p.Lid;
                s.Edition = p.Edition;
                s.Customer = p.Customer?.Name;
                s.Modules = p.Modules;
                s.ExpiresAt = DateTimeOffset.FromUnixTimeSeconds(p.Exp.Value).UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ");
            }
            return s;
        }

        /// <param name="orgId">Dataverse organisation id from the execution context — never from the client.</param>
        /// <param name="now">Server time, epoch seconds.</param>
        public LicenseStatus Verify(string token, Guid orgId, long now, ClockState clock, RevocationList revocation)
        {
            if (_keys.Count == 0) return Status("no_trusted_keys", "this build has no trusted license keys configured");
            if (string.IsNullOrWhiteSpace(token)) return Status("no_license", "no license key installed");
            var t = Parse(token, TokenPrefix);
            if (t == null) return Status("malformed", "license key is not a valid SXL1 token");
            var fp = Fingerprint(token);
            var sig = CheckSignature(t);
            if (sig != "ok")
            {
                var s = Status(sig, sig == "unknown_key" ? "signing key " + t.Kid + " is not trusted" : "signature verification failed");
                s.Fingerprint = fp;
                s.Kid = t.Kid;
                return s;
            }
            var p = ReadJson<LicensePayload>(t.PayloadJson);
            if (!ValidatePayload(p)) return Status("malformed", "license payload failed validation");

            LicenseStatus result;
            if (p.Platform != "any" && p.Platform != "powerplatform") result = Status("platform_mismatch", "license is for " + p.Platform, p);
            else
            {
                var bind = BindingCheck(p, orgId);
                var trial = bind == null ? TrialCheck(p) : null;
                if (bind != null) result = Status("binding_mismatch", bind, p);
                else if (trial != null) result = Status("trial_policy_violation", trial, p);
                else if (revocation?.Revoked != null && revocation.Revoked.Contains(p.Lid)) result = Status("revoked", "license has been revoked", p);
                else if (clock != null && clock.Lid == p.Lid && now + ClockRollbackToleranceSec < clock.LastSeen)
                    result = Status("clock_tamper", "system clock moved backwards since last validation", p);
                else
                {
                    var same = clock != null && clock.Lid == p.Lid;
                    var next = new ClockState
                    {
                        Lid = p.Lid,
                        FirstSeen = same ? clock.FirstSeen : now,
                        LastSeen = Math.Max(now, same ? clock.LastSeen : 0),
                    };
                    var days = (long)Math.Ceiling((p.Exp.Value - now) / (double)Day);
                    if (now < p.Nbf) result = Status("not_yet_valid", "license is not yet active", p);
                    else if (now >= p.Exp)
                    {
                        var grace = p.Edition == "trial" ? 0 : (p.GraceDays ?? 0);
                        result = now < p.Exp.Value + grace * Day
                            ? Status("grace", "license expired — read-only grace period", p)
                            : Status("expired", p.Edition == "trial" ? "trial has ended" : "license has expired", p);
                    }
                    else result = Status("valid", p.Edition == "trial" ? "trial active" : "license active", p);
                    result.DaysRemaining = days;
                    result.NextClock = next;
                }
            }
            result.Fingerprint = fp;
            result.Kid = t.Kid;
            return result;
        }

        public static string ToJson(LicenseStatus status)
        {
            using (var ms = new MemoryStream())
            {
                new DataContractJsonSerializer(typeof(LicenseStatus)).WriteObject(ms, status);
                return Encoding.UTF8.GetString(ms.ToArray());
            }
        }
    }

    public static class Base64Url
    {
        public static byte[] Decode(string s)
        {
            if (s == null || !Regex.IsMatch(s, "^[A-Za-z0-9_-]*$")) throw new FormatException("invalid base64url");
            var b = s.Replace('-', '+').Replace('_', '/');
            switch (b.Length % 4)
            {
                case 2: b += "=="; break;
                case 3: b += "="; break;
                case 1: throw new FormatException("invalid base64url length");
            }
            return Convert.FromBase64String(b);
        }
    }
}
