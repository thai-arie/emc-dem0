import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const db = new Database(path.join(process.cwd(), "server", "emc.sqlite"));
db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(path.join(process.cwd(), "server", "schema.sql"), "utf8");
db.exec(schema);

function columns(table: string) {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((item) => item.name));
}

function addColumn(table: string, name: string, definition: string) {
  if (!columns(table).has(name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

addColumn("clients", "address", "TEXT NOT NULL DEFAULT ''");
addColumn("clients", "national_id", "TEXT NOT NULL DEFAULT ''");
addColumn("clients", "emergency_contact_name", "TEXT NOT NULL DEFAULT ''");
addColumn("clients", "emergency_contact_phone", "TEXT NOT NULL DEFAULT ''");
addColumn("contracts", "vehicle_price", "INTEGER NOT NULL DEFAULT 0");
addColumn("contracts", "down_payment", "INTEGER NOT NULL DEFAULT 0");
addColumn("contracts", "financed_amount", "INTEGER NOT NULL DEFAULT 0");
addColumn("payments", "reference", "TEXT NOT NULL DEFAULT ''");
addColumn("payments", "note", "TEXT NOT NULL DEFAULT ''");

function tableSql(table: string) {
  return (db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as { sql: string } | undefined)?.sql ?? "";
}

if (!tableSql("payments").includes("'aba'")) {
  db.exec(`
    CREATE TABLE payments_next (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      installment_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('cash', 'transfer', 'aba', 'wing')),
      reference TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      recorded_at TEXT NOT NULL,
      recorded_by TEXT NOT NULL
    );
    INSERT INTO payments_next (id, contract_id, installment_id, amount, method, reference, note, recorded_at, recorded_by)
      SELECT id, contract_id, installment_id, amount, method, reference, note, recorded_at, recorded_by FROM payments;
    DROP TABLE payments;
    ALTER TABLE payments_next RENAME TO payments;
  `);
}

if (!tableSql("audit").includes("'client'")) {
  db.exec(`
    CREATE TABLE audit_next (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL CHECK (actor_role IN ('CEO', 'COLLECTIONS', 'OPS')),
      entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'contract', 'case', 'installment', 'payment', 'vehicle', 'alert')),
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT
    );
    INSERT INTO audit_next (id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json)
      SELECT id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json FROM audit;
    DROP TABLE audit;
    ALTER TABLE audit_next RENAME TO audit;
  `);
}

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
