import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { exists } from "../src/detect.ts";
import { composeLayers, findLayer, layerEntries } from "../src/packs.ts";
import { CORE_DIR, CTX_ROOT, PRESETS_DIR, PROFILES_DIR, TEMPLATES_DIR } from "../src/paths.ts";

const presetDirs = (await readdir(PRESETS_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const profileDirs = (await readdir(PROFILES_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const REQUIRED_FILES = [
  "AGENTS.md",
  ".context/project-context.md",
  ".context/guides/engineering.md",
  ".devcontainer/devcontainer.json",
  "mise.toml",
];

async function miseTasks(preset: string): Promise<Record<string, unknown>> {
  const parsed = Bun.TOML.parse(await readFile(join(PRESETS_DIR, preset, "mise.toml"), "utf8")) as {
    tasks?: Record<string, unknown>;
  };
  return parsed.tasks ?? {};
}

const headings = (text: string) => text.split("\n").filter((line) => line.startsWith("#"));

function slug(heading: string): string {
  return heading
    .replace(/^#+\s*/, "")
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replaceAll(" ", "-");
}

test("presets.json describes exactly the preset directories", async () => {
  const manifest = JSON.parse(await readFile(join(PRESETS_DIR, "presets.json"), "utf8")) as Record<string, string>;
  expect(Object.keys(manifest).sort()).toEqual(presetDirs);
});

test("profiles.json describes exactly the profile directories", async () => {
  const manifest = JSON.parse(await readFile(join(PROFILES_DIR, "profiles.json"), "utf8")) as Record<string, string>;
  expect(Object.keys(manifest).sort()).toEqual(profileDirs);
});

test("presets, templates, core, and profiles are ASCII-only", async () => {
  const offenders: string[] = [];
  for (const root of [PRESETS_DIR, TEMPLATES_DIR, CORE_DIR, PROFILES_DIR]) {
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.name === ".DS_Store") continue;
      const path = join(entry.parentPath, entry.name);
      if (/[^ -~\t\n\r]/.test(await readFile(path, "utf8"))) offenders.push(path);
    }
  }
  expect(offenders).toEqual([]);
});

test("ctx's own guides keep core and local profile headings", async () => {
  const pairs: [string, string][] = [
    ...["writing-briefs", "writing-designs", "writing-specs", "context-maintenance", "pull-requests"].map(
      (name): [string, string] => [
        join(CTX_ROOT, ".context", "guides", `${name}.md`),
        join(CORE_DIR, ".context", "guides", `${name}.md`),
      ],
    ),
    [
      join(CTX_ROOT, ".context", "guides", "doc-lifecycle.md"),
      join(PROFILES_DIR, "local", ".context", "guides", "doc-lifecycle.md"),
    ],
  ];
  for (const [own, source] of pairs) {
    expect(headings(await readFile(own, "utf8"))).toEqual(headings(await readFile(source, "utf8")));
  }
});

describe.each(presetDirs)("preset %s", (preset) => {
  test("ships every required file", async () => {
    const missing: string[] = [];
    for (const file of REQUIRED_FILES) {
      if (!(await exists(join(PRESETS_DIR, preset, file)))) missing.push(file);
    }
    expect(missing).toEqual([]);
  });

  test("ships no file that core or the local profile owns", async () => {
    const owned = new Set(
      [...(await layerEntries(CORE_DIR)), ...(await layerEntries(join(PROFILES_DIR, "local")))].map((e) => e.rel),
    );
    const shadowed = (await layerEntries(join(PRESETS_DIR, preset))).map((e) => e.rel).filter((rel) => owned.has(rel));
    expect(shadowed).toEqual([]);
  });

  test("every relative markdown link and anchor resolves in core + preset + local", async () => {
    const entries = await composeLayers(await findLayer("preset", preset), await findLayer("profile", "local"));
    const rels = entries.map((e) => e.rel);
    const sources = new Map(entries.map((e) => [e.rel, e.source]));
    const broken: string[] = [];
    for (const { rel, source } of entries) {
      if (!rel.endsWith(".md")) continue;
      const text = await readFile(source, "utf8");
      for (const match of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        const target = match[1] as string;
        if (/^[a-z]+:/.test(target)) continue;
        const [path = "", anchor] = target.split("#");
        let file = rel;
        if (path !== "") {
          file = normalize(join(dirname(rel), path)).replace(/\/$/, "");
          if (!rels.includes(file) && !rels.some((r) => r.startsWith(`${file}/`))) {
            broken.push(`${preset}:${rel} -> ${target}`);
            continue;
          }
        }
        if (anchor === undefined) continue;
        const targetSource = sources.get(file);
        const slugs = targetSource ? headings(await readFile(targetSource, "utf8")).map(slug) : [];
        if (!slugs.includes(anchor)) broken.push(`${preset}:${rel} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });

  test("mise.toml defines a check task", async () => {
    expect(await miseTasks(preset)).toHaveProperty("check");
  });

  test("every documented `mise run` task exists in mise.toml", async () => {
    const tasks = await miseTasks(preset);
    const undefinedTasks: string[] = [];
    for (const doc of ["AGENTS.md", ".context/guides/engineering.md"]) {
      const text = await readFile(join(PRESETS_DIR, preset, doc), "utf8");
      for (const match of text.matchAll(/mise run ([\w:-]+)/g)) {
        const name = match[1] as string;
        if (!(name in tasks)) undefinedTasks.push(`${doc}: ${name}`);
      }
    }
    expect(undefinedTasks).toEqual([]);
  });

  test("devcontainer installs mise", async () => {
    const config = JSON.parse(
      await readFile(join(PRESETS_DIR, preset, ".devcontainer", "devcontainer.json"), "utf8"),
    ) as { features?: Record<string, unknown> };
    expect(config.features).toHaveProperty(["ghcr.io/devcontainers-extra/features/mise:1"]);
  });

  test("AGENTS.md has MCP and Skills sections before Where To Edit; one Commands section in AGENTS.md and guide", async () => {
    const lines = (await readFile(join(PRESETS_DIR, preset, "AGENTS.md"), "utf8")).split("\n");
    const where = lines.indexOf("## Where To Edit");
    for (const heading of ["## MCP Servers", "## Skills"]) {
      expect(lines.filter((line) => line === heading)).toHaveLength(1);
      expect(lines.indexOf(heading)).toBeLessThan(where);
    }
    expect(lines.filter((line) => line === "## Commands")).toHaveLength(1);
    const guide = (await readFile(join(PRESETS_DIR, preset, ".context", "guides", "engineering.md"), "utf8")).split(
      "\n",
    );
    expect(guide.filter((line) => line === "## Commands")).toHaveLength(1);
  });
});
