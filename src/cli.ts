import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import pkg from "../package.json" with { type: "json" };
import { isDirectory } from "./detect.ts";
import { defaultProfile, findLayer, type Layer, listLayers } from "./packs.ts";
import { CTX_ROOT } from "./paths.ts";
import { applyPreset } from "./presets.ts";
import { type ScaffoldOptions, scaffold } from "./scaffold.ts";

const USAGE = `Usage: ctx <command> [options]

Commands:
  list                         List presets and profiles.
  new <dir> [options]          Copy a preset into <dir> (created if missing).
    --preset <name>            Preset to apply. Prompts when omitted and stdin is a TTY.
    --profile <name>           Team profile layered over core and preset. Default: ~/.config/ctx/config.toml [profiles] match, else 'local'.
    --force                    Overwrite existing files.
  scaffold [repo] [options]    Generate agent context from repo metadata. Default repo is current directory.
    --write                    Write files. Default is dry-run.
    --force                    Overwrite existing files.
    --preset <name>            Use a preset's stack docs; repo commands replace preset commands when it has mise.toml.
    --profile <name>           Team profile layered over core and preset. Default: ~/.config/ctx/config.toml [profiles] match, else 'local'.
    --agent-shim               Also generate AGENT.md as a compatibility shim.
    --claude-shim              Also generate CLAUDE.md that imports AGENTS.md (@AGENTS.md).
    --package-overlays         Generate AGENTS.md inside detected workspace packages.
  help                         Show this help.

Options:
  -h, --help                   Show this help.
  -V, --version                Print the ctx version.

Layers (later replaces earlier at the same path): core/ shared .context guides; then the preset
(new, scaffold --preset) or rendered AGENTS.md, .context/project-context.md,
.context/guides/engineering.md (scaffold); then the profile. Extra packs: 'packs' in
~/.config/ctx/config.toml (override path with CTX_CONFIG).
With --preset: the preset's files (including .devcontainer/), plus mise.toml when the repo has no mise config.
`;

// Flags in the order they first appear in USAGE, so the first offending flag is reported consistently.
const FLAGS = ["preset", "profile", "force", "write", "agent-shim", "claude-shim", "package-overlays"] as const;
type Flag = (typeof FLAGS)[number];

const COMMANDS = new Map<string, { maxArgs: number; flags: readonly Flag[] }>([
  ["list", { maxArgs: 0, flags: [] }],
  ["new", { maxArgs: 1, flags: ["preset", "profile", "force"] }],
  ["scaffold", { maxArgs: 1, flags: FLAGS }],
]);

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "V" },
      preset: { type: "string" },
      profile: { type: "string" },
      force: { type: "boolean" },
      write: { type: "boolean" },
      "agent-shim": { type: "boolean" },
      "claude-shim": { type: "boolean" },
      "package-overlays": { type: "boolean" },
    },
  });
  const [command, ...rest] = positionals;

  if (values.version) {
    console.log(pkg.version);
    return;
  }
  if (values.help || command === undefined || command === "help") {
    console.log(USAGE);
    return;
  }

  const spec = COMMANDS.get(command);
  if (!spec) {
    console.error(`error: unknown command '${command}'`);
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  const extra = rest[spec.maxArgs];
  if (extra !== undefined) throw new Error(`unexpected argument '${extra}'`);
  const invalid = FLAGS.find((flag) => values[flag] !== undefined && !spec.flags.includes(flag));
  if (invalid) throw new Error(`option '--${invalid}' is not valid for '${command}'`);

  switch (command) {
    case "list":
      return runList();
    case "new":
      return runNew(rest[0], values.preset, values.profile, values.force ?? false);
    case "scaffold":
      return runScaffold(rest[0], {
        write: values.write ?? false,
        force: values.force ?? false,
        agentShim: values["agent-shim"] ?? false,
        claudeShim: values["claude-shim"] ?? false,
        packageOverlays: values["package-overlays"] ?? false,
        preset: values.preset,
        profile: values.profile,
      });
  }
}

async function runList(): Promise<void> {
  const presets = await listLayers("preset");
  const profiles = await listLayers("profile");
  const width = Math.max(...[...presets, ...profiles].map((layer) => layer.name.length));
  const line = (layer: Layer) => {
    const pack = layer.pack !== CTX_ROOT ? ` (${layer.pack})` : "";
    return `  ${layer.name.padEnd(width)}  ${layer.description}${pack}`;
  };
  console.log("Presets:");
  for (const preset of presets) console.log(line(preset));
  console.log("\nProfiles:");
  for (const profile of profiles) console.log(line(profile));
}

async function runNew(
  dir: string | undefined,
  presetName: string | undefined,
  profileName: string | undefined,
  force: boolean,
): Promise<void> {
  if (!dir) throw new Error("ctx new requires a target directory");
  const target = resolve(process.cwd(), dir);
  const profile = profileName ?? (await defaultProfile(target));
  await findLayer("profile", profile);
  const name = presetName ?? (await pickPreset(await listLayers("preset")));

  const created = await applyPreset({ preset: name, profile, target, force });
  for (const rel of created) console.log(`created: ${rel}`);
  console.log(`
Applied preset: ${name} (profile ${profile}) -> ${target}

Next:
  cd '${target}'
  mise trust && mise install
  grep -rn TODO AGENTS.md .context/ mise.toml`);
  if (!existsSync(join(target, ".git"))) {
    console.log(`  git init && git add -A && git commit -m "init from ctx preset ${name}"`);
  }
}

async function pickPreset(presets: Layer[]): Promise<string> {
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

async function runScaffold(
  repo: string | undefined,
  opts: Omit<ScaffoldOptions, "target" | "profile"> & { profile?: string },
): Promise<void> {
  const target = resolve(process.cwd(), repo ?? ".");
  if (!(await isDirectory(target))) throw new Error(`${target} is not a directory`);
  const profile = opts.profile ?? (await defaultProfile(target));
  // Validate layers up front so an unknown name errors before the header is printed.
  if (opts.preset !== undefined) await findLayer("preset", opts.preset);
  await findLayer("profile", profile);
  const parts = [...(opts.preset !== undefined ? [`preset ${opts.preset}`] : []), `profile ${profile}`];
  console.log(`${opts.write ? "write" : "dry-run"}: ${target} (${parts.join(", ")})`);
  const results = await scaffold({ ...opts, target, profile });
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
