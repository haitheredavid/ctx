import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { PRESETS_DIR } from "../src/paths.ts";
import { type ScaffoldOptions, type ScaffoldResult, scaffold } from "../src/scaffold.ts";

const BASE_FILES = [
  ".context/README.md",
  ".context/active/.gitkeep",
  ".context/guides/context-maintenance.md",
  ".context/guides/doc-lifecycle.md",
  ".context/guides/engineering.md",
  ".context/guides/pull-requests.md",
  ".context/guides/writing-briefs.md",
  ".context/guides/writing-designs.md",
  ".context/guides/writing-specs.md",
  ".context/project-context.md",
  "AGENTS.md",
];

const MISE_TOML = `[tools]
node = "26"

[tasks.test]
description = "Run tests"
run = "pnpm test"

[tasks.secret]
hide = true
run = "x"
`;

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "ctx-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

function opts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    target: tmp,
    write: false,
    force: false,
    agentShim: false,
    claudeShim: false,
    packageOverlays: false,
    profile: "local",
    ...overrides,
  };
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value));
}

async function monorepoFixture(): Promise<void> {
  await writeJson(join(tmp, "package.json"), {
    name: "demo",
    packageManager: "pnpm@12.0.0",
    workspaces: ["packages/*"],
    scripts: { test: "vitest" },
  });
  await mkdir(join(tmp, "packages", "a"), { recursive: true });
  await writeJson(join(tmp, "packages", "a", "package.json"), { name: "@demo/a", description: "A pkg" });
  await writeJson(join(tmp, "tsconfig.json"), { compilerOptions: { strict: true } });
  await writeFile(join(tmp, "mise.toml"), MISE_TOML);
}

function contentOf(results: ScaffoldResult[], relPath: string): string {
  const file = results.find((r) => r.relPath === relPath);
  if (!file) throw new Error(`${relPath} not planned`);
  return file.content;
}

function agentsContent(results: ScaffoldResult[]): string {
  return contentOf(results, "AGENTS.md");
}

function allContent(results: ScaffoldResult[]): string {
  return results.map((r) => r.content).join("\n");
}

async function writeSkill(root: string, dir: string, text: string): Promise<void> {
  await mkdir(join(tmp, root, "skills", dir), { recursive: true });
  await writeFile(join(tmp, root, "skills", dir, "SKILL.md"), text);
}

test("dry-run renders mise tasks, tools, package scripts, and workspaces without writing", async () => {
  await monorepoFixture();
  const results = await scaffold(opts());
  const content = agentsContent(results);

  expect(content).toContain("`mise run test` - Run tests.");
  expect(content).toContain("`node 26`");
  expect(content).toContain("`pnpm run test`");
  expect(content).toContain("`packages/a`");
  expect(content).not.toContain("mise run secret");
  for (const rel of BASE_FILES) expect(await exists(join(tmp, rel))).toBe(false);
});

test("write creates, rerun skips, force overwrites", async () => {
  await monorepoFixture();

  const first = await scaffold(opts({ write: true }));
  expect(first.map((r) => [r.relPath, r.action])).toEqual(BASE_FILES.map((rel) => [rel, "create"]));
  for (const rel of BASE_FILES) expect(await exists(join(tmp, rel))).toBe(true);
  const generated = await readFile(join(tmp, "AGENTS.md"), "utf8");

  const second = await scaffold(opts({ write: true }));
  expect(second.map((r) => r.action)).toEqual(BASE_FILES.map(() => "skip"));

  await writeFile(join(tmp, "AGENTS.md"), "hand edited\n");
  const third = await scaffold(opts({ write: true, force: true }));
  expect(third.find((r) => r.relPath === "AGENTS.md")?.action).toBe("overwrite");
  expect(await readFile(join(tmp, "AGENTS.md"), "utf8")).toBe(generated);
});

test("claude shim plans CLAUDE.md importing AGENTS.md, skips it unless forced", async () => {
  const dry = await scaffold(opts({ claudeShim: true }));
  expect(contentOf(dry, "CLAUDE.md")).toBe("@AGENTS.md\n");
  expect(await exists(join(tmp, "CLAUDE.md"))).toBe(false);

  await writeFile(join(tmp, "CLAUDE.md"), "hand edited\n");
  const skipped = await scaffold(opts({ claudeShim: true, write: true }));
  expect(skipped.find((r) => r.relPath === "CLAUDE.md")?.action).toBe("skip");
  expect(await readFile(join(tmp, "CLAUDE.md"), "utf8")).toBe("hand edited\n");

  const forced = await scaffold(opts({ claudeShim: true, write: true, force: true }));
  expect(forced.find((r) => r.relPath === "CLAUDE.md")?.action).toBe("overwrite");
  expect(await readFile(join(tmp, "CLAUDE.md"), "utf8")).toBe("@AGENTS.md\n");
});

test("bun lockfile without mise uses bun commands and a toolchain TODO", async () => {
  await writeFile(join(tmp, "bun.lock"), "");
  await writeJson(join(tmp, "package.json"), { scripts: { build: "x" } });

  const content = agentsContent(await scaffold(opts()));
  expect(content).toContain("bun install");
  expect(content).toContain("bun run build");
  expect(content).toContain("no mise.toml detected");
});

