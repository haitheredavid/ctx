import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { type ScaffoldOptions, type ScaffoldResult, scaffold } from "../src/scaffold.ts";

const BASE_FILES = [
  "AGENTS.md",
  ".context/project-context.md",
  ".context/engineering-guide.md",
  ".context/writing-tdds.md",
  ".context/README.md",
  ".context/active/.gitkeep",
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
  return { target: tmp, write: false, force: false, agentShim: false, packageOverlays: false, ...overrides };
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

  const guide = contentOf(results, ".context/engineering-guide.md");
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
