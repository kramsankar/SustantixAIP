import type { TrustedKey } from "@sustantix/license";
import keyset from "../../../config/license/trusted-keys.json";

/**
 * Public keys this build trusts, from the monorepo keyset. An empty set makes every
 * verdict `no_trusted_keys` (fail-closed).
 */
export const TRUSTED_KEYS: readonly TrustedKey[] = Object.freeze((keyset as unknown as TrustedKey[]).map((k) => Object.freeze({ ...k })));
