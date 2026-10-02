import { describe, expect, it } from "vitest";
import { EnvError, parseServerEnv } from "../lib/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcd.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-0123456789abcdef",
  SUPABASE_SERVICE_ROLE_KEY: "service-key-0123456789abcdef",
};

describe("server env", () => {
  it("accepts a complete environment; license variables are optional", () => {
    const env = parseServerEnv({ ...valid, AIP_LICENSE_KEY: "  ", AIP_LICENSE_REVOCATION: "" });
    expect(env.AIP_LICENSE_KEY).toBeUndefined();
    expect(env.AIP_LICENSE_REVOCATION).toBeUndefined();
    expect(parseServerEnv({ ...valid, AIP_LICENSE_KEY: " SXL1.a.b.c " }).AIP_LICENSE_KEY).toBe("SXL1.a.b.c");
  });

  it("names missing or invalid variables without echoing values", () => {
    const secret = "short";
    try {
      parseServerEnv({ NEXT_PUBLIC_SUPABASE_URL: "not a url", SUPABASE_SERVICE_ROLE_KEY: secret });
      expect.fail("should throw");
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError);
      const err = e as EnvError;
      expect(err.variables.sort()).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
      expect(err.message).not.toContain(secret);
    }
  });
});
