import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { exists } from "../src/detect.ts";
import { CTX_ROOT } from "../src/paths.ts";

const RULE_DOCS = ["AGENTS.md", ".context/guides/engineering.md"];

test("every MUST rule in ctx's own docs names an existing check", async () => {
  const problems: string[] = [];
  for (const doc of RULE_DOCS) {
    const lines = (await readFile(join(CTX_ROOT, doc), "utf8")).split("\n");
    for (const [index, line] of lines.entries()) {
      if (!/^\s*- /.test(line)) continue;
      const lineNo = index + 1;
      const marker = line.trimEnd().match(/\[check: ([^\]]+)\]$/);
      if (!marker) {
        if (/\bMUST\b/.test(line.replace(/`[^`]*`/g, ""))) problems.push(`${doc}:${lineNo}: missing [check: ...]`);
        continue;
      }
      for (const piece of (marker[1] as string).split(",").map((target) => target.trim())) {
        if (piece !== "manual" && !(await exists(join(CTX_ROOT, piece)))) {
          problems.push(`${doc}:${lineNo}: unknown check '${piece}'`);
        }
      }
    }
  }
  expect(problems).toEqual([]);
});
