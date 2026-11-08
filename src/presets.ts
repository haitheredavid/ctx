import { constants } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { isDirectory } from "./detect.ts";
import { PRESETS_DIR } from "./paths.ts";
import { assertSafeWritePath, entryExists } from "./safe-fs.ts";

export type Preset = { name: string; description: string; dir: string };

export async function listPresets(): Promise<Preset[]> {
  const manifest = JSON.parse(await readFile(join(PRESETS_DIR, "presets.json"), "utf8")) as Record<string, string>;
  const entries = await readdir(PRESETS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      description: manifest[entry.name] ?? "(no description)",
      dir: join(PRESETS_DIR, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function findPreset(name: string): Promise<Preset> {
  const presets = await listPresets();
  const preset = presets.find((p) => p.name === name);
  if (!preset) {
    const names = presets.map((p) => p.name);
    throw new Error(`unknown preset '${name}'. Available: ${names.join(", ")}`);
  }
  return preset;
}

export async function presetFiles(preset: Preset): Promise<string[]> {
  const entries = await readdir(preset.dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name !== ".DS_Store")
    .map((entry) => relative(preset.dir, join(entry.parentPath, entry.name)))
    .sort();
}

export async function applyPreset(opts: { preset: string; target: string; force: boolean }): Promise<string[]> {
  const preset = await findPreset(opts.preset);
  const relPaths = await presetFiles(preset);

  if ((await entryExists(opts.target)) && !(await isDirectory(opts.target))) {
    throw new Error(`${opts.target} is not a directory`);
  }
  for (const rel of relPaths) await assertSafeWritePath(opts.target, join(opts.target, rel));

  if (!opts.force) {
    const conflicts: string[] = [];
    for (const rel of relPaths) {
      if (await entryExists(join(opts.target, rel))) conflicts.push(rel);
    }
    if (conflicts.length > 0) {
      throw new Error(`refusing to overwrite existing files (use --force):\n  ${conflicts.join("\n  ")}`);
    }
  }

  const createdFiles: string[] = [];
  const createdDirs: string[] = [];
  try {
    for (const rel of relPaths) {
      const dest = join(opts.target, rel);
      const firstCreated = await mkdir(dirname(dest), { recursive: true });
      if (firstCreated !== undefined) createdDirs.push(firstCreated);
      const existed = opts.force && (await entryExists(dest));
      await copyFile(join(preset.dir, rel), dest, opts.force ? 0 : constants.COPYFILE_EXCL);
      if (!existed) createdFiles.push(dest);
    }
  } catch (error) {
    for (const file of createdFiles) await rm(file, { force: true });
    for (const dir of createdDirs.reverse()) await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return relPaths;
}
