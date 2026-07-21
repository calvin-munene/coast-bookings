import { rm } from "node:fs/promises";
import { resolve, sep } from "node:path";

const workspace = resolve(process.cwd());
const generatedTypes = resolve(workspace, ".next", "dev", "types");
if (!generatedTypes.startsWith(`${workspace}${sep}`)) throw new Error("Refusing to clean outside the workspace");
await rm(generatedTypes, { recursive: true, force: true });
