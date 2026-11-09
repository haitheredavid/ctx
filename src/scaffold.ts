import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import {
  detectMcp,
  detectMise,
  detectPackageManager,
  detectSkills,
  detectWorkspaces,
  exists,
  formatDetectedConfigs,
  installFor,
  type McpServer,
  type MiseInfo,
  type PackageJson,
  readFirstJson,
  readJson,
  runFor,
  type Skill,
  type TsConfig,
  type WorkspaceInfo,
} from "./detect.ts";
import { TEMPLATES_DIR } from "./paths.ts";
import { findPreset, type Preset, presetFiles } from "./presets.ts";
import { assertSafeWritePath, entryExists } from "./safe-fs.ts";

export type ScaffoldOptions = {
  target: string;
  write: boolean;
  force: boolean;
  agentShim: boolean;
  packageOverlays: boolean;
  preset?: string;
};

const COMMAND_SCOPE_NOTE =
  "Do not overstate command scope. If a command only runs part of the suite, say that exactly.";

export type ScaffoldResult = { relPath: string; action: "create" | "overwrite" | "skip"; content: string };

type PlannedFile = { path: string; content: string };

const GENERATED_ARTIFACTS = ["dist", "build", "coverage", "node_modules", ".turbo", ".next", ".vite", ".cache", "out"];

const SECRET_PATHS = [
  ".env",
  ".env.* except .env.example",
  ".secrets",
  "*.pem",
  "*.key",
  "*.p12",
  "infra/params/*.local.json",
  "copied certs",
  "raw provider payload dumps",
];

export async function scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult[]> {
  const target = opts.target;
  const preset = opts.preset !== undefined ? await findPreset(opts.preset) : null;
  const rootPackage = (await readJson<PackageJson>(join(target, "package.json"))) ?? {};
  const tsConfig = await readFirstJson<TsConfig>(target, ["tsconfig.json", "tsconfig.base.json"]);
  const packageManager = await detectPackageManager(target, rootPackage);
  const workspaces = await detectWorkspaces(target, rootPackage);
  const mise = await detectMise(target);
  const mcpServers = await detectMcp(target);
  const skills = await detectSkills(target);
  const context = await buildContext(
    target,
    rootPackage,
    tsConfig,
    packageManager,
    workspaces,
    mise,
    mcpServers,
    skills,
  );

  const files = preset ? await planPresetFiles(target, preset, context, mise) : await planGenericFiles(target, context);

  if (opts.agentShim) {
    files.push({ path: join(target, "AGENT.md"), content: render(await loadTemplate("AGENT.md.tmpl"), context) });
  }

  if (opts.packageOverlays) {
    const overlayTemplate = await loadTemplate("package-AGENTS.md.tmpl");
    for (const workspace of workspaces) {
      files.push({
        path: join(workspace.dir, "AGENTS.md"),
        content: render(overlayTemplate, {
          ...context,
          packageName: clean(workspace.packageName),
          packageDir: clean(workspace.relDir),
          packageDescription: clean(workspace.description),
          packageCommands: formatCommands(workspace.scripts, packageManager, clean(workspace.relDir)),
        }),
      });
    }
  }

  return applyPlan(target, files, opts);
}

async function planGenericFiles(target: string, context: Record<string, string>): Promise<PlannedFile[]> {
  return [
    { path: join(target, "AGENTS.md"), content: render(await loadTemplate("AGENTS.md.tmpl"), context) },
    {
      path: join(target, ".context", "project-context.md"),
      content: render(await loadTemplate("project-context.md.tmpl"), context),
    },
    {
      path: join(target, ".context", "engineering-guide.md"),
      content: render(await loadTemplate("engineering-guide.md.tmpl"), context),
    },
    {
      path: join(target, ".context", "writing-specs.md"),
      content: render(await loadTemplate("writing-specs.md.tmpl"), context),
    },
    {
      path: join(target, ".context", "writing-dds.md"),
      content: render(await loadTemplate("writing-dds.md.tmpl"), context),
    },
    {
      path: join(target, ".context", "writing-tdds.md"),
      content: render(await loadTemplate("writing-tdds.md.tmpl"), context),
    },
    { path: join(target, ".context", "README.md"), content: render(await loadTemplate("README.md.tmpl"), context) },
    { path: join(target, ".context", "active", ".gitkeep"), content: "" },
  ];
}

