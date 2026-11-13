import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { readJson } from "./detect.ts";
import { AGENTS_DIR, COMMANDS_DIR } from "./paths.ts";
import { assertSafeWritePath, entryExists } from "./safe-fs.ts";

export const HARNESSES = ["omp", "claude", "devin"] as const;
export type Harness = (typeof HARNESSES)[number];
type Tool = "read" | "grep" | "glob" | "find" | "bash" | "edit" | "write";
type AgentSpec = {
  description: string;
  role: "default" | "plan" | "review";
  thinking?: "high";
  tools: Tool[];
  spawns?: string;
};
type CommandSpec = { description: string; argumentHint: string };
export type AgentFile = { harness: Harness; path: string; content: string };
export type InstallAction = "create" | "overwrite" | "unchanged" | "skip";
export type InstallResult = { path: string; action: InstallAction };

const CLAUDE_TOOLS: Record<Tool, string | null> = {
  read: "Read",
  grep: "Grep",
  glob: "Glob",
  find: null,
  bash: "Bash",
  edit: "Edit",
  write: "Write",
};
const DEVIN_TOOLS: Record<Tool, string | null> = {
  read: "read",
  grep: "grep",
  glob: "glob",
  find: null,
  bash: "exec",
  edit: "edit",
  write: "edit",
};

export function harnessRoot(harness: Harness, home: string): string {
  switch (harness) {
    case "omp":
      return join(home, ".omp", "agent");
    case "claude":
      return join(home, ".claude");
    case "devin":
      return join(home, ".config", "devin");
  }
}

export async function renderAgentFiles(harnesses: readonly Harness[], home: string): Promise<AgentFile[]> {
  const agents = await loadSources<AgentSpec>(AGENTS_DIR, "agents.json");
  const commands = await loadSources<CommandSpec>(COMMANDS_DIR, "commands.json");
  const files: AgentFile[] = [];
  for (const harness of HARNESSES.filter((h) => harnesses.includes(h))) {
    const root = harnessRoot(harness, home);
    for (const { name, spec, body } of agents) {
      files.push({
        harness,
        path: join(root, "agents", `${name}.md`),
        content: renderAgent(harness, name, spec, body),
      });
    }
    for (const { name, spec, body } of commands) {
      const path = harness === "devin" ? join(root, "skills", name, "SKILL.md") : join(root, "commands", `${name}.md`);
      files.push({ harness, path, content: renderCommand(harness, name, spec, body) });
    }
  }
  return files;
}

export async function installAgents(opts: {
  harnesses: readonly Harness[];
  home: string;
  write: boolean;
  force: boolean;
}): Promise<InstallResult[]> {
  const files = await renderAgentFiles(opts.harnesses, opts.home);
  const planned: (InstallResult & { content: string })[] = [];
  for (const file of files) {
    const symlink = await isSymlink(file.path);
    if (symlink && !opts.force) {
      planned.push({ path: file.path, action: "skip", content: file.content });
      continue;
    }
    await assertSafeWritePath(harnessRoot(file.harness, opts.home), file.path);
    let action: InstallAction;
    if (!(await entryExists(file.path))) action = "create";
    else if ((await lstat(file.path)).isFile() && (await readFile(file.path, "utf8")) === file.content)
      action = "unchanged";
    else action = opts.force ? "overwrite" : "skip";
    planned.push({ path: file.path, action, content: file.content });
  }

  if (opts.write) {
    for (const { path, action, content } of planned) {
      if (action === "create") {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content, { flag: "wx" });
      } else if (action === "overwrite") {
        await writeFile(path, content);
      }
    }
  }
  return planned.map(({ path, action }) => ({ path, action }));
}

async function loadSources<T>(dir: string, manifest: string): Promise<{ name: string; spec: T; body: string }[]> {
  const manifestPath = join(dir, manifest);
  const specs = await readJson<Record<string, T>>(manifestPath);
  if (!specs) throw new Error(`missing manifest ${manifestPath}`);
  const sources: { name: string; spec: T; body: string }[] = [];
  for (const name of Object.keys(specs).sort()) {
    const spec = specs[name] as T;
    sources.push({ name, spec, body: await readFile(join(dir, `${name}.md`), "utf8") });
  }
  return sources;
}

function renderAgent(harness: Harness, name: string, spec: AgentSpec, body: string): string {
  const lines = [`name: ${name}`, `description: ${JSON.stringify(spec.description)}`];
  if (harness === "omp") {
    lines.push(`model: ${JSON.stringify(`@${spec.role}`)}`);
    if (spec.thinking) lines.push(`thinking-level: ${spec.thinking}`);
    lines.push(`tools: ${spec.tools.join(", ")}`);
    if (spec.spawns) lines.push(`spawns: ${spec.spawns}`);
  } else if (harness === "claude") {
    lines.push(`tools: ${mapTools(spec.tools, CLAUDE_TOOLS).join(", ")}`, "model: inherit");
  } else {
    lines.push("allowed-tools:", ...mapTools(spec.tools, DEVIN_TOOLS).map((tool) => `  - ${tool}`));
  }
  return frontmatter(lines, body);
}

function renderCommand(harness: Harness, name: string, spec: CommandSpec, body: string): string {
  const meta = [
    `description: ${JSON.stringify(spec.description)}`,
    `argument-hint: ${JSON.stringify(spec.argumentHint)}`,
  ];
  if (harness !== "devin") return frontmatter(meta, body);
  const text = body.replaceAll("$ARGUMENTS", `the text the user gave after \`/${name}\``);
  return frontmatter([`name: ${name}`, ...meta, "triggers:", "  - user"], text);
}

function mapTools(tools: readonly Tool[], table: Record<Tool, string | null>): string[] {
  const mapped: string[] = [];
  for (const tool of tools) {
    const name = table[tool];
    if (name !== null && !mapped.includes(name)) mapped.push(name);
  }
  return mapped;
}

function frontmatter(lines: readonly string[], body: string): string {
  return `---\n${lines.join("\n")}\n---\n\n${body.trimEnd()}\n`;
}

async function isSymlink(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isSymbolicLink();
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
