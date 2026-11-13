import { tmpdir } from "node:os";
import { join } from "node:path";

// Point ctx at a config path that never exists so tests never read the user's real config.
process.env.CTX_CONFIG = join(tmpdir(), `ctx-no-config-${process.pid}`, "config.toml");
