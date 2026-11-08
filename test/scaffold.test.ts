import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { type ScaffoldOptions, scaffold } from "../src/scaffold.ts";

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

function agentsContent(results: Awaited<ReturnType<typeof scaffold>>): string {
  const agents = results.find((r) => r.relPath === "AGENTS.md");
  if (!agents) throw new Error("AGENTS.md not planned");
  return agents.content;
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
