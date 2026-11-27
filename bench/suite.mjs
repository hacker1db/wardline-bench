// Resolves the default suite: the private held-out suite when present, else the public example split.
import { existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
export const PRIVATE_SUITE = path.join(root, "bench/tasks/private/wardline-core.json");
export const EXAMPLE_SUITE = path.join(root, "bench/tasks/wardline-example.json");
export const defaultSuite = () => (existsSync(PRIVATE_SUITE) ? PRIVATE_SUITE : EXAMPLE_SUITE);
