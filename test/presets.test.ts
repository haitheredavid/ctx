import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { CTX_ROOT, PRESETS_DIR, TEMPLATES_DIR } from "../src/paths.ts";

const presetDirs = (await readdir(PRESETS_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const REQUIRED_FILES = [
  "AGENTS.md",
  ".context/README.md",
  ".context/project-context.md",
  ".context/engineering-guide.md",
  ".context/writing-specs.md",
  ".context/writing-dds.md",
  ".context/writing-tdds.md",
  ".context/active/.gitkeep",
  ".devcontainer/devcontainer.json",
  "mise.toml",
];

async function miseTasks(preset: string): Promise<Record<string, unknown>> {
  const parsed = Bun.TOML.parse(await readFile(join(PRESETS_DIR, preset, "mise.toml"), "utf8")) as {
    tasks?: Record<string, unknown>;
  };
  return parsed.tasks ?? {};
}

test("presets.json describes exactly the preset directories", async () => {
  const manifest = JSON.parse(await readFile(join(PRESETS_DIR, "presets.json"), "utf8")) as Record<string, string>;
  expect(Object.keys(manifest).sort()).toEqual(presetDirs);
});

test("presets and agent-context templates are ASCII-only", async () => {
  const offenders: string[] = [];
  for (const root of [PRESETS_DIR, TEMPLATES_DIR]) {
    for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || entry.name === ".DS_Store") continue;
      const path = join(entry.parentPath, entry.name);
      if (/[^ -~\t\n\r]/.test(await readFile(path, "utf8"))) offenders.push(path);
    }
  }
  expect(offenders).toEqual([]);
});

test("ctx's own design guides keep template headings", async () => {
  for (const guide of ["writing-specs.md", "writing-dds.md", "writing-tdds.md"]) {
    const headings = (text: string) => text.split("\n").filter((line) => line.startsWith("#"));
    const own = await readFile(join(CTX_ROOT, ".context", guide), "utf8");
    const template = await readFile(join(TEMPLATES_DIR, `${guide}.tmpl`), "utf8");
    expect(headings(own)).toEqual(headings(template));
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

  test("mise.toml defines a check task", async () => {
    expect(await miseTasks(preset)).toHaveProperty("check");
  });

  test("every documented `mise run` task exists in mise.toml", async () => {
    const tasks = await miseTasks(preset);
    const undefinedTasks: string[] = [];
    for (const doc of ["AGENTS.md", ".context/engineering-guide.md"]) {
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
    const guide = (await readFile(join(PRESETS_DIR, preset, ".context", "engineering-guide.md"), "utf8")).split("\n");
    expect(guide.filter((line) => line === "## Commands")).toHaveLength(1);
  });

  test("design guides and .context README match generic templates byte-for-byte", async () => {
    for (const guide of ["README.md", "writing-specs.md", "writing-dds.md", "writing-tdds.md"]) {
      const presetText = await readFile(join(PRESETS_DIR, preset, ".context", guide), "utf8");
      const templateText = await readFile(join(TEMPLATES_DIR, `${guide}.tmpl`), "utf8");
      expect(presetText).toBe(templateText);
    }
  });
});
