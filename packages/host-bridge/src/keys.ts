import type { TrustedKey } from "@sustantix/license";

declare const __AIP_TRUSTED_KEYS__: TrustedKey[];

/** Public signing keys compiled into this build (config/license/trusted-keys.json). */
export const TRUSTED_KEYS: TrustedKey[] = __AIP_TRUSTED_KEYS__;
