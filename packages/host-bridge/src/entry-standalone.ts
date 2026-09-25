import { standaloneAdapter } from "./adapters/standalone.js";
import { installBridge } from "./bridge.js";
import { TRUSTED_KEYS } from "./keys.js";

installBridge(standaloneAdapter(), TRUSTED_KEYS);
