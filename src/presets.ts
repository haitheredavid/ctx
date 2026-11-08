import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { exists } from "./detect.ts";
import { PRESETS_DIR } from "./paths.ts";

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

export async function applyPreset(opts: { preset: string; target: string; force: boolean }): Promise<string[]> {
  const presets = await listPresets();
  const preset = presets.find((p) => p.name === opts.preset);
  if (!preset) {
    const names = presets.map((p) => p.name);
    throw new Error(`unknown preset '${opts.preset}'. Available: ${names.join(", ")}`);
  }

  const entries = await readdir(preset.dir, { recursive: true, withFileTypes: true });
  const relPaths = entries
    .filter((entry) => entry.isFile() && entry.name !== ".DS_Store")
    .map((entry) => relative(preset.dir, join(entry.parentPath, entry.name)))
    .sort();

  if (!opts.force) {
    const conflicts: string[] = [];
    for (const rel of relPaths) {
      if (await exists(join(opts.target, rel))) conflicts.push(rel);
    }
    if (conflicts.length > 0) {
      throw new Error(`refusing to overwrite existing files (use --force):\n  ${conflicts.join("\n  ")}`);
    }
  }

  for (const rel of relPaths) {
    const dest = join(opts.target, rel);
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(join(preset.dir, rel), dest);
  }
  return relPaths;
}
