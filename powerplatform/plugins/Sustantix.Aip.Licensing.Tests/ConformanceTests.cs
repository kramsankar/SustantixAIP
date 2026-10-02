using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using Sustantix.Aip.Licensing.Core;
using Xunit;

namespace Sustantix.Aip.Licensing.Tests
{
    [DataContract]
    public sealed class Case
    {
        [DataMember(Name = "name")] public string Name { get; set; }
        [DataMember(Name = "token")] public string Token { get; set; }
        [DataMember(Name = "org")] public string Org { get; set; }
        [DataMember(Name = "now")] public long Now { get; set; }
        [DataMember(Name = "expect")] public string Expect { get; set; }
        [DataMember(Name = "access")] public string Access { get; set; }
        [DataMember(Name = "days")] public long? Days { get; set; }
        [DataMember(Name = "revocation")] public string Revocation { get; set; }
        [DataMember(Name = "clock")] public ClockDto Clock { get; set; }
    }

    [DataContract]
    public sealed class ClockDto
    {
        [DataMember(Name = "lid")] public string Lid { get; set; }
        [DataMember(Name = "firstSeen")] public long FirstSeen { get; set; }
        [DataMember(Name = "lastSeen")] public long LastSeen { get; set; }
    }

    public class ConformanceTests
    {
        private static T Load<T>(string file)
        {
            using (var s = File.OpenRead(Path.Combine(AppContext.BaseDirectory, "fixtures", file)))
                return (T)new DataContractJsonSerializer(typeof(T)).ReadObject(s);
        }

        public static IEnumerable<object[]> Cases()
        {
            foreach (var c in Load<List<Case>>("cases.json")) yield return new object[] { c.Name };
        }

        [Theory]
        [MemberData(nameof(Cases))]
        public void MatchesTypeScriptVerifier(string name)
        {
            var c = Load<List<Case>>("cases.json").Find(x => x.Name == name);
            var verifier = new LicenseVerifier(Load<List<TrustedKey>>("trusted-keys.json"));
            var clock = c.Clock == null ? null : new ClockState { Lid = c.Clock.Lid, FirstSeen = c.Clock.FirstSeen, LastSeen = c.Clock.LastSeen };
            var status = verifier.Verify(c.Token, Guid.Parse(c.Org), c.Now, clock, verifier.VerifyRevocationList(c.Revocation));
            Assert.Equal(c.Expect, status.State);
            Assert.Equal(c.Access, status.Access);
            if (c.Days.HasValue) Assert.Equal(c.Days, status.DaysRemaining);
        }

        [Fact]
        public void RejectsWeakTrustedKeys()
        {
            var c = Load<List<Case>>("cases.json")[0];
            var verifier = new LicenseVerifier(Load<List<TrustedKey>>("weak-keys.json"));
            Assert.Equal("invalid_signature", verifier.Verify(c.Token, Guid.Parse(c.Org), c.Now, null, null).State);
        }

        [Fact]
        public void FailsClosedWithoutKeys()
        {
            var status = new LicenseVerifier(new List<TrustedKey>()).Verify("SXL1.a.b.c", Guid.NewGuid(), 0, null, null);
            Assert.Equal("no_trusted_keys", status.State);
            Assert.Equal("none", status.Access);
        }

        [Fact]
        public void SerialisesStatusJson()
        {
            var c = Load<List<Case>>("cases.json")[0];
            var verifier = new LicenseVerifier(Load<List<TrustedKey>>("trusted-keys.json"));
            var json = LicenseVerifier.ToJson(verifier.Verify(c.Token, Guid.Parse(c.Org), c.Now, null, null));
            Assert.Contains("\"state\":\"valid\"", json);
            Assert.Contains("\"access\":\"full\"", json);
            Assert.DoesNotContain("NextClock", json);
        }
    }
}
