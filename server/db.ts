import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const db = new Database(path.join(process.cwd(), "server", "emc.sqlite"));
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(process.cwd(), "server", "schema.sql"), "utf8");
db.exec(schema);

let seq = Date.now();

export function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function audit(actor_id: string, actor_role: string, entity_type: string, entity_id: string, action: string, before: unknown, after: unknown) {
  db.prepare(
    "INSERT INTO audit (id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(nextId("AUD"), nowIso(), actor_id, actor_role, entity_type, entity_id, action, before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after));
}

export function rows<T>(sql: string, params: unknown[] = []) {
  return db.prepare(sql).all(...params) as T[];
}

export function row<T>(sql: string, params: unknown[] = []) {
  return db.prepare(sql).get(...params) as T | undefined;
}
