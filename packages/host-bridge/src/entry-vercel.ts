import { vercelAdapter } from "./adapters/vercel.js";
import { installBridge } from "./bridge.js";
import { TRUSTED_KEYS } from "./keys.js";

installBridge(vercelAdapter(), TRUSTED_KEYS);
