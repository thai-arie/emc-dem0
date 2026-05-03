import path from "node:path";
import Database from "better-sqlite3";

type Candidate = {
  id: string;
  client_id: string;
  vehicle_id: string;
  gps_device_id: string;
};

type Installment = {
  id: string;
  contract_id: string;
  seq_no: number;
  due_date: string;
  status: string;
};

// Temporary dev-only simulator. Safe to remove with the package script when no longer needed.
const db = new Database(path.join(process.cwd(), "server", "emc.sqlite"));
const now = new Date().toISOString();
let seq = Date.now();

function nextId(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}`;
}

const candidates = db
  .prepare(
    `
      SELECT c.id, c.client_id, c.vehicle_id, v.gps_device_id
      FROM contracts c
      JOIN vehicles v ON v.id = c.vehicle_id
      JOIN gps_devices g ON g.id = v.gps_device_id
      WHERE c.status = 'ACTIVE'
        AND EXISTS (
          SELECT 1
          FROM installments i
          WHERE i.contract_id = c.id
            AND i.status NOT IN ('PAID', 'CANCELLED_BY_PREPAYMENT')
        )
      ORDER BY c.id
      LIMIT 7
    `
  )
  .all() as Candidate[];

if (candidates.length < 7) {
  throw new Error(`Need 7 active contracts with unpaid installments; found ${candidates.length}`);
}

const tx = db.transaction(() => {
  for (const contract of candidates) {
    const installment = db
      .prepare(
        `
          SELECT *
          FROM installments
          WHERE contract_id = ?
            AND status NOT IN ('PAID', 'CANCELLED_BY_PREPAYMENT')
          ORDER BY due_date, seq_no
          LIMIT 1
        `
      )
      .get(contract.id) as Installment | undefined;

    if (!installment) continue;

    db.prepare("UPDATE installments SET status = 'OVERDUE', paid_at = NULL WHERE id = ?").run(installment.id);
    db.prepare("UPDATE contracts SET status = 'OVERDUE' WHERE id = ?").run(contract.id);

    const openCase = db
      .prepare("SELECT id FROM collections_cases WHERE contract_id = ? AND status NOT IN ('CLOSED', 'CURED') LIMIT 1")
      .get(contract.id);

    if (!openCase) {
      db.prepare(
        "INSERT INTO collections_cases (id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id) VALUES (?, ?, ?, 'OPEN', ?, NULL, 'SEND_REMINDER', ?, '')"
      ).run(
        nextId(`COL-DEV-${contract.id}`),
        contract.id,
        contract.client_id,
        now,
        now
      );
    }
  }

  for (const contract of candidates.slice(0, 2)) {
    db.prepare("UPDATE gps_devices SET status = 'IMMOBILIZER_ARMED', last_ping_at = ? WHERE id = ?").run(now, contract.gps_device_id);
  }
});

tx();

console.log(`Simulated overdue contracts: ${candidates.map((contract) => contract.id).join(", ")}`);
console.log(`Immobilizer armed: ${candidates.slice(0, 2).map((contract) => contract.id).join(", ")}`);