// With a repo mise config, its tasks are the source of truth: preset Commands sections are replaced with the
// detected commands and the preset's mise.toml is never planned (not even with --force).
async function planPresetFiles(
  target: string,
  preset: Preset,
  context: Record<string, string>,
  mise: MiseInfo | null,
): Promise<PlannedFile[]> {
  const commandsBody = `${context.toolchain}\n\n${context.commands}\n\n${COMMAND_SCOPE_NOTE}`;
  const files: PlannedFile[] = [];
  for (const rel of await presetFiles(preset)) {
    if (mise && rel === "mise.toml") continue;
    let content = await readFile(join(preset.dir, rel), "utf8");
    if (rel === "AGENTS.md") {
      content = replaceSection(content, "MCP Servers", context.mcpServers ?? "");
      content = replaceSection(content, "Skills", context.skills ?? "");
    }
    if (mise && (rel === "AGENTS.md" || rel === join(".context", "engineering-guide.md"))) {
      content = replaceSection(content, "Commands", commandsBody);
    }
    files.push({ path: join(target, rel), content });
  }
  return files;
}

function replaceSection(markdown: string, heading: string, body: string): string {
  const lines = markdown.split("\n");
  const start = lines.indexOf(`## ${heading}`);
  if (start === -1) throw new Error(`preset file missing section '## ${heading}'`);
  const nextOffset = lines.slice(start + 1).findIndex((line) => line.startsWith("## "));
  const before = lines.slice(0, start).join("\n");
  const prefix = start > 0 ? `${before}\n` : "";
  if (nextOffset === -1) return `${prefix}## ${heading}\n\n${body}\n`;
  const rest = lines.slice(start + 1 + nextOffset).join("\n");
  return `${prefix}## ${heading}\n\n${body}\n\n${rest}`;
}

async function applyPlan(target: string, files: PlannedFile[], opts: ScaffoldOptions): Promise<ScaffoldResult[]> {
  for (const file of files) await assertSafeWritePath(target, file.path);
  const results: ScaffoldResult[] = [];
  for (const file of files) {
    const relPath = relative(target, file.path) || file.path;
    const existsAlready = await entryExists(file.path);
    if (existsAlready && !opts.force) {
      results.push({ relPath, action: "skip", content: file.content });
      continue;
    }

    if (opts.write) {
      await mkdir(dirname(file.path), { recursive: true });
      await writeFile(file.path, ensureTrailingNewline(file.content), {
        encoding: "utf8",
        flag: opts.force ? "w" : "wx",
      });
    }
    results.push({ relPath, action: existsAlready ? "overwrite" : "create", content: file.content });
  }
  return results;
}

async function buildContext(
  target: string,
  rootPackage: PackageJson,
  tsConfig: TsConfig | null,
  packageManager: string,
  workspaces: WorkspaceInfo[],
  mise: MiseInfo | null,
  mcpServers: McpServer[],
  skills: Skill[],
): Promise<Record<string, string>> {
  const repoName = clean(rootPackage.name ?? basename(target) ?? "TODO_REPO_NAME");
  const repoDescription = clean(
    rootPackage.description ?? "TODO: describe what this repository builds and who uses it.",
  );
  const packageCommands = formatCommands(rootPackage.scripts ?? {}, packageManager, ".");
  const commands = await formatAllCommands(target, mise, packageManager, packageCommands);
  const workspaceTable = formatWorkspaceTable(workspaces);
  const workspaceSummary =
    workspaces.length > 0
      ? `${workspaces.length} workspace package${workspaces.length === 1 ? "" : "s"} detected.`
      : "No workspace packages detected from package.json.";
  const tsSummary = formatTsSummary(rootPackage, tsConfig);
  const tsRules = formatTsRules(rootPackage, tsConfig, packageManager);
  const testGuidance = formatTestGuidance(rootPackage, packageManager);
  const safetyRules = SECRET_PATHS.map((path) => `- Do not read or copy \`${path}\`.`).join("\n");
  const artifactRules = GENERATED_ARTIFACTS.map(
    (path) => `- Avoid editing generated/local artifacts: \`${path}\`.`,
  ).join("\n");
  const detectedConfigs = await formatDetectedConfigs(target);

  return {
    repoName,
    repoDescription,
    packageManager,
    toolchain: formatToolchain(mise),
    commands,
    workspaceTable,
    workspaceSummary,
    tsSummary,
    tsRules,
    testGuidance,
    safetyRules,
    artifactRules,
    detectedConfigs,
    mcpServers: formatMcp(mcpServers),
    skills: formatSkills(skills),
    generatedDate: new Date().toISOString().slice(0, 10),
  };
}

