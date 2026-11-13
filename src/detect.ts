import { access, readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

export type PackageJson = {
  name?: string;
  description?: string;
  packageManager?: string;
  type?: string;
  workspaces?: string[] | { packages?: string[] };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  engines?: Record<string, string>;
};

export type TsConfig = {
  compilerOptions?: {
    strict?: boolean;
    module?: string;
    moduleResolution?: string;
    target?: string;
    jsx?: string;
    noEmit?: boolean;
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
};

export type WorkspaceInfo = {
  dir: string;
  relDir: string;
  packageName: string;
  description: string;
  scripts: Record<string, string>;
};

export type MiseInfo = {
  file: string;
  tools: [string, string][];
  tasks: { name: string; summary: string }[];
};

export async function detectMise(target: string): Promise<MiseInfo | null> {
  for (const file of ["mise.toml", ".mise.toml"]) {
    const parsed = await readToml(join(target, file));
    if (!parsed) continue;

    const rawTools = isTable(parsed.tools) ? parsed.tools : {};
    const tools = Object.entries(rawTools).map(([name, value]): [string, string] => [name, formatToolVersion(value)]);

    const rawTasks = isTable(parsed.tasks) ? parsed.tasks : {};
    const tasks: MiseInfo["tasks"] = [];
    for (const [name, value] of Object.entries(rawTasks)) {
      if (typeof value === "string") {
        tasks.push({ name, summary: `see ${file}` });
        continue;
      }
      if (!isTable(value) || value.hide === true) continue;
      tasks.push({ name, summary: summarizeTask(value, file) });
    }
    tasks.sort((a, b) => a.name.localeCompare(b.name));
    return { file, tools, tasks };
  }
  return null;
}

function formatToolVersion(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(", ");
  if (isTable(value) && "version" in value) return String(value.version);
  return JSON.stringify(value);
}

function summarizeTask(task: Record<string, unknown>, file: string): string {
  if (typeof task.description === "string") return task.description;
  if (Array.isArray(task.depends)) return `runs ${task.depends.join(", ")}`;
  return `see ${file}`;
}

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type McpServer = {
  file: string;
  name: string;
  transport: "stdio" | "http" | "sse" | "unknown";
  command?: string;
};

export type Skill = { name: string; path: string; description: string };

const MCP_SOURCES: { file: string; format: "json" | "toml"; key: string }[] = [
  { file: ".mcp.json", format: "json", key: "mcpServers" },
  { file: ".cursor/mcp.json", format: "json", key: "mcpServers" },
  { file: ".vscode/mcp.json", format: "json", key: "servers" },
  { file: ".codex/config.toml", format: "toml", key: "mcp_servers" },
];

const SKILL_ROOTS = [".claude/skills", ".agents/skills"];

// Only name, transport, and command basename leave this function: args, env, headers, and URLs routinely hold tokens.
export async function detectMcp(target: string): Promise<McpServer[]> {
  const servers: McpServer[] = [];
  for (const source of MCP_SOURCES) {
    let text: string;
    try {
      text = await readFile(join(target, source.file), "utf8");
    } catch (error) {
      if (isNotFound(error)) continue;
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = source.format === "json" ? Bun.JSONC.parse(text) : Bun.TOML.parse(text);
    } catch {
      // Parser messages can echo file contents (tokens), so never include them.
      throw new Error(`Failed to parse MCP config ${source.file}`);
    }
    const entries = isTable(parsed) ? parsed[source.key] : undefined;
    if (!isTable(entries)) continue;
    for (const [name, entry] of Object.entries(entries)) {
      servers.push({ file: source.file, name, ...classifyMcpServer(entry) });
    }
  }
  return servers;
}

function classifyMcpServer(entry: unknown): Pick<McpServer, "transport" | "command"> {
  if (!isTable(entry)) return { transport: "unknown" };
  if (typeof entry.command === "string") return { transport: "stdio", command: commandName(entry.command) };
  if (entry.type === "sse") return { transport: "sse" };
  const isHttp =
    entry.type === "http" ||
    entry.type === "streamable-http" ||
    typeof entry.url === "string" ||
    typeof entry.httpUrl === "string" ||
    typeof entry.serverUrl === "string";
  return { transport: isHttp ? "http" : "unknown" };
}

function commandName(command: string): string | undefined {
  const first = command.trim().split(/\s+/)[0] ?? "";
  const name = first.split(/[/\\]/).pop() ?? "";
  return /^[\w.+@-]+$/.test(name) ? name : undefined;
}

export async function detectSkills(target: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  for (const rootRel of SKILL_ROOTS) {
    const root = join(target, rootRel);
    if (!(await isDirectory(root))) continue;
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || !(await isDirectory(join(root, entry.name)))) continue;
      const skillFile = join(root, entry.name, "SKILL.md");
      if (!(await exists(skillFile))) continue;
      const meta = parseFrontmatter(await readFile(skillFile, "utf8"));
      skills.push({
        name: meta.name || entry.name,
        path: relative(target, skillFile),
        description: summarizeDescription(meta.description),
      });
    }
  }
  return skills.sort((a, b) => a.path.localeCompare(b.path));
}

