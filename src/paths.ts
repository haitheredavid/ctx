import { join, resolve } from "node:path";

export const CTX_ROOT = resolve(import.meta.dir, "..");
export const PRESETS_DIR = join(CTX_ROOT, "presets");
export const TEMPLATES_DIR = join(CTX_ROOT, "templates", "agent-context");
