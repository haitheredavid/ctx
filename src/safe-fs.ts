import { lstat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";

// True when anything occupies `path`, including a dangling symlink (unlike `access`, which follows links).
export async function entryExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

// Throws unless `path` is lexically inside `root` and no existing component below `root` (the file itself
// included) is a symlink, so a write to `path` cannot be redirected outside `root`.
export async function assertSafeWritePath(root: string, path: string): Promise<void> {
  const rel = relative(root, path);
  if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`refusing to write outside ${root}: ${path}`);
  }
  let current = root;
  for (const part of rel.split(sep)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error(`refusing to write through symlink: ${current}`);
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
