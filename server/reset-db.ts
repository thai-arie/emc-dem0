import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "server", "emc.sqlite");
for (const file of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
console.log("SQLite database reset. Run npm run dev:server to reseed.");