function summarizeDescription(value: string | undefined): string {
  const collapsed = (value ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return "(no description)";
  return collapsed.length > 120 ? `${collapsed.slice(0, 117)}...` : collapsed;
}

// Minimal YAML frontmatter reader: flat `key: value` pairs plus indented block/folded/plain continuations.
function parseFrontmatter(raw: string): Record<string, string> {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!text.startsWith("---\n")) return {};
  const lines = text.slice(4).split("\n");
  const end = lines.indexOf("---");
  if (end === -1) return {};
  const body = lines.slice(0, end);
  const result: Record<string, string> = {};
  for (let i = 0; i < body.length; i++) {
    const match = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(body[i] as string);
    if (!match) continue;
    const key = match[1] as string;
    let value = (match[2] as string).trim();
    const isBlock = ["", ">", "|", ">-", "|-"].includes(value);
    const parts: string[] = isBlock ? [] : [value];
    for (;;) {
      let j = i + 1;
      if (isBlock) while (j < body.length && (body[j] as string).trim() === "") j++;
      if (!/^\s+\S/.test(body[j] ?? "")) break;
      i = j;
      parts.push((body[i] as string).trim());
    }
    value = parts.join(" ");
    const quoted = /^(["'])(.*)\1$/.exec(value);
    result[key] = quoted ? (quoted[2] as string) : value;
  }
  return result;
}

export async function readToml(path: string): Promise<Record<string, unknown> | null> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
  try {
    return Bun.TOML.parse(text) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Failed to read TOML ${path}: ${(error as Error).message}`);
  }
}

export async function formatDetectedConfigs(target: string): Promise<string> {
  const names = [
    "package.json",
    "mise.toml",
    ".mise.toml",
    ".tool-versions",
    "hk.pkl",
    "bun.lock",
    ".mcp.json",
    ".cursor/mcp.json",
    ".vscode/mcp.json",
    ".codex/config.toml",
    "tsconfig.json",
    "tsconfig.base.json",
    "biome.json",
    "biome.jsonc",
    "eslint.config.js",
    "eslint.config.mjs",
    "vitest.config.ts",
    "vitest.config.mts",
    "jest.config.js",
    "playwright.config.ts",
    "justfile",
    "Makefile",
  ];
  const found: string[] = [];
  for (const name of names) {
    if (await exists(join(target, name))) found.push(`- \`${name}\``);
  }
  return found.length > 0 ? found.join("\n") : "- No common config files detected.";
}

export async function detectPackageManager(target: string, rootPackage: PackageJson): Promise<string> {
  const declared = rootPackage.packageManager?.split("@")[0];
  if (declared) return declared;
  if ((await exists(join(target, "bun.lock"))) || (await exists(join(target, "bun.lockb")))) return "bun";
  if (await exists(join(target, "pnpm-lock.yaml"))) return "pnpm";
  if (await exists(join(target, "yarn.lock"))) return "yarn";
  if (await exists(join(target, "package-lock.json"))) return "npm";
  return "npm";
}

export async function detectWorkspaces(target: string, rootPackage: PackageJson): Promise<WorkspaceInfo[]> {
  const patterns = Array.isArray(rootPackage.workspaces)
    ? rootPackage.workspaces
    : (rootPackage.workspaces?.packages ?? []);
  const results: WorkspaceInfo[] = [];
  for (const pattern of patterns) {
    const dirs = await expandWorkspacePattern(target, pattern);
    for (const dir of dirs) {
      const pkg = await readJson<PackageJson>(join(dir, "package.json"));
      if (!pkg) continue;
      results.push({
        dir,
        relDir: relative(target, dir),
        packageName: pkg.name ?? relative(target, dir),
        description: pkg.description ?? "TODO: describe package ownership.",
        scripts: pkg.scripts ?? {},
      });
    }
  }
  return results.sort((a, b) => a.relDir.localeCompare(b.relDir));
}

export async function expandWorkspacePattern(target: string, pattern: string): Promise<string[]> {
  const realTarget = await realpath(target);
  const insideTarget = async (dir: string) => {
    const rel = relative(realTarget, await realpath(dir));
    return !(rel === ".." || rel.startsWith("../") || rel.startsWith("..\\") || isAbsolute(rel));
  };
  const normalized = pattern.replace(/\\/g, "/");
  if (!normalized.includes("*")) {
    const dir = join(target, normalized);
    return (await isDirectory(dir)) && (await insideTarget(dir)) ? [dir] : [];
  }

  const starIndex = normalized.indexOf("*");
  const base = normalized.slice(0, starIndex).replace(/\/$/, "");
  const suffix = normalized.slice(starIndex + 1).replace(/^\//, "");
  const baseDir = join(target, base);
  if (!(await isDirectory(baseDir))) return [];

  const entries = await readdir(baseDir, { withFileTypes: true });
  const dirs: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const candidate = suffix ? join(baseDir, entry.name, suffix) : join(baseDir, entry.name);
    if ((await isDirectory(candidate)) && (await insideTarget(candidate))) dirs.push(candidate);
  }
  return dirs;
}

export function installFor(packageManager: string): string {
  if (packageManager === "bun") return "bun install";
  if (packageManager === "pnpm") return "pnpm install";
  if (packageManager === "yarn") return "yarn install";
  return "npm install";
}

export function runFor(packageManager: string, script: string): string {
  if (packageManager === "bun") return `bun run ${script}`;
  if (packageManager === "pnpm") return `pnpm run ${script}`;
  if (packageManager === "yarn") return `yarn ${script}`;
  return `npm run ${script}`;
}

export async function readFirstJson<T>(dir: string, names: string[]): Promise<T | null> {
  for (const name of names) {
    const value = await readJson<T>(join(dir, name));
    if (value) return value;
  }
  return null;
}

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const text = await readFile(path, "utf8");
    return JSON.parse(text) as T;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new Error(`Failed to read JSON ${path}: ${(error as Error).message}`);
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

export function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