function formatMcp(servers: McpServer[]): string {
  if (servers.length === 0) {
    return "- TODO: no MCP config detected (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.codex/config.toml`). List servers agents may use here.";
  }
  const groups = new Map<string, McpServer[]>();
  for (const server of servers) groups.set(server.file, [...(groups.get(server.file) ?? []), server]);
  return [...groups]
    .map(([file, group]) => [`Configured in \`${clean(file)}\`:`, "", ...group.map(formatMcpServer)].join("\n"))
    .join("\n\n");
}

function formatMcpServer(server: McpServer): string {
  const name = clean(server.name);
  if (server.transport === "stdio") {
    return server.command === undefined
      ? `- \`${name}\` - stdio (custom command).`
      : `- \`${name}\` - stdio (\`${clean(server.command)}\`).`;
  }
  if (server.transport === "unknown") return `- \`${name}\` - transport not recognized; see \`${clean(server.file)}\`.`;
  return `- \`${name}\` - ${server.transport}.`;
}

function formatSkills(skills: Skill[]): string {
  if (skills.length === 0) {
    return "- TODO: no skills detected (`.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`). List skills agents should use here.";
  }
  return skills
    .map((skill) => `- \`${clean(skill.name)}\` (\`${clean(skill.path)}\`) - ${clean(skill.description)}`)
    .join("\n");
}

function formatToolchain(mise: MiseInfo | null): string {
  if (!mise) return "- TODO: no mise.toml detected; record runtime versions here (or add one with `mise use`).";
  const tools = mise.tools.map(([name, version]) => `\`${clean(name)} ${clean(version)}\``).join(", ");
  return `Pinned in \`${clean(mise.file)}\`: ${tools}. Run \`mise install\` first.`;
}

async function formatAllCommands(
  target: string,
  mise: MiseInfo | null,
  packageManager: string,
  packageCommands: string,
): Promise<string> {
  if (!mise || mise.tasks.length === 0) return packageCommands;
  const taskLines = mise.tasks.map((task) => `- \`mise run ${clean(task.name)}\` - ${clean(task.summary)}.`);
  const sections = [`Tasks (\`${clean(mise.file)}\`):`, "", ...taskLines];
  if (await exists(join(target, "package.json"))) {
    sections.push("", `Package scripts (\`${packageManager}\`):`, "", packageCommands);
  }
  return sections.join("\n");
}

function formatCommands(scripts: Record<string, string>, packageManager: string, scope: string): string {
  const lines: string[] = [];
  const installCommand = installFor(packageManager);
  if (scope === ".") lines.push(`- \`${installCommand}\` - install dependencies.`);

  for (const name of ["build", "typecheck", "lint", "format", "test", "dev", "start", "codegen"]) {
    if (scripts[name]) lines.push(`- \`${runFor(packageManager, name)}\` - package.json \`${clean(name)}\` script.`);
  }

  if (lines.length === 0) {
    return "- TODO: add verified commands from package.json, justfile, Makefile, or repo docs.";
  }

  const prefix =
    scope === "." ? "" : `From \`${scope}\`, or use a workspace filter from the repo root when supported.\n\n`;
  return `${prefix}${lines.join("\n")}`;
}

