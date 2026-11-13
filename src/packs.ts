import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { isDirectory, readJson, readToml } from "./detect.ts";
import { CORE_DIR, CTX_ROOT } from "./paths.ts";

export type LayerKind = "preset" | "profile";
export type Layer = { kind: LayerKind; name: string; description: string; dir: string; pack: string };
export type LayerEntry = { rel: string; source: string };
export type CtxConfig = { path: string; packs: string[]; profiles: { dir: string; profile: string }[] };

export const DEFAULT_PROFILE = "local";

export function configPath(): string {
  if (process.env.CTX_CONFIG) return process.env.CTX_CONFIG;
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "ctx", "config.toml");
}

export async function loadConfig(): Promise<CtxConfig> {
  const path = configPath();
  const raw = await readToml(path);
  if (!raw) return { path, packs: [], profiles: [] };

  const packs = raw.packs ?? [];
  if (!Array.isArray(packs) || !packs.every((pack) => typeof pack === "string")) {
    throw new Error(`invalid ctx config ${path}: packs must be an array of strings`);
  }
  const profiles = raw.profiles ?? {};
  if (
    typeof profiles !== "object" ||
    profiles === null ||
    Array.isArray(profiles) ||
    !Object.values(profiles).every((profile) => typeof profile === "string")
  ) {
    throw new Error(`invalid ctx config ${path}: profiles must map directories to profile names`);
  }

  const resolvedPacks: string[] = [];
  for (const pack of packs as string[]) {
    const dir = expandPath(pack, path);
    if (!(await isDirectory(dir))) throw new Error(`ctx pack not found: ${dir} (from ${path})`);
    resolvedPacks.push(dir);
  }
  return {
    path,
    packs: resolvedPacks,
    profiles: Object.entries(profiles as Record<string, string>).map(([dir, profile]) => ({
      dir: expandPath(dir, path),
      profile,
    })),
  };
}

// `~` expands to the home directory; other relative paths resolve against the config file's directory.
function expandPath(value: string, configFile: string): string {
  if (value === "~") return homedir();
  if (value.startsWith("~/")) return join(homedir(), value.slice(2));
  return resolve(dirname(configFile), value);
}

export async function listLayers(kind: LayerKind): Promise<Layer[]> {
  const config = await loadConfig();
  const roots = [...new Set([CTX_ROOT, ...config.packs].map((root) => resolve(root)))];
  const layers: Layer[] = [];
  for (const root of roots) {
    const dir = join(root, `${kind}s`);
    if (!(await isDirectory(dir))) continue;
    const manifest = (await readJson<Record<string, string>>(join(dir, `${kind}s.json`))) ?? {};
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const existing = layers.find((layer) => layer.name === entry.name);
      if (existing) throw new Error(`duplicate ${kind} '${entry.name}' in ${existing.pack} and ${root}`);
      layers.push({
        kind,
        name: entry.name,
        description: manifest[entry.name] ?? "(no description)",
        dir: join(dir, entry.name),
        pack: root,
      });
    }
  }
  return layers.sort((a, b) => a.name.localeCompare(b.name));
}

export async function findLayer(kind: LayerKind, name: string): Promise<Layer> {
  const layers = await listLayers(kind);
  const layer = layers.find((l) => l.name === name);
  if (!layer) {
    const names = layers.map((l) => l.name);
    throw new Error(`unknown ${kind} '${name}'. Available: ${names.join(", ")}`);
  }
  return layer;
}

// The longest configured directory containing the target wins.
export async function defaultProfile(target: string): Promise<string> {
  const config = await loadConfig();
  const dir = resolve(target);
  const match = [...config.profiles]
    .sort((a, b) => b.dir.length - a.dir.length)
    .find((entry) => dir === entry.dir || dir.startsWith(entry.dir + sep));
  return match?.profile ?? DEFAULT_PROFILE;
}

export async function layerEntries(dir: string): Promise<LayerEntry[]> {
  if (!(await isDirectory(dir))) return [];
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name !== ".DS_Store")
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .sort()
    .map((rel) => ({ rel, source: join(dir, rel) }));
}

// Later layers replace earlier ones at the same relative path.
export function mergeLayers(...layers: LayerEntry[][]): LayerEntry[] {
  const merged = new Map<string, LayerEntry>();
  for (const layer of layers) for (const entry of layer) merged.set(entry.rel, entry);
  return [...merged.values()].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
}

export async function composeLayers(base: Layer, profile: Layer): Promise<LayerEntry[]> {
  return mergeLayers(await layerEntries(CORE_DIR), await layerEntries(base.dir), await layerEntries(profile.dir));
}
