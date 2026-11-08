import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import {
  detectMise,
  detectPackageManager,
  detectWorkspaces,
  exists,
  formatDetectedConfigs,
  installFor,
  type MiseInfo,
  type PackageJson,
  readFirstJson,
  readJson,
  runFor,
  type TsConfig,
  type WorkspaceInfo,
} from "./detect.ts";
import { TEMPLATES_DIR } from "./paths.ts";

export type ScaffoldOptions = {
  target: string;
  write: boolean;
  force: boolean;
  agentShim: boolean;
  packageOverlays: boolean;
};

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
  const rootPackage = (await readJson<PackageJson>(join(target, "package.json"))) ?? {};
  const tsConfig = await readFirstJson<TsConfig>(target, ["tsconfig.json", "tsconfig.base.json"]);
  const packageManager = await detectPackageManager(target, rootPackage);
  const workspaces = await detectWorkspaces(target, rootPackage);
  const mise = await detectMise(target);
  const context = await buildContext(target, rootPackage, tsConfig, packageManager, workspaces, mise);

  const files: PlannedFile[] = [
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
      path: join(target, ".context", "writing-tdds.md"),
      content: render(await loadTemplate("writing-tdds.md.tmpl"), context),
    },
    { path: join(target, ".context", "README.md"), content: render(await loadTemplate("README.md.tmpl"), context) },
    { path: join(target, ".context", "active", ".gitkeep"), content: "" },
  ];

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
          packageName: workspace.packageName,
          packageDir: workspace.relDir,
          packageDescription: workspace.description,
          packageCommands: formatCommands(workspace.scripts, packageManager, workspace.relDir),
        }),
      });
    }
  }

  return applyPlan(target, files, opts);
}

async function applyPlan(target: string, files: PlannedFile[], opts: ScaffoldOptions): Promise<ScaffoldResult[]> {
  const results: ScaffoldResult[] = [];
  for (const file of files) {
    const relPath = relative(target, file.path) || file.path;
    const existsAlready = await exists(file.path);
    if (existsAlready && !opts.force) {
      results.push({ relPath, action: "skip", content: file.content });
      continue;
    }

    if (opts.write) {
      await mkdir(dirname(file.path), { recursive: true });
      await writeFile(file.path, ensureTrailingNewline(file.content), "utf8");
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
): Promise<Record<string, string>> {
  const repoName = rootPackage.name ?? basename(target) ?? "TODO_REPO_NAME";
  const repoDescription = rootPackage.description ?? "TODO: describe what this repository builds and who uses it.";
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
    generatedDate: new Date().toISOString().slice(0, 10),
  };
}

function formatToolchain(mise: MiseInfo | null): string {
  if (!mise) return "- TODO: no mise.toml detected; record runtime versions here (or add one with `mise use`).";
  const tools = mise.tools.map(([name, version]) => `\`${name} ${version}\``).join(", ");
  return `Pinned in \`${mise.file}\`: ${tools}. Run \`mise install\` first.`;
}

async function formatAllCommands(
  target: string,
  mise: MiseInfo | null,
  packageManager: string,
  packageCommands: string,
): Promise<string> {
  if (!mise || mise.tasks.length === 0) return packageCommands;
  const taskLines = mise.tasks.map((task) => `- \`mise run ${task.name}\` - ${task.summary}.`);
  const sections = [`Tasks (\`${mise.file}\`):`, "", ...taskLines];
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
    if (scripts[name]) lines.push(`- \`${runFor(packageManager, name)}\` - runs \`${scripts[name]}\`.`);
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
    return `| \`${workspace.relDir}\` | \`${workspace.packageName}\` | ${workspace.description} |`;
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
