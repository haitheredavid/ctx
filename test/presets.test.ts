import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { PRESETS_DIR } from "../src/paths.ts";

const presetDirs = (await readdir(PRESETS_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const REQUIRED_FILES = [
  "AGENTS.md",
  ".context/README.md",
  ".context/project-context.md",
  ".context/engineering-guide.md",
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
});
