import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pkg from "../package.json" with { type: "json" };
import { exists } from "../src/detect.ts";

const CLI_PATH = join(import.meta.dir, "..", "src", "cli.ts");

const MISE_TOML = `[tools]
node = "26"

[tasks.test]
description = "Run tests"
run = "pnpm test"
`;

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "ctx-"));
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

test("scaffold with an unknown preset fails", async () => {
  const { code, stderr } = await ctx("scaffold", tmp, "--preset", "nope");
  expect(code).toBe(1);
  expect(stderr.startsWith("error: unknown preset 'nope'")).toBe(true);
  expect(await readdir(tmp)).toEqual([]);
});

test("extra positionals are rejected", async () => {
  const { code, stderr } = await ctx("new", "a", "b");
  expect(code).toBe(1);
  expect(stderr).toContain("error: unexpected argument 'b'");
  expect(await readdir(tmp)).toEqual([]);
});

test("flags are validated per command", async () => {
  const { code, stderr } = await ctx("list", "--write");
  expect(code).toBe(1);
  expect(stderr).toContain("error: option '--write' is not valid for 'list'");
});

test("scaffold requires an existing directory", async () => {
  const missing = join(tmp, "missing");
  const { code, stderr } = await ctx("scaffold", missing, "--write");
  expect(code).toBe(1);
  expect(stderr).toContain("error: ");
  expect(stderr).toContain("is not a directory");
  expect(await exists(missing)).toBe(false);
});

test("scaffold dry-run with a preset prints the header and skips mise.toml when the repo has one", async () => {
  await writeFile(join(tmp, "mise.toml"), MISE_TOML);
  const { code, stdout } = await ctx("scaffold", tmp, "--preset", "api-ts");
  expect(code).toBe(0);
  const lines = stdout.split("\n");
  const accepted = [tmp, await realpath(tmp)].map((path) => `dry-run: ${path} (preset api-ts, profile local)`);
  expect(accepted).toContain(lines[0] as string);
  expect(lines.filter((line) => line.endsWith("mise.toml"))).toEqual([]);
});

test("scaffold without a preset prints the default profile", async () => {
  const { code, stdout } = await ctx("scaffold", tmp);
  expect(code).toBe(0);
  const accepted = [tmp, await realpath(tmp)].map((path) => `dry-run: ${path} (profile local)`);
  expect(accepted).toContain(stdout.split("\n")[0] as string);
});

test("scaffold with an unknown profile fails before writing", async () => {
  const { code, stderr } = await ctx("scaffold", tmp, "--profile", "nope");
  expect(code).toBe(1);
  expect(stderr.startsWith("error: unknown profile 'nope'")).toBe(true);
  expect(await readdir(tmp)).toEqual([]);
});

test("--version and -V print the package version", async () => {
  for (const flag of ["--version", "-V"]) {
    const { code, stdout } = await ctx(flag);
    expect(code).toBe(0);
    expect(stdout).toBe(`${pkg.version}\n`);
  }
});
