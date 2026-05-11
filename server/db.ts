import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

export const dbPath = path.join(process.cwd(), "server", "emc.sqlite");
export const db = new Database(dbPath);
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
addColumn("contracts", "credit_balance", "INTEGER NOT NULL DEFAULT 0");
addColumn("payments", "reference", "TEXT NOT NULL DEFAULT ''");
addColumn("payments", "note", "TEXT NOT NULL DEFAULT ''");
addColumn("payments", "allocation_type", "TEXT NOT NULL DEFAULT 'REGULAR'");
addColumn("payments", "principal_extra_amount", "INTEGER NOT NULL DEFAULT 0");
addColumn("payments", "applied_amount", "INTEGER NOT NULL DEFAULT 0");
addColumn("payments", "unapplied_amount", "INTEGER NOT NULL DEFAULT 0");
addColumn("payments", "credit_balance_after", "INTEGER NOT NULL DEFAULT 0");
addColumn("payments", "idempotency_key", "TEXT");
addColumn("collections_cases", "next_action_type", "TEXT NOT NULL DEFAULT 'SEND_REMINDER'");
addColumn("collections_cases", "next_action_date", "TEXT NOT NULL DEFAULT ''");
addColumn("collections_cases", "assigned_agent_id", "TEXT NOT NULL DEFAULT ''");
addColumn("collection_actions", "note", "TEXT NOT NULL DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    client_full_name TEXT NOT NULL,
    client_phone TEXT NOT NULL DEFAULT '',
    client_national_id TEXT,
    vehicle_catalog_id TEXT,
    vehicle_brand TEXT NOT NULL DEFAULT '',
    vehicle_model TEXT NOT NULL DEFAULT '',
    vehicle_year INTEGER,
    vehicle_price_cents INTEGER NOT NULL DEFAULT 0,
    vehicle_cost_cents INTEGER,
    down_payment_cents INTEGER NOT NULL DEFAULT 0,
    down_payment_pct REAL NOT NULL DEFAULT 0,
    term_months INTEGER NOT NULL,
    apr_pct REAL NOT NULL DEFAULT 0,
    pricing_tier_id TEXT,
    financial_partner_id TEXT,
    insurance_partner_id TEXT,
    bank_account_id TEXT,
    bank_funded_amount_cents INTEGER,
    emc_funded_amount_cents INTEGER,
    settlement_mode TEXT NOT NULL DEFAULT '',
    closure_mode TEXT NOT NULL DEFAULT '',
    stage TEXT NOT NULL CHECK (stage IN ('DRAFT', 'DOCS_PENDING', 'BANK_REVIEW', 'READY_TO_SIGN', 'APPROVED', 'REJECTED', 'CANCELLED')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    rejected_reason TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS vehicle_catalog (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    variant TEXT,
    year INTEGER,
    category TEXT,
    default_price_cents INTEGER NOT NULL DEFAULT 0,
    default_cost_cents INTEGER,
    stock_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS financial_partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    funding_type TEXT NOT NULL DEFAULT '',
    cost_rate_pct REAL NOT NULL DEFAULT 0,
    active_contracts_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS insurance_partners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    premium_pct REAL NOT NULL DEFAULT 0,
    commission_pct REAL NOT NULL DEFAULT 0,
    settlement_timing TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

function seedFinanceReferenceIfEmpty() {
  const at = new Date().toISOString();
  const vehicleCount = (db.prepare("SELECT COUNT(*) AS count FROM vehicle_catalog").get() as { count: number }).count;
  if (!vehicleCount) {
    const insertVehicle = db.prepare(`
      INSERT INTO vehicle_catalog (id, brand, model, variant, year, category, default_price_cents, default_cost_cents, stock_count, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      ["v1", "PAIDI", "KT11EV", null, 2026, "Commercial EV", 860000, 645000, 8, "ACTIVE", "Core mass-market financed asset."],
      ["v2", "PAIDI", "KT11EV Cargo", null, 2026, "Cargo EV", 920000, 690000, 2, "ACTIVE", "Useful for fleet and recovery-friendly contracts."],
      ["v3", "Chery", "Arrizo 5", null, 2026, "Passenger EV", 1456000, 1100000, 5, "ACTIVE", "Legacy demo pricing reference."],
      ["v4", "Chery", "Tiggo 4 Pro", null, 2026, "SUV", 1890000, 1450000, 1, "ACTIVE", "Higher ticket size, watch partner exposure."],
      ["v5", "BYD", "Atto 3", null, 2026, "Passenger EV", 3250000, 2700000, 3, "ACTIVE", "Premium borrower profile reference."],
      ["v6", "Wuling", "Mini EV", null, 2026, "Micro EV", 980000, 735000, 0, "INACTIVE", "Inactive until inventory refresh."],
      ["v7", "Leapmotor", "T03", null, 2026, "Passenger EV", 1240000, 930000, 4, "ACTIVE", "Standard finance reference unit."],
      ["v8", "Gecko", "EV Truck 1T", null, 2026, "Commercial Truck", 1650000, 1250000, 1, "ACTIVE", "Commercial risk tier review recommended."]
    ].forEach((vehicle) => insertVehicle.run(...vehicle, at, at));
  }

  const financialCount = (db.prepare("SELECT COUNT(*) AS count FROM financial_partners").get() as { count: number }).count;
  if (!financialCount) {
    const insertFinancial = db.prepare(`
      INSERT INTO financial_partners (id, name, funding_type, cost_rate_pct, active_contracts_count, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      ["fp_icare", "iCare Leasing Plc", "Bank partner", 12, 18, "ACTIVE", "Primary co-funding partner for standard electric motorcycles."],
      ["fp_acleda", "ACLEDA Bank", "Bank", 11, 12, "ACTIVE", "Lower cost funding; tighter file documentation expected."],
      ["fp_wemoney", "WE.MONEY MFI", "MFI", 14, 7, "ACTIVE", "Useful for higher risk borrowers and smaller ticket sizes."],
      ["fp-emc-self", "EMC Self-Funded", "Self-funded", 0, 4, "ACTIVE", "Internal capital allocation; keep separate in margin reporting."],
      ["fp_chailease", "Chailease Royal", "Bank partner", 12.5, 0, "INACTIVE", "Reference-only until commercial terms are signed."]
    ].forEach((partner) => insertFinancial.run(...partner, at, at));
  }

  const insuranceCount = (db.prepare("SELECT COUNT(*) AS count FROM insurance_partners").get() as { count: number }).count;
  if (!insuranceCount) {
    const insertInsurance = db.prepare(`
      INSERT INTO insurance_partners (id, name, premium_pct, commission_pct, settlement_timing, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      ["ip_cb", "CB General Insurance", 2.9, 12, "Monthly pass-through", "ACTIVE", "Default package for standard financed vehicles."],
      ["ip_forte", "Forte Insurance", 3.2, 10, "Monthly pass-through", "ACTIVE", "Higher premium, stronger claim network."],
      ["ip_asia", "Asia Insurance Cambodia", 2.5, 15, "Monthly pass-through", "ACTIVE", "Lower premium pilot option."],
      ["ip_manual", "Manual policy override", 0, 0, "Per contract", "INACTIVE", "Used only when insurance is handled outside EMC."]
    ].forEach((partner) => insertInsurance.run(...partner, at, at));
  }
}

seedFinanceReferenceIfEmpty();

db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL");

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
      allocation_type TEXT NOT NULL DEFAULT 'REGULAR' CHECK (allocation_type IN ('REGULAR', 'PAY_AHEAD', 'PRINCIPAL_PREPAYMENT')),
      principal_extra_amount INTEGER NOT NULL DEFAULT 0,
      applied_amount INTEGER NOT NULL DEFAULT 0,
      unapplied_amount INTEGER NOT NULL DEFAULT 0,
      credit_balance_after INTEGER NOT NULL DEFAULT 0,
      idempotency_key TEXT UNIQUE,
      recorded_at TEXT NOT NULL,
      recorded_by TEXT NOT NULL
    );
    INSERT INTO payments_next (id, contract_id, installment_id, amount, method, reference, note, allocation_type, principal_extra_amount, applied_amount, unapplied_amount, credit_balance_after, idempotency_key, recorded_at, recorded_by)
      SELECT id, contract_id, installment_id, amount, method, reference, note, allocation_type, principal_extra_amount, applied_amount, unapplied_amount, credit_balance_after, idempotency_key, recorded_at, recorded_by FROM payments;
    DROP TABLE payments;
    ALTER TABLE payments_next RENAME TO payments;
  `);
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key) WHERE idempotency_key IS NOT NULL");
}

db.prepare(`
  UPDATE payments
  SET applied_amount = CASE
    WHEN applied_amount != 0 THEN applied_amount
    WHEN allocation_type = 'PRINCIPAL_PREPAYMENT' AND amount - principal_extra_amount > 0 THEN amount - principal_extra_amount
    WHEN allocation_type = 'PRINCIPAL_PREPAYMENT' THEN 0
    ELSE amount
  END
  WHERE applied_amount = 0 AND unapplied_amount = 0
`).run();

db.prepare(`
  UPDATE contracts
  SET credit_balance = (
    SELECT COALESCE(SUM(unapplied_amount), 0)
    FROM payments
    WHERE payments.contract_id = contracts.id
  )
  WHERE credit_balance = 0
    AND EXISTS (
      SELECT 1
      FROM payments
      WHERE payments.contract_id = contracts.id
        AND payments.unapplied_amount > 0
    )
`).run();

db.prepare(`
  UPDATE payments
  SET credit_balance_after = (
    SELECT COALESCE(SUM(prior.unapplied_amount), 0)
    FROM payments AS prior
    WHERE prior.contract_id = payments.contract_id
      AND (
        prior.recorded_at < payments.recorded_at
        OR (prior.recorded_at = payments.recorded_at AND prior.id <= payments.id)
      )
  )
  WHERE credit_balance_after = 0
    AND unapplied_amount > 0
`).run();

if (!tableSql("installments").includes("CANCELLED_BY_PREPAYMENT")) {
  db.exec(`
    CREATE TABLE installments_next (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      seq_no INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      amount_due INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED_BY_PREPAYMENT')),
      paid_at TEXT
    );
    INSERT INTO installments_next (id, contract_id, seq_no, due_date, amount_due, status, paid_at)
      SELECT id, contract_id, seq_no, due_date, amount_due, status, paid_at FROM installments;
    DROP TABLE installments;
    ALTER TABLE installments_next RENAME TO installments;
  `);
}

if (!tableSql("gps_devices").includes("IMMOBILIZED") && !tableSql("gps_devices").includes("OVERDUE_WATCH")) {
  db.exec(`
    CREATE TABLE gps_devices_next (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ONLINE', 'IMMOBILIZER_ARMED', 'IMMOBILIZED')),
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      last_ping_at TEXT NOT NULL
    );
    INSERT INTO gps_devices_next (id, vehicle_id, status, lat, lng, last_ping_at)
      SELECT id, vehicle_id, status, lat, lng, last_ping_at FROM gps_devices;
    DROP TABLE gps_devices;
    ALTER TABLE gps_devices_next RENAME TO gps_devices;
  `);
}

addColumn("gps_devices", "provider", "TEXT NOT NULL DEFAULT ''");
addColumn("gps_devices", "provider_device_id", "TEXT NOT NULL DEFAULT ''");
addColumn("gps_devices", "imei", "TEXT NOT NULL DEFAULT ''");
addColumn("gps_devices", "sim_number", "TEXT NOT NULL DEFAULT ''");
addColumn("gps_devices", "ignition_status", "TEXT NOT NULL DEFAULT 'OFF'");
addColumn("gps_devices", "speed", "REAL NOT NULL DEFAULT 0");
addColumn("gps_devices", "last_command", "TEXT NOT NULL DEFAULT ''");
addColumn("gps_devices", "last_command_status", "TEXT NOT NULL DEFAULT ''");
addColumn("gps_devices", "last_command_at", "TEXT");

if (!tableSql("gps_devices").includes("OVERDUE_WATCH") || tableSql("gps_devices").includes("IMMOBILIZED")) {
  db.exec(`
    CREATE TABLE gps_devices_next (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('ONLINE', 'OVERDUE_WATCH', 'IMMOBILIZER_ARMED')),
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      last_ping_at TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT '',
      provider_device_id TEXT NOT NULL DEFAULT '',
      imei TEXT NOT NULL DEFAULT '',
      sim_number TEXT NOT NULL DEFAULT '',
      ignition_status TEXT NOT NULL DEFAULT 'OFF',
      speed REAL NOT NULL DEFAULT 0,
      last_command TEXT NOT NULL DEFAULT '',
      last_command_status TEXT NOT NULL DEFAULT '',
      last_command_at TEXT
    );
    INSERT INTO gps_devices_next (id, vehicle_id, status, lat, lng, last_ping_at, provider, provider_device_id, imei, sim_number, ignition_status, speed, last_command, last_command_status, last_command_at)
      SELECT id, vehicle_id, CASE WHEN status = 'IMMOBILIZED' THEN 'IMMOBILIZER_ARMED' ELSE status END, lat, lng, last_ping_at, provider, provider_device_id, imei, sim_number, ignition_status, speed, last_command, last_command_status, last_command_at FROM gps_devices;
    DROP TABLE gps_devices;
    ALTER TABLE gps_devices_next RENAME TO gps_devices;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS gps_commands (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    command_type TEXT NOT NULL CHECK (command_type IN ('IMMOBILIZE', 'RELEASE')),
    requested_by TEXT NOT NULL,
    approved_by TEXT,
    status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'APPROVED', 'SENT', 'ACKNOWLEDGED', 'FAILED')),
    provider_response TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    executed_at TEXT
  )
`);

if (!tableSql("collections_cases").includes("FINAL_NOTICE") && !tableSql("collections_cases").includes("'APPROVED'")) {
  db.exec(`
    CREATE TABLE collections_cases_next (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'SMS_SENT', 'FINAL_NOTICE', 'IMMOBILIZER_ARMED', 'CURED', 'CLOSED')),
      opened_at TEXT NOT NULL,
      cured_at TEXT,
      next_action_type TEXT NOT NULL DEFAULT 'SEND_REMINDER',
      next_action_date TEXT NOT NULL DEFAULT '',
      assigned_agent_id TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO collections_cases_next (id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id)
      SELECT id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id FROM collections_cases;
    DROP TABLE collections_cases;
    ALTER TABLE collections_cases_next RENAME TO collections_cases;
  `);
}

if (!tableSql("collection_actions").includes("CALL_ATTEMPT")) {
  db.exec(`
    CREATE TABLE collection_actions_next (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SMS', 'ARM_IMMOBILIZER', 'SEND_REMINDER', 'CALL_ATTEMPT', 'NOTE', 'REQUEST_IMMOBILIZER')),
      performed_by TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO collection_actions_next (id, case_id, type, performed_by, performed_at, note)
      SELECT id, case_id, type, performed_by, performed_at, note FROM collection_actions;
    DROP TABLE collection_actions;
    ALTER TABLE collection_actions_next RENAME TO collection_actions;
  `);
}

if (!tableSql("collections_cases").includes("APPROVED")) {
  db.exec(`
    CREATE TABLE collections_cases_next (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'SMS_SENT', 'FINAL_NOTICE', 'REQUESTED', 'APPROVED', 'IMMOBILIZER_ARMED', 'CURED', 'CLOSED')),
      opened_at TEXT NOT NULL,
      cured_at TEXT,
      next_action_type TEXT NOT NULL DEFAULT 'SEND_REMINDER',
      next_action_date TEXT NOT NULL DEFAULT '',
      assigned_agent_id TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO collections_cases_next (id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id)
      SELECT id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id FROM collections_cases;
    DROP TABLE collections_cases;
    ALTER TABLE collections_cases_next RENAME TO collections_cases;
  `);
}

if (tableSql("collections_cases").includes("IMMOBILIZER_ARMED") || tableSql("collections_cases").includes("REQUESTED") || tableSql("collections_cases").includes("SMS_SENT")) {
  db.exec(`
    CREATE TABLE collections_cases_next (
      id TEXT PRIMARY KEY,
      contract_id TEXT NOT NULL,
      client_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'APPROVED', 'CURED', 'CLOSED')),
      opened_at TEXT NOT NULL,
      cured_at TEXT,
      next_action_type TEXT NOT NULL DEFAULT 'SEND_REMINDER',
      next_action_date TEXT NOT NULL DEFAULT '',
      assigned_agent_id TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO collections_cases_next (id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id)
      SELECT
        id,
        contract_id,
        client_id,
        CASE WHEN status IN ('APPROVED', 'CURED', 'CLOSED') THEN status ELSE 'OPEN' END,
        opened_at,
        cured_at,
        next_action_type,
        next_action_date,
        assigned_agent_id
      FROM collections_cases;
    DROP TABLE collections_cases;
    ALTER TABLE collections_cases_next RENAME TO collections_cases;
  `);
}

db.prepare(`
  UPDATE collections_cases
  SET status = 'OPEN',
      next_action_type = 'COLLECT_PAYMENT'
  WHERE status = 'APPROVED'
    AND EXISTS (
      SELECT 1
      FROM contracts c
      JOIN vehicles v ON v.id = c.vehicle_id
      JOIN gps_devices g ON g.vehicle_id = v.id
      WHERE c.id = collections_cases.contract_id
        AND g.status = 'IMMOBILIZER_ARMED'
    )
`).run();

db.prepare(`
  UPDATE collections_cases
  SET next_action_type = 'COLLECT_PAYMENT'
  WHERE status NOT IN ('CLOSED', 'CURED')
    AND EXISTS (
      SELECT 1
      FROM contracts c
      JOIN vehicles v ON v.id = c.vehicle_id
      JOIN gps_devices g ON g.vehicle_id = v.id
      WHERE c.id = collections_cases.contract_id
        AND g.status = 'IMMOBILIZER_ARMED'
    )
`).run();

if (!tableSql("collection_actions").includes("APPROVE_IMMOBILIZER")) {
  db.exec(`
    CREATE TABLE collection_actions_next (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SMS', 'ARM_IMMOBILIZER', 'SEND_REMINDER', 'CALL_ATTEMPT', 'NOTE', 'REQUEST_IMMOBILIZER', 'APPROVE_IMMOBILIZER')),
      performed_by TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO collection_actions_next (id, case_id, type, performed_by, performed_at, note)
      SELECT id, case_id, type, performed_by, performed_at, note FROM collection_actions;
    DROP TABLE collection_actions;
    ALTER TABLE collection_actions_next RENAME TO collection_actions;
  `);
}

if (!tableSql("collection_actions").includes("REQUEST_RESTORE")) {
  db.exec(`
    CREATE TABLE collection_actions_next (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SMS', 'ARM_IMMOBILIZER', 'SEND_REMINDER', 'CALL_ATTEMPT', 'NOTE', 'REQUEST_IMMOBILIZER', 'APPROVE_IMMOBILIZER', 'REQUEST_RESTORE')),
      performed_by TEXT NOT NULL,
      performed_at TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT ''
    );
    INSERT INTO collection_actions_next (id, case_id, type, performed_by, performed_at, note)
      SELECT id, case_id, type, performed_by, performed_at, note FROM collection_actions;
    DROP TABLE collection_actions;
    ALTER TABLE collection_actions_next RENAME TO collection_actions;
  `);
}

if (!tableSql("audit").includes("'client'") || !tableSql("audit").includes("FINANCIAL_CONTROLLER") || !tableSql("audit").includes("'application'")) {
  db.exec(`
    CREATE TABLE audit_next (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL CHECK (actor_role IN ('ADMIN', 'CEO', 'FINANCIAL_CONTROLLER', 'COLLECTIONS', 'OPS')),
      entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'contract', 'case', 'installment', 'payment', 'vehicle', 'alert', 'application')),
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