function formatWorkspaceTable(workspaces: WorkspaceInfo[]): string {
  if (workspaces.length === 0) {
    return "| Path | Package | Purpose |\n|------|---------|---------|\n| TODO | TODO | Add workspace map if this becomes a monorepo. |";
  }

  const rows = workspaces.map((workspace) => {
    return `| \`${clean(workspace.relDir)}\` | \`${clean(workspace.packageName)}\` | ${clean(workspace.description)} |`;
  });
  return ["| Path | Package | Purpose |", "|------|---------|---------|", ...rows].join("\n");
}

function formatTsSummary(rootPackage: PackageJson, tsConfig: TsConfig | null): string {
  const opts = tsConfig?.compilerOptions ?? {};
  const parts = [
    rootPackage.type ? `package type \`${rootPackage.type}\`` : "package type not declared",
    opts.strict === true
      ? "strict TypeScript enabled"
      : opts.strict === false
        ? "strict TypeScript disabled"
        : "strict mode not detected",
    opts.module ? `module \`${opts.module}\`` : "module not detected",
    opts.moduleResolution ? `moduleResolution \`${opts.moduleResolution}\`` : "moduleResolution not detected",
    opts.target ? `target \`${opts.target}\`` : "target not detected",
    opts.jsx ? `jsx \`${opts.jsx}\`` : "jsx not detected",
  ];
  return `${parts.join("; ")}.`;
}

function formatTsRules(rootPackage: PackageJson, tsConfig: TsConfig | null, _packageManager: string): string {
  const opts = tsConfig?.compilerOptions ?? {};
  const rules = [
    "- Preserve the repository's existing TypeScript module style and import suffix convention.",
    "- Use `import type` and `export type` for type-only symbols.",
    "- Keep runtime validation at external boundaries: HTTP, CLI args, env, files, queues, provider SDKs.",
    "- Prefer small, typed modules over broad utility files.",
    "- Keep public package APIs behind existing barrels only when the repo already uses barrels.",
  ];

  if (rootPackage.type === "module")
    rules.push("- Treat source as ESM unless a local package or config says otherwise.");
  if (opts.strict === true)
    rules.push("- Keep `strict` TypeScript clean; do not loosen compiler options to ship a change.");
  if (opts.moduleResolution === "NodeNext" || opts.moduleResolution === "Node16") {
    rules.push(
      "- NodeNext/Node16 projects usually require explicit runtime file extensions for relative imports; follow current source convention.",
    );
  }

  return rules.join("\n");
}

function formatTestGuidance(rootPackage: PackageJson, packageManager: string): string {
  const scripts = rootPackage.scripts ?? {};
  const deps = {
    ...(rootPackage.dependencies ?? {}),
    ...(rootPackage.devDependencies ?? {}),
    ...(rootPackage.peerDependencies ?? {}),
  };
  const lines = [
    scripts.test
      ? `- Default test command: \`${runFor(packageManager, "test")}\`. Verify scope before calling it full coverage.`
      : "- TODO: add default test command once tests exist.",
  ];

  if ("vitest" in deps) lines.push("- Vitest detected; keep tests close to source or in existing test folders.");
  if ("jest" in deps) lines.push("- Jest detected; preserve existing Jest config and transform setup.");
  if ("@playwright/test" in deps) {
    lines.push("- Playwright detected; keep browser tests isolated from unit tests unless scripts combine them.");
  }
  lines.push(
    "- Prefer real local behavior in tests; mock only network, filesystem, time, and other process boundaries.",
  );
  lines.push("- Reset env vars, singletons, mocks, and injected factories in test cleanup.");
  return lines.join("\n");
}

async function loadTemplate(name: string): Promise<string> {
  return readFile(join(TEMPLATES_DIR, name), "utf8");
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/{{([a-zA-Z0-9_]+)}}/g, (_, key: string) => values[key] ?? `TODO_${key}`);
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith("\n") ? value : `${value}\n`;
}

// Repo-detected strings must not break out of a markdown line or code span.
function clean(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .replaceAll("`", "")
    .trim();
}
