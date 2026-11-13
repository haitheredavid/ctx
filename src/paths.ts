import { dirname, join, resolve } from "node:path";

// Compiled binaries report import.meta.dir inside Bun's virtual filesystem ("/$bunfs/..." on unix,
// "B:/~BUN/..." on Windows); their presets/, profiles/, core/, and templates/ ship next to the executable instead.
const COMPILED = /^(\/\$bunfs\/|B:[\\/]~BUN[\\/])/.test(import.meta.dir);

export const CTX_ROOT = process.env.CTX_ROOT
  ? resolve(process.env.CTX_ROOT)
  : COMPILED
    ? dirname(process.execPath)
    : resolve(import.meta.dir, "..");
export const PRESETS_DIR = join(CTX_ROOT, "presets");
export const PROFILES_DIR = join(CTX_ROOT, "profiles");
export const CORE_DIR = join(CTX_ROOT, "core");
export const TEMPLATES_DIR = join(CTX_ROOT, "templates", "agent-context");
export const AGENTS_DIR = join(CTX_ROOT, "agents");
export const COMMANDS_DIR = join(CTX_ROOT, "commands");