test("malformed mise.toml is reported", async () => {
  await writeFile(join(tmp, "mise.toml"), "[tools");
  await expect(scaffold(opts())).rejects.toThrow("Failed to read TOML");
});

test("MCP servers are listed by name and transport without leaking args, env, or URLs", async () => {
  await writeJson(join(tmp, ".mcp.json"), {
    mcpServers: {
      github: {
        command: "/usr/local/bin/npx",
        args: ["-y", "pkg", "--token", "argsecret"],
        env: { GITHUB_TOKEN: "envsecret" },
      },
      remote: { type: "http", url: "https://mcp.example.com/?token=urlsecret" },
      stream: { type: "sse", url: "https://x" },
    },
  });

  const content = agentsContent(await scaffold(opts()));
  expect(content).toContain("Configured in `.mcp.json`:");
  expect(content).toContain("- `github` - stdio (`npx`).");
  expect(content).toContain("- `remote` - http.");
  expect(content).toContain("- `stream` - sse.");
  for (const secret of ["argsecret", "envsecret", "urlsecret"]) expect(content).not.toContain(secret);
});

test("Codex TOML MCP servers are detected", async () => {
  await mkdir(join(tmp, ".codex"));
  await writeFile(join(tmp, ".codex", "config.toml"), '[mcp_servers.docs]\ncommand = "uvx"\n');
  expect(agentsContent(await scaffold(opts()))).toContain("- `docs` - stdio (`uvx`).");
});

test("skills are listed from frontmatter, falling back to directory name", async () => {
  await mkdir(join(tmp, ".claude", "skills", "deploy"), { recursive: true });
  await writeFile(
    join(tmp, ".claude", "skills", "deploy", "SKILL.md"),
    "---\nname: deploy\ndescription: >\n  Ship it\n  to prod.\n---\nbody",
  );
  await mkdir(join(tmp, ".agents", "skills", "lint-fix"), { recursive: true });
  await writeFile(join(tmp, ".agents", "skills", "lint-fix", "SKILL.md"), "# Lint fix\n");

  const content = agentsContent(await scaffold(opts()));
  expect(content).toContain("- `deploy` (`.claude/skills/deploy/SKILL.md`) - Ship it to prod.");
  expect(content).toContain("- `lint-fix` (`.agents/skills/lint-fix/SKILL.md`) - (no description)");
});

test("empty repo gets MCP and skills TODOs", async () => {
  const content = agentsContent(await scaffold(opts()));
  expect(content).toContain("no MCP config detected");
  expect(content).toContain("no skills detected");
});

test("preset with repo mise.toml uses repo commands and skips preset mise.toml", async () => {
  await writeFile(join(tmp, "mise.toml"), MISE_TOML);
  await writeJson(join(tmp, ".mcp.json"), { mcpServers: { gh: { command: "npx" } } });

  const results = await scaffold(opts({ preset: "api-ts" }));
  const relPaths = results.map((r) => r.relPath);
  expect(relPaths).not.toContain("mise.toml");
  expect(relPaths).toContain(".devcontainer/devcontainer.json");

  const content = agentsContent(results);
  expect(content).toContain("## Stack");
  expect(content).toContain("Hono");
  expect(content).toContain("- `mise run test` - Run tests.");
  expect(content).toContain("- `gh` - stdio (`npx`).");
  expect(content).not.toContain("mise run openapi:export");
  expect(content).not.toContain("- TODO: list MCP servers");

  const guide = contentOf(results, ".context/guides/engineering.md");
  expect(guide).toContain("`mise run test` - Run tests.");
  expect(guide).not.toContain("openapi:export");
  expect(await exists(join(tmp, "AGENTS.md"))).toBe(false);
});

test("preset without repo mise.toml keeps preset commands and plans its mise.toml", async () => {
  const results = await scaffold(opts({ preset: "api-ts" }));
  expect(results.find((r) => r.relPath === "mise.toml")?.action).toBe("create");
  expect(agentsContent(results)).toContain("mise run openapi:export");
});

test("unknown preset is rejected", async () => {
  await expect(scaffold(opts({ preset: "nope" }))).rejects.toThrow("unknown preset 'nope'");
});

test("preset '' is treated as a preset name and rejected", async () => {
  await expect(scaffold(opts({ preset: "" }))).rejects.toThrow("unknown preset ''");
});

test("MCP command keeps only the first token's basename", async () => {
  await writeJson(join(tmp, ".mcp.json"), { mcpServers: { x: { command: "npx -y pkg --token cmdsecret" } } });

  const results = await scaffold(opts());
  expect(agentsContent(results)).toContain("- `x` - stdio (`npx`).");
  expect(allContent(results)).not.toContain("cmdsecret");
});

