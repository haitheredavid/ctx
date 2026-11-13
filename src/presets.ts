import { constants } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isDirectory } from "./detect.ts";
import { composeLayers, findLayer } from "./packs.ts";
import { assertSafeWritePath, entryExists } from "./safe-fs.ts";

export async function applyPreset(opts: {
  preset: string;
  profile: string;
  target: string;
  force: boolean;
}): Promise<string[]> {
  const preset = await findLayer("preset", opts.preset);
  const profile = await findLayer("profile", opts.profile);
  const entries = await composeLayers(preset, profile);

  if ((await entryExists(opts.target)) && !(await isDirectory(opts.target))) {
    throw new Error(`${opts.target} is not a directory`);
  }
  for (const entry of entries) await assertSafeWritePath(opts.target, join(opts.target, entry.rel));

  if (!opts.force) {
    const conflicts: string[] = [];
    for (const entry of entries) {
      if (await entryExists(join(opts.target, entry.rel))) conflicts.push(entry.rel);
    }
    if (conflicts.length > 0) {
      throw new Error(`refusing to overwrite existing files (use --force):\n  ${conflicts.join("\n  ")}`);
    }
  }

  const createdFiles: string[] = [];
  const createdDirs: string[] = [];
  try {
    for (const entry of entries) {
      const dest = join(opts.target, entry.rel);
      const firstCreated = await mkdir(dirname(dest), { recursive: true });
      if (firstCreated !== undefined) createdDirs.push(firstCreated);
      const existed = opts.force && (await entryExists(dest));
      await copyFile(entry.source, dest, opts.force ? 0 : constants.COPYFILE_EXCL);
      if (!existed) createdFiles.push(dest);
    }
  } catch (error) {
    for (const file of createdFiles) await rm(file, { force: true });
    for (const dir of createdDirs.reverse()) await rm(dir, { recursive: true, force: true });
    throw error;
  }
  return entries.map((entry) => entry.rel);
}
