import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { defaultProfile, listLayers, loadConfig } from "../src/packs.ts";
import { applyPreset } from "../src/presets.ts";
import { scaffold } from "../src/scaffold.ts";

let tmp: string;
const savedConfig = process.env.CTX_CONFIG;

beforeEach(async () => {
  tmp = await mkdtemp(join(tmpdir(), "ctx-packs-"));
});

afterEach(async () => {
  process.env.CTX_CONFIG = savedConfig;
  await rm(tmp, { recursive: true, force: true });
});

async function useConfig(toml: string): Promise<void> {
  const path = join(tmp, "config.toml");
  await writeFile(path, toml);
  process.env.CTX_CONFIG = path;
}

async function writeTeamPack(): Promise<void> {
  const profile = join(tmp, "pack", "profiles", "team");
  await mkdir(join(profile, ".context", "guides"), { recursive: true });
  await mkdir(join(profile, "scripts"), { recursive: true });
  await writeFile(join(tmp, "pack", "profiles", "profiles.json"), '{"team":"Team"}\n');
  await writeFile(join(profile, ".context", "guides", "doc-lifecycle.md"), "TEAM\n");
  await writeFile(join(profile, "scripts", "publish.sh"), "#!/bin/sh\necho publish\n");
  await chmod(join(profile, "scripts", "publish.sh"), 0o755);
  await useConfig('packs = ["./pack"]\n');
}

test("an external profile overrides core files and adds executable scripts", async () => {
  await writeTeamPack();

  const target = join(tmp, "new");
  await applyPreset({ preset: "python", profile: "team", target, force: false });
  expect(await readFile(join(target, ".context", "guides", "doc-lifecycle.md"), "utf8")).toBe("TEAM\n");
  expect(await exists(join(target, ".context", "guides", "writing-briefs.md"))).toBe(true);
  expect(await exists(join(target, ".context", "active", ".gitkeep"))).toBe(false);
  expect((await stat(join(target, "scripts", "publish.sh"))).mode & 0o111).not.toBe(0);

  const repo = join(tmp, "repo");
  await mkdir(repo);
  await scaffold({
    target: repo,
    write: true,
    force: false,
    agentShim: false,
    claudeShim: false,
    packageOverlays: false,
    profile: "team",
  });
  expect(await readFile(join(repo, ".context", "guides", "doc-lifecycle.md"), "utf8")).toBe("TEAM\n");
  expect((await stat(join(repo, "scripts", "publish.sh"))).mode & 0o111).not.toBe(0);
});

test("the longest configured directory picks the default profile", async () => {
  await useConfig(`[profiles]\n"${join(tmp, "work")}" = "team"\n`);
  expect(await defaultProfile(join(tmp, "work", "repo"))).toBe("team");
  expect(await defaultProfile(join(tmp, "work"))).toBe("team");
  expect(await defaultProfile(join(tmp, "workshop"))).toBe("local");
});

test("a pack preset that collides with a builtin is rejected", async () => {
  await mkdir(join(tmp, "pack", "presets", "python"), { recursive: true });
  await useConfig('packs = ["./pack"]\n');
  await expect(listLayers("preset")).rejects.toThrow("duplicate preset 'python'");
});

test("packs must be an array of strings", async () => {
  await useConfig('packs = "x"\n');
  await expect(loadConfig()).rejects.toThrow("packs must be an array of strings");
});

test("a missing pack directory is rejected", async () => {
  await useConfig('packs = ["./missing"]\n');
  await expect(loadConfig()).rejects.toThrow("ctx pack not found:");
});
