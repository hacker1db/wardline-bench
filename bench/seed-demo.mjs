#!/usr/bin/env node
// Writes clearly labeled DEMO runs so the UI has a timeline before real runs exist.
// Answers are synthesized from the rubric and graded by the real grader, so drill-in
// views show genuine hits, misses, citations and word counts. Delete
// results/runs/*__demo_* once you have real data.
import { writeFile, readFile, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { gradeTask } from "./grader.mjs";
import { defaultSuite } from "./suite.mjs";

const root = path.resolve(import.meta.dirname, "..");
const runsDir = path.join(root, "results/runs");
const suite = JSON.parse(await readFile(defaultSuite(), "utf8"));
const models = [
  { spec: "mock:model-a", base: 0.6, slope: 0.045, verbose: 0.15 },
  { spec: "mock:model-b", base: 0.52, slope: 0.04, verbose: 0.25 },
  { spec: "mock:model-c", base: 0.36, slope: 0.05, verbose: 0.2 },
  { spec: "mock:model-d", base: 0.58, slope: 0.035, verbose: 0.35 },
  { spec: "mock:model-e", base: 0.45, slope: 0.03, verbose: 0.5 },
];
let seed = 11;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const FILLER = "it is important to note that a comprehensive holistic approach should be considered in light of best practices";

function synthesize(task, skill, verbose) {
  const p = skill - task.difficulty * 0.06;
  const steps = [];
  for (const c of task.rubric?.required ?? []) {
    if (rand() < p) steps.push({ claim: c.any[0], evidence: (task.evidence ?? []).filter(() => rand() < p + 0.1) });
  }
  for (const c of task.rubric?.forbidden ?? []) if (rand() > p + 0.35) steps.push({ claim: c.any[0], evidence: [] });
  if (rand() > p + 0.3) steps.push({ claim: "see related signal", evidence: [`E${task.context.length + 3}`] });
  const fields = {};
  for (const [k, f] of Object.entries(task.fields ?? {})) {
    if (rand() < p) fields[k] = f.expected;
    else if (f.type === "enum") fields[k] = f.options[Math.floor(rand() * f.options.length)];
    else if (f.type === "number") fields[k] = f.expected + 1;
    else fields[k] = [...[].concat(f.expected), "decoy-" + Math.floor(rand() * 9)];
  }
  steps.forEach((s, i) => { if (!s.evidence.length && i === 0) s.evidence = (task.evidence ?? []).slice(0, 1); });
  const pad = rand() < verbose ? Array(1 + Math.floor(rand() * 4)).fill(FILLER).join(". ") : "";
  return JSON.stringify({
    verdict: steps[0]?.claim ?? "insufficient evidence",
    fields,
    steps,
    remediation: [steps.find((s) => /revoke|fix|upgrade|bump|reset|terminate/.test(s.claim))?.claim ?? "monitor", pad].filter(Boolean).join(". "),
    confidence: Number(Math.min(0.95, p + 0.1).toFixed(2)),
  });
}

await mkdir(runsDir, { recursive: true });
for (const f of await readdir(runsDir)) if (f.includes("__demo_")) await rm(path.join(runsDir, f));
for (let week = 0; week < 8; week++) {
  const date = new Date(Date.UTC(2026, 9, 5 + week * 7)).toISOString();
  for (const m of models) {
    const skill = Math.min(0.98, m.base + m.slope * week + (rand() - 0.5) * 0.1);
    const results = suite.tasks.map((t) => {
      const g = gradeTask(t, synthesize(t, skill, m.verbose));
      return { taskId: t.id, title: t.title, category: t.category, ...g, judge: null, error: null, ms: 0 };
    });
    const name = `${date.replace(/[:.]/g, "-")}__demo_${m.spec.replace(/[^a-z0-9.-]/gi, "_")}.json`;
    await writeFile(path.join(runsDir, name), JSON.stringify({ model: m.spec, date, suite: suite.suite, suiteVersion: suite.version, demo: true, results }, null, 2));
  }
}
console.log("seeded demo runs");
