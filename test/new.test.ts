import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { PRESETS_DIR } from "../src/paths.ts";
import { applyPreset } from "../src/presets.ts";

let tmp: string;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "ctx-"));
});

afterEach(async () => {
  await rm(tmp, { recursive: true, force: true });
});

test("creates the target dir and copies every preset file byte-for-byte", async () => {
  const target = join(tmp, "fresh");
  const created = await applyPreset({ preset: "python", target, force: false });

  expect(created).toContain(".context/active/.gitkeep");
  expect(created).toContain("mise.toml");
  expect(created).toContain(".devcontainer/devcontainer.json");
  for (const rel of created) {
    const [actual, expected] = await Promise.all([
      readFile(join(target, rel)),
      readFile(join(PRESETS_DIR, "python", rel)),
    ]);
    expect(actual.equals(expected)).toBe(true);
  }
});

test("refuses to overwrite and writes nothing when any destination exists", async () => {
  await mkdir(tmp, { recursive: true });
  await writeFile(join(tmp, "AGENTS.md"), "mine\n");

  await expect(applyPreset({ preset: "python", target: tmp, force: false })).rejects.toThrow("AGENTS.md");
  expect(await exists(join(tmp, "mise.toml"))).toBe(false);
  expect(await readFile(join(tmp, "AGENTS.md"), "utf8")).toBe("mine\n");
  expect((await readdir(tmp)).sort()).toEqual(["AGENTS.md"]);
});

test("refuses to write through a dangling symlink and creates nothing", async () => {
  const outside = join(tmp, "..", `outside-${crypto.randomUUID()}`);
  await symlink(outside, join(tmp, "AGENTS.md"));
  try {
    await expect(applyPreset({ preset: "python", target: tmp, force: true })).rejects.toThrow(
      "refusing to write through symlink",
    );
    expect(await exists(outside)).toBe(false);
    expect((await readdir(tmp)).sort()).toEqual(["AGENTS.md"]);
  } finally {
    await rm(outside, { force: true });
  }
});

test("rejects a target that is a file", async () => {
  const target = join(tmp, "file");
  await writeFile(target, "x");
  await expect(applyPreset({ preset: "python", target, force: false })).rejects.toThrow(`${target} is not a directory`);
});

test("force overwrites existing files with preset content", async () => {
  await writeFile(join(tmp, "AGENTS.md"), "mine\n");

  await applyPreset({ preset: "python", target: tmp, force: true });
  expect(await readFile(join(tmp, "AGENTS.md"), "utf8")).toBe(
    await readFile(join(PRESETS_DIR, "python", "AGENTS.md"), "utf8"),
  );
});

test("unknown preset lists available presets", async () => {
  const attempt = applyPreset({ preset: "nope", target: tmp, force: false });
  await expect(attempt).rejects.toThrow("unknown preset 'nope'");
  await expect(applyPreset({ preset: "nope", target: tmp, force: false })).rejects.toThrow("python");
});
