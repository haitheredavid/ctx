import { afterEach, beforeEach, expect, test } from "bun:test";
import { appendFile, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { AGENTS_DIR, COMMANDS_DIR } from "../src/paths.ts";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "ctx-agents-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

async function ctx(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn([process.execPath, CLI_PATH, ...args], { cwd: tmp, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { code, stdout, stderr };
}

const install = (...args: string[]) => ctx("agents", "install", "--home", tmp, ...args);
const linesStarting = (stdout: string, prefix: string) => stdout.split("\n").filter((l) => l.startsWith(prefix));

test("dry-run lists every file and writes nothing", async () => {
  const { code, stdout } = await install();
  expect(code).toBe(0);
  expect(linesStarting(stdout, "would create:")).toHaveLength(24);
  expect(await readdir(tmp)).toEqual([]);
});

test("--write renders each harness's native format", async () => {
  expect((await install("--write")).code).toBe(0);
  const claudeWriter = await readFile(join(tmp, ".claude/agents/ctx-writer.md"), "utf8");
  expect(claudeWriter).toContain("tools: Read, Grep, Glob, Bash, Write, Edit");
  expect(claudeWriter).toContain("model: inherit");
  const ompWriter = await readFile(join(tmp, ".omp/agent/agents/ctx-writer.md"), "utf8");
  expect(ompWriter).toContain('model: "@plan"');
  expect(ompWriter).toContain("spawns: scout");
  const devinStandards = await readFile(join(tmp, ".config/devin/agents/ctx-standards.md"), "utf8");
  expect(devinStandards).toContain("  - exec");
  expect(devinStandards).not.toMatch(/^model:/m);
  const devinBrief = await readFile(join(tmp, ".config/devin/skills/ctx-brief/SKILL.md"), "utf8");
  expect(devinBrief).not.toContain("$ARGUMENTS");
  expect(devinBrief).toContain("`/ctx-brief`");
  expect(await readFile(join(tmp, ".claude/commands/ctx-brief.md"), "utf8")).toContain("$ARGUMENTS");
});

test("reinstall is unchanged; edited files are skipped unless --force", async () => {
  await install("--write");
  const path = join(tmp, ".claude/agents/ctx-writer.md");
  const original = await readFile(path, "utf8");
  expect(linesStarting((await install("--write")).stdout, "unchanged:")).toHaveLength(24);

  await appendFile(path, "x");
  const skipped = await install("--write");
  expect(skipped.stdout).toContain("skip exists: ~/.claude/agents/ctx-writer.md");
  expect(await readFile(path, "utf8")).toBe(`${original}x`);

  const forced = await install("--write", "--force");
  expect(forced.stdout).toContain("overwrote: ~/.claude/agents/ctx-writer.md");
  expect(await readFile(path, "utf8")).toBe(original);
});

test("--harness limits the install to that harness", async () => {
  expect((await install("--harness", "devin", "--write")).code).toBe(0);
  expect(await readdir(tmp)).toEqual([".config"]);
});

test("an unknown harness fails", async () => {
  const { code, stderr } = await install("--harness", "nope");
  expect(code).toBe(1);
  expect(stderr).toContain("unknown harness 'nope'");
});

test("--force refuses a symlinked target before writing anything", async () => {
  const outside = join(tmp, "outside.md");
  await writeFile(outside, "keep\n");
  await mkdir(join(tmp, ".claude/agents"), { recursive: true });
  await symlink(outside, join(tmp, ".claude/agents/ctx-writer.md"));
  const { code, stderr } = await install("--write", "--force");
  expect(code).toBe(1);
  expect(stderr).toContain("refusing to write through symlink");
  expect(await exists(join(tmp, ".omp"))).toBe(false);
  expect(await readFile(outside, "utf8")).toBe("keep\n");
});

test("manifests describe exactly the body files", async () => {
  for (const [dir, manifest] of [
    [AGENTS_DIR, "agents.json"],
    [COMMANDS_DIR, "commands.json"],
  ] as const) {
    const keys = Object.keys(JSON.parse(await readFile(join(dir, manifest), "utf8"))).sort();
    const bodies = (await readdir(dir))
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3))
      .sort();
    expect(keys).toEqual(bodies);
  }
});
