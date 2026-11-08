import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

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
    const path = join(target, file);
    let text: string;
    try {
      text = await readFile(path, "utf8");
    } catch (error) {
      if (isNotFound(error)) continue;
      throw error;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = Bun.TOML.parse(text) as Record<string, unknown>;
    } catch (error) {
      throw new Error(`Failed to read TOML ${path}: ${(error as Error).message}`);
    }

    const rawTools = isTable(parsed.tools) ? parsed.tools : {};
    const tools = Object.entries(rawTools).map(([name, value]): [string, string] => [name, formatToolVersion(value)]);

    const rawTasks = isTable(parsed.tasks) ? parsed.tasks : {};
    const tasks: MiseInfo["tasks"] = [];
    for (const [name, value] of Object.entries(rawTasks)) {
      if (typeof value === "string") {
        tasks.push({ name, summary: value });
        continue;
      }
      if (!isTable(value) || value.hide === true) continue;
      tasks.push({ name, summary: summarizeTask(value) });
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

function summarizeTask(task: Record<string, unknown>): string {
  if (typeof task.description === "string") return task.description;
  if (typeof task.run === "string") return task.run;
  if (Array.isArray(task.run)) return task.run.join(" && ");
  if (Array.isArray(task.depends)) return `runs ${task.depends.join(", ")}`;
  return "see mise.toml";
}

function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function formatDetectedConfigs(target: string): Promise<string> {
  const names = [
    "package.json",
    "mise.toml",
    ".mise.toml",
    ".tool-versions",
    "hk.pkl",
    "bun.lock",
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
  const normalized = pattern.replace(/\\/g, "/");
  if (!normalized.includes("*")) {
    const dir = join(target, normalized);
    return (await isDirectory(dir)) ? [dir] : [];
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
    if (await isDirectory(candidate)) dirs.push(candidate);
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