test("Cursor and JSONC VS Code MCP configs are grouped in source order without headers", async () => {
  await mkdir(join(tmp, ".cursor"));
  await writeJson(join(tmp, ".cursor", "mcp.json"), { mcpServers: { c: {} } });
  await mkdir(join(tmp, ".vscode"));
  await writeFile(
    join(tmp, ".vscode", "mcp.json"),
    `{
  // VS Code allows comments and trailing commas
  "servers": {
    "v": { "type": "http", "url": "https://v.example.com", "headers": { "Authorization": "Bearer hdrsecret" }, },
  },
}
`,
  );

  const results = await scaffold(opts());
  const content = agentsContent(results);
  const cursor = content.indexOf("Configured in `.cursor/mcp.json`:");
  const vscode = content.indexOf("Configured in `.vscode/mcp.json`:");
  expect(cursor).toBeGreaterThanOrEqual(0);
  expect(vscode).toBeGreaterThan(cursor);
  expect(content).toContain("- `c` - transport not recognized; see `.cursor/mcp.json`.");
  expect(content).toContain("- `v` - http.");
  expect(allContent(results)).not.toContain("hdrsecret");
});

test("malformed Codex MCP config is reported without parser text", async () => {
  await mkdir(join(tmp, ".codex"));
  await writeFile(join(tmp, ".codex", "config.toml"), '[mcp_servers.x]\ncommand = "ghp_secret\n');

  const error = await scaffold(opts()).then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("Failed to parse MCP config .codex/config.toml");
});

test("mise run commands and package script bodies never reach generated content", async () => {
  await writeFile(join(tmp, "mise.toml"), '[tasks.boot]\nrun = "TOKEN=runsecret x"\n');
  await writeJson(join(tmp, "package.json"), { scripts: { dev: "API_KEY=scriptsecret tsx" } });

  const content = allContent(await scaffold(opts()));
  expect(content).not.toContain("runsecret");
  expect(content).not.toContain("scriptsecret");
});

test("write refuses to follow a dangling AGENTS.md symlink", async () => {
  const outside = join(tmp, "..", `outside-${crypto.randomUUID()}`);
  await symlink(outside, join(tmp, "AGENTS.md"));
  try {
    await expect(scaffold(opts({ write: true }))).rejects.toThrow("refusing to write through symlink");
    expect(await exists(outside)).toBe(false);
  } finally {
    await rm(outside, { force: true });
  }
});

test("package overlays skip workspaces outside the target", async () => {
  const repo = join(tmp, "repo");
  const sibling = join(tmp, "sibling");
  await mkdir(repo);
  await mkdir(sibling);
  await writeJson(join(sibling, "package.json"), { name: "sibling" });
  await writeJson(join(repo, "package.json"), { name: "root", workspaces: ["../sibling"] });

  await scaffold(opts({ target: repo, write: true, packageOverlays: true }));
  expect(await exists(join(repo, "AGENTS.md"))).toBe(true);
  expect(await exists(join(sibling, "AGENTS.md"))).toBe(false);
});

test("preset with repo mise.toml never touches it, even with force, and keeps preset headings", async () => {
  await writeFile(join(tmp, "mise.toml"), MISE_TOML);

  const results = await scaffold(opts({ preset: "api-ts", write: true, force: true }));
  expect(results.map((r) => r.relPath)).not.toContain("mise.toml");
  expect(await readFile(join(tmp, "mise.toml"), "utf8")).toBe(MISE_TOML);

  for (const rel of ["AGENTS.md", ".context/guides/engineering.md"]) {
    const [planned, source] = [contentOf(results, rel), await readFile(join(PRESETS_DIR, "api-ts", rel), "utf8")].map(
      (text) => text.split("\n").filter((line) => line.startsWith("## ")),
    );
    expect(planned).toEqual(source);
  }
});

test("skill name comes from frontmatter, not the directory", async () => {
  await writeSkill(".claude", "deploy-dir", "---\nname: deploy\ndescription: Ship it.\n---\n");
  expect(agentsContent(await scaffold(opts()))).toContain(
    "- `deploy` (`.claude/skills/deploy-dir/SKILL.md`) - Ship it.",
  );
});

test("CRLF frontmatter is parsed", async () => {
  await writeSkill(".claude", "win", "---\r\nname: crlf\r\ndescription: Windows endings.\r\n---\r\nbody\r\n");
  expect(agentsContent(await scaffold(opts()))).toContain(
    "- `crlf` (`.claude/skills/win/SKILL.md`) - Windows endings.",
  );
});

test("frontmatter without a closing fence is ignored", async () => {
  await writeSkill(".claude", "open", "---\nname: other\ndescription: Never closed.\n");
  const content = agentsContent(await scaffold(opts()));
  expect(content).toContain("- `open` (`.claude/skills/open/SKILL.md`) - (no description)");
  expect(content).not.toContain("Never closed.");
});

test("long skill descriptions are truncated to 120 characters", async () => {
  await writeSkill(".agents", "long", `---\ndescription: ${"x".repeat(130)}\n---\n`);
  expect(agentsContent(await scaffold(opts()))).toContain(
    `- \`long\` (\`.agents/skills/long/SKILL.md\`) - ${"x".repeat(117)}...\n`,
  );
});
