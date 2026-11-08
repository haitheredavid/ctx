import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { applyPreset, listPresets, type Preset } from "./presets.ts";
import { type ScaffoldOptions, scaffold } from "./scaffold.ts";

const USAGE = `Usage: ctx <command> [options]

Commands:
  list                         List available presets.
  new <dir> [options]          Copy a preset into <dir> (created if missing).
    --preset <name>            Preset to apply. Prompts when omitted and stdin is a TTY.
    --force                    Overwrite existing files.
  scaffold [repo] [options]    Generate agent context from repo metadata. Default repo is current directory.
    --write                    Write files. Default is dry-run.
    --force                    Overwrite existing files.
    --preset <name>            Use a preset's stack docs; repo commands replace preset commands when it has mise.toml.
    --agent-shim               Also generate AGENT.md as a compatibility shim.
    --package-overlays         Generate AGENTS.md inside detected workspace packages.
  help                         Show this help.

Base files: AGENTS.md, .context/{project-context,engineering-guide,writing-tdds,README}.md,
and .context/active/ (an empty, tracked folder for dated in-flight design docs).
`;

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      preset: { type: "string" },
      force: { type: "boolean" },
      write: { type: "boolean" },
      "agent-shim": { type: "boolean" },
      "package-overlays": { type: "boolean" },
    },
  });
  const [command, ...rest] = positionals;

  if (values.help || command === undefined || command === "help") {
    console.log(USAGE);
    return;
  }

  switch (command) {
    case "list":
      return runList();
    case "new":
      return runNew(rest[0], values.preset, values.force ?? false);
    case "scaffold":
      return runScaffold(rest[0], {
        write: values.write ?? false,
        force: values.force ?? false,
        agentShim: values["agent-shim"] ?? false,
        packageOverlays: values["package-overlays"] ?? false,
        preset: values.preset,
      });
    default:
      console.error(`error: unknown command '${command}'`);
      console.error(USAGE);
      process.exitCode = 1;
  }
}

async function runList(): Promise<void> {
  const presets = await listPresets();
  const width = Math.max(...presets.map((p) => p.name.length));
  for (const preset of presets) console.log(`  ${preset.name.padEnd(width)}  ${preset.description}`);
}

async function runNew(dir: string | undefined, presetName: string | undefined, force: boolean): Promise<void> {
  if (!dir) throw new Error("ctx new requires a target directory");
  const target = resolve(process.cwd(), dir);
  const name = presetName ?? (await pickPreset(await listPresets()));

  const created = await applyPreset({ preset: name, target, force });
  for (const rel of created) console.log(`created: ${rel}`);
  console.log(`
Applied preset: ${name} -> ${target}

Next:
  cd ${target}
  mise trust && mise install
  grep -rn TODO AGENTS.md .context/ mise.toml`);
  if (!existsSync(join(target, ".git"))) {
    console.log(`  git init && git add -A && git commit -m "init from ctx preset ${name}"`);
  }
}

async function pickPreset(presets: Preset[]): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error(`no --preset given and stdin is not a TTY. Available: ${presets.map((p) => p.name).join(", ")}`);
  }
  const width = Math.max(...presets.map((p) => p.name.length));
  presets.forEach((preset, i) => {
    console.log(`  ${i + 1}) ${preset.name.padEnd(width)}  ${preset.description}`);
  });
  for (;;) {
    const answer = prompt(`Choice [1-${presets.length}]:`);
    if (answer === null) throw new Error("no preset chosen");
    const choice = Number(answer.trim());
    const preset = Number.isInteger(choice) ? presets[choice - 1] : undefined;
    if (preset) return preset.name;
    console.log("Invalid choice.");
  }
}

async function runScaffold(repo: string | undefined, opts: Omit<ScaffoldOptions, "target">): Promise<void> {
  const target = resolve(process.cwd(), repo ?? ".");
  const presetNote = opts.preset ? ` (preset ${opts.preset})` : "";
  console.log(`${opts.write ? "write" : "dry-run"}: ${target}${presetNote}`);
  const results = await scaffold({ target, ...opts });
  for (const result of results) {
    if (result.action === "skip") console.log(`skip exists: ${result.relPath}`);
    else if (!opts.write)
      console.log(`${result.action === "overwrite" ? "would overwrite" : "would create"}: ${result.relPath}`);
    else console.log(`${result.action === "overwrite" ? "overwrote" : "created"}: ${result.relPath}`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
