import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

process.env.WRANGLER_LOG_PATH ||= ".wrangler/wrangler.log";
const command = resolve("node_modules", "vinext", "dist", "cli.js");
const result = spawnSync(process.execPath, [command, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
