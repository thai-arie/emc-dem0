import express from "express";
import cors from "cors";
import { db, nextId, nowIso, audit, rows, row } from "./db";

type Role = "CEO" | "COLLECTIONS" | "OPS";
type Actor = { actor_id: string; actor_role: Role };

const app = express();
app.use(cors());
app.use(express.json());

function actor(body: Partial<Actor>): Actor {
  return { actor_id: body.actor_id || "USR-COL", actor_role: (body.actor_role || "COLLECTIONS") as Role };
}

function jsonGps(gps: any) {
  return { ...gps, last_position: { lat: gps.lat, lng: gps.lng } };
}

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addMonths(value: string, months: number) {
  const date = new Date(value);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString();
}

function cents(value: unknown) {
  return Math.round(Number(value || 0));
}

function seedIfEmpty() {
  const existing = row<{ count: number }>("SELECT COUNT(*) AS count FROM contracts")?.count ?? 0;
  if (existing) return;
  const at = "2026-05-01T08:00:00.000Z";
  const tx = db.transaction(() => {
    for (let i = 1; i <= 50; i += 1) {
      const special = i === 1;
      const suffix = special ? "0341" : String(1000 + i).slice(1);
      const clientId = `CL-${suffix}`;
      const contractId = special ? "KT-0341" : `KT-${suffix}`;
      const vehicleId = `VEH-${suffix}`;
      const gpsId = `GPS-${suffix}`;
      const monthly = 32500 + i * 200;
      db.prepare("INSERT INTO clients (id, full_name, phone, address, national_id, emergency_contact_name, emergency_contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)").run(clientId, special ? "Dara Sok" : `Client ${suffix}`, `+85510${String(100000 + i).slice(1)}`, "Phnom Penh", `NID-${suffix}`, "Emergency contact", `+85512${String(100000 + i).slice(1)}`);
      db.prepare("INSERT INTO contracts (id, client_id, vehicle_id, status, monthly_total, start_date, term_months, vehicle_price, down_payment, financed_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(contractId, clientId, vehicleId, special ? "OVERDUE" : "ACTIVE", monthly, "2025-01-01T00:00:00.000Z", 36, monthly * 36, 0, monthly * 36);
      db.prepare("INSERT INTO vehicles VALUES (?, ?, ?, ?, ?, ?, ?)").run(vehicleId, `VINEMC${1000000 + i}`, "Toyota", "Vios", special ? "2AB-0341" : `2AB-${suffix}`, contractId, gpsId);
      db.prepare("INSERT INTO gps_devices VALUES (?, ?, ?, ?, ?, ?)").run(gpsId, vehicleId, "ONLINE", 11.5564 + ((i % 9) - 4) * 0.01, 104.9282 + ((i % 7) - 3) * 0.012, at);
      for (let m = 1; m <= 36; m += 1) {
        const dueDate = addMonths("2025-01-01T00:00:00.000Z", m);
        const status = special ? (m === 15 ? "OVERDUE" : m < 15 ? "PAID" : "SCHEDULED") : m <= 16 ? "PAID" : "SCHEDULED";
        db.prepare("INSERT INTO installments VALUES (?, ?, ?, ?, ?, ?, ?)").run(`INS-${suffix}-${String(m).padStart(2, "0")}`, contractId, m, dueDate, monthly, status, status === "PAID" ? dueDate : null);
      }
    }
    db.prepare("INSERT INTO collections_cases VALUES (?, ?, ?, ?, ?, ?)").run("COL-0341", "KT-0341", "CL-0341", "OPEN", at, null);
  });
  tx();
}

function repairSeededDemoRows() {
  const needsRepair =
    row<{ count: number }>(
      "SELECT COUNT(*) AS count FROM contracts WHERE id GLOB 'KT-[0-9][0-9][0-9]' AND status = 'OVERDUE'"
    )?.count ?? 0;
  if (!needsRepair) return;
  const seeded = rows<any>("SELECT * FROM contracts WHERE id = 'KT-0341' OR id GLOB 'KT-[0-9][0-9][0-9]'");
  const tx = db.transaction(() => {
    for (const contract of seeded) {
      const special = contract.id === "KT-0341";
      db.prepare("UPDATE contracts SET status = ? WHERE id = ?").run(special ? "OVERDUE" : "ACTIVE", contract.id);
      const installments = rows<any>("SELECT * FROM installments WHERE contract_id = ? ORDER BY seq_no", [contract.id]);
      for (const installment of installments) {
        const dueDate = addMonths(contract.start_date, installment.seq_no);
        const status = special
          ? installment.seq_no === 15
            ? "OVERDUE"
            : installment.seq_no < 15
              ? "PAID"
              : "SCHEDULED"
          : installment.seq_no <= 16
            ? "PAID"
            : "SCHEDULED";
        db.prepare("UPDATE installments SET due_date = ?, status = ?, paid_at = ? WHERE id = ?").run(
          dueDate,
          status,
          status === "PAID" ? dueDate : null,
          installment.id
        );
      }
    }
  });
  tx();
}

function repairLegacyNewContractRows() {
  const legacyContracts = rows<any>(
    "SELECT c.* FROM contracts c JOIN vehicles v ON v.id = c.vehicle_id WHERE v.plate LIKE 'NEW-%' AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.contract_id = c.id)"
  );
  if (!legacyContracts.length) return;
  const tx = db.transaction(() => {
    for (const contract of legacyContracts) {
      db.prepare("UPDATE contracts SET status = 'ACTIVE' WHERE id = ?").run(contract.id);
      const installments = rows<any>("SELECT * FROM installments WHERE contract_id = ? ORDER BY seq_no", [contract.id]);
      for (const installment of installments) {
        db.prepare("UPDATE installments SET due_date = ?, status = 'SCHEDULED', paid_at = NULL WHERE id = ?").run(
          addMonths(contract.start_date, installment.seq_no),
          installment.id
        );
      }
    }
  });
  tx();
}

function repairOperationalDefaults() {
  db.prepare("UPDATE contracts SET vehicle_price = monthly_total * term_months WHERE vehicle_price = 0").run();
  db.prepare("UPDATE contracts SET financed_amount = monthly_total * term_months WHERE financed_amount = 0").run();
  db.prepare("UPDATE clients SET address = 'Phnom Penh' WHERE address = ''").run();
  db.prepare("UPDATE clients SET national_id = id WHERE national_id = ''").run();
}

function ensureCollectionCase(contractId: string, at: string) {
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [contractId]);
  if (!contract) return;
  const overdue = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1", [contractId]);
  const open = row<any>("SELECT * FROM collections_cases WHERE contract_id = ? AND status != 'CLOSED' LIMIT 1", [contractId]);
  if (overdue && !open) {
    const caseId = nextId("COL");
    const created = { id: caseId, contract_id: contract.id, client_id: contract.client_id, status: "OPEN", opened_at: at, cured_at: null };
    db.prepare("INSERT INTO collections_cases VALUES (?, ?, ?, ?, ?, ?)").run(caseId, contract.id, contract.client_id, "OPEN", at, null);
    audit("USR-COL", "COLLECTIONS", "case", caseId, "collections.case_created", null, created);
  }
}

function refreshOverdueState() {
  const at = nowIso();
  const today = localDateKey(new Date());
  const tx = db.transaction(() => {
    const unpaid = rows<any>("SELECT * FROM installments WHERE status != 'PAID'");
    const overdueIds = new Set<string>();
    for (const installment of unpaid) {
      const isOverdue = localDateKey(installment.due_date) < today;
      if (isOverdue) {
        overdueIds.add(installment.contract_id);
        if (installment.status !== "OVERDUE") {
          db.prepare("UPDATE installments SET status = 'OVERDUE' WHERE id = ?").run(installment.id);
        }
      } else if (installment.status === "OVERDUE") {
        db.prepare("UPDATE installments SET status = 'SCHEDULED' WHERE id = ?").run(installment.id);
      }
    }
    const contracts = rows<any>("SELECT * FROM contracts");
    for (const contract of contracts) {
      const shouldBeOverdue = overdueIds.has(contract.id);
      const nextStatus = shouldBeOverdue ? "OVERDUE" : "ACTIVE";
      if (contract.status !== nextStatus) {
        db.prepare("UPDATE contracts SET status = ? WHERE id = ?").run(nextStatus, contract.id);
      }
      if (shouldBeOverdue) ensureCollectionCase(contract.id, at);
    }
  });
  tx();
}

seedIfEmpty();
repairSeededDemoRows();
repairLegacyNewContractRows();
repairOperationalDefaults();

app.get("/contracts", (_req, res) => {
  refreshOverdueState();
  const contracts = rows<any>("SELECT c.*, cl.full_name AS client, cl.phone FROM contracts c JOIN clients cl ON cl.id = c.client_id ORDER BY c.id");
  const payments = rows<any>("SELECT * FROM payments ORDER BY recorded_at DESC LIMIT 20");
  const total_disbursed = contracts.reduce((sum, contract) => sum + (contract.financed_amount || contract.monthly_total * contract.term_months), 0);
  const total_collected = row<{ value: number }>("SELECT COALESCE(SUM(amount), 0) AS value FROM payments")?.value ?? 0;
  const outstanding = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE status != 'PAID'")?.value ?? 0;
  const overdue_amount = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE status = 'OVERDUE'")?.value ?? 0;
  const active_contracts = contracts.filter((contract) => contract.status === "ACTIVE").length;
  const overdue_contracts = contracts.filter((contract) => contract.status === "OVERDUE").length;
  res.json({ contracts, payments, cash: { total_disbursed, total_collected, outstanding, overdue_amount, active_contracts, overdue_contracts } });
});

app.get("/contracts/:id", (req, res) => {
  refreshOverdueState();
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [req.params.id]);
  if (!contract) return res.status(404).json({ error: "Contract not found" });
  const client = row<any>("SELECT * FROM clients WHERE id = ?", [contract.client_id]);
  const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]);
  const gps = vehicle ? row<any>("SELECT * FROM gps_devices WHERE vehicle_id = ?", [vehicle.id]) : null;
  const payments = rows<any>("SELECT * FROM payments WHERE contract_id = ? ORDER BY recorded_at DESC", [contract.id]);
  const cases = rows<any>("SELECT * FROM collections_cases WHERE contract_id = ? ORDER BY opened_at DESC", [contract.id]);
  const installments = rows<any>("SELECT id FROM installments WHERE contract_id = ?", [contract.id]);
  const auditEntityIds = [contract.id, client.id, vehicle.id, gps?.id ?? "", ...payments.map((item) => item.id), ...cases.map((item) => item.id), ...installments.map((item) => item.id)];
  const auditRows = rows<any>(`SELECT id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json FROM audit WHERE entity_id IN (${auditEntityIds.map(() => "?").join(",")}) ORDER BY ts`, auditEntityIds);
  const paid_to_date = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding_balance = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE contract_id = ? AND status != 'PAID'", [contract.id])?.value ?? 0;
  const overdue_amount = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE contract_id = ? AND status = 'OVERDUE'", [contract.id])?.value ?? 0;
  res.json({ contract, client, vehicle, gps: gps ? jsonGps(gps) : null, payments, cases, audit: auditRows.map((item) => ({ ...item, before: item.before_json ? JSON.parse(item.before_json) : null, after: item.after_json ? JSON.parse(item.after_json) : null })), financials: { paid_to_date, outstanding_balance, overdue_amount } });
});

app.post("/contracts", (req, res) => {
  const at = nowIso();
  const a = actor(req.body);
  const startDate = new Date(req.body.start_date || at);
  const startIso = startDate.toISOString();
  const monthly = cents(req.body.monthly_total);
  const term = Math.max(1, Number(req.body.term_months || 1));
  const vehiclePrice = cents(req.body.vehicle_price);
  const downPayment = cents(req.body.down_payment);
  const financedAmount = cents(req.body.financed_amount || vehiclePrice - downPayment);
  if (!req.body.client_name || !req.body.phone || monthly <= 0 || !req.body.vehicle_brand || !req.body.vehicle_model || !req.body.vin || !req.body.plate) return res.status(400).json({ error: "Invalid contract" });
  const suffix = String(Date.now()).slice(-4);
  const clientId = nextId("CL");
  const contractId = `KT-${suffix}`;
  const vehicleId = nextId("VEH");
  const gpsId = nextId("GPS");
  const tx = db.transaction(() => {
    const client = { id: clientId, full_name: req.body.client_name, phone: req.body.phone, address: req.body.address || "", national_id: req.body.national_id || "", emergency_contact_name: req.body.emergency_contact_name || "", emergency_contact_phone: req.body.emergency_contact_phone || "" };
    const contract = { id: contractId, client_id: clientId, vehicle_id: vehicleId, status: "ACTIVE", monthly_total: monthly, start_date: startIso, term_months: term, vehicle_price: vehiclePrice, down_payment: downPayment, financed_amount: financedAmount };
    db.prepare("INSERT INTO clients (id, full_name, phone, address, national_id, emergency_contact_name, emergency_contact_phone) VALUES (?, ?, ?, ?, ?, ?, ?)").run(client.id, client.full_name, client.phone, client.address, client.national_id, client.emergency_contact_name, client.emergency_contact_phone);
    db.prepare("INSERT INTO contracts (id, client_id, vehicle_id, status, monthly_total, start_date, term_months, vehicle_price, down_payment, financed_amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(contract.id, contract.client_id, contract.vehicle_id, contract.status, contract.monthly_total, contract.start_date, contract.term_months, contract.vehicle_price, contract.down_payment, contract.financed_amount);
    db.prepare("INSERT INTO vehicles VALUES (?, ?, ?, ?, ?, ?, ?)").run(vehicleId, req.body.vin, req.body.vehicle_brand, req.body.vehicle_model, req.body.plate, contractId, gpsId);
    db.prepare("INSERT INTO gps_devices VALUES (?, ?, ?, ?, ?, ?)").run(gpsId, vehicleId, "ONLINE", 11.5564, 104.9282, at);
    for (let i = 1; i <= term; i += 1) {
      const due = new Date(startDate);
      due.setUTCMonth(startDate.getUTCMonth() + i);
      const status = localDateKey(due) < localDateKey(new Date()) ? "OVERDUE" : "SCHEDULED";
      db.prepare("INSERT INTO installments VALUES (?, ?, ?, ?, ?, ?, ?)").run(nextId("INS"), contractId, i, due.toISOString(), monthly, status, null);
    }
    audit(a.actor_id, a.actor_role, "client", clientId, "client.created", null, client);
    audit(a.actor_id, a.actor_role, "contract", contractId, "contract.created", null, contract);
  });
  tx();
  refreshOverdueState();
  res.status(201).json(row<any>("SELECT * FROM contracts WHERE id = ?", [contractId]));
});

app.get("/installments", (req, res) => {
  refreshOverdueState();
  const contractId = req.query.contract_id ? String(req.query.contract_id) : null;
  const installments = contractId
    ? rows<any>("SELECT * FROM installments WHERE contract_id = ? ORDER BY seq_no", [contractId])
    : rows<any>("SELECT i.*, cl.full_name AS client FROM installments i JOIN contracts c ON c.id = i.contract_id JOIN clients cl ON cl.id = c.client_id ORDER BY i.due_date");
  const payments = rows<any>("SELECT * FROM payments ORDER BY recorded_at DESC LIMIT 20");
  res.json({ installments, payments });
});

app.get("/clients/:id", (req, res) => {
  refreshOverdueState();
  const client = row<any>("SELECT * FROM clients WHERE id = ?", [req.params.id]);
  if (!client) return res.status(404).json({ error: "Client not found" });
  const contracts = rows<any>("SELECT * FROM contracts WHERE client_id = ? ORDER BY start_date DESC", [client.id]);
  const contractIds = contracts.map((contract) => contract.id);
  const cases = rows<any>("SELECT * FROM collections_cases WHERE client_id = ? ORDER BY opened_at DESC", [client.id]);
  const payments = contractIds.length
    ? rows<any>(`SELECT * FROM payments WHERE contract_id IN (${contractIds.map(() => "?").join(",")}) ORDER BY recorded_at DESC`, contractIds)
    : [];
  const entityIds = [client.id, ...contractIds, ...cases.map((item) => item.id), ...payments.map((item) => item.id)];
  const auditRows = entityIds.length
    ? rows<any>(`SELECT id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json FROM audit WHERE entity_id IN (${entityIds.map(() => "?").join(",")}) ORDER BY ts`, entityIds)
    : [];
  res.json({
    client,
    contracts,
    payments,
    cases,
    audit: auditRows.map((item) => ({ ...item, before: item.before_json ? JSON.parse(item.before_json) : null, after: item.after_json ? JSON.parse(item.after_json) : null }))
  });
});

app.post("/payments", (req, res) => {
  const a = actor(req.body);
  if (a.actor_role !== "COLLECTIONS") return res.status(403).json({ error: "Forbidden" });
  const installment = row<any>("SELECT * FROM installments WHERE id = ?", [req.body.installment_id]);
  if (!installment || !["DUE", "OVERDUE"].includes(installment.status)) return res.status(409).json({ error: "Invalid installment transition" });
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [installment.contract_id]);
  const at = nowIso();
  const method = ["cash", "transfer", "aba", "wing"].includes(req.body.method) ? req.body.method : "cash";
  const payment = {
    id: nextId("PAY"),
    contract_id: installment.contract_id,
    installment_id: installment.id,
    amount: cents(req.body.amount || installment.amount_due),
    method,
    reference: req.body.reference || "",
    note: req.body.note || "",
    recorded_at: at,
    recorded_by: a.actor_id
  };
  const tx = db.transaction(() => {
    db.prepare("INSERT INTO payments (id, contract_id, installment_id, amount, method, reference, note, recorded_at, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(payment.id, payment.contract_id, payment.installment_id, payment.amount, payment.method, payment.reference, payment.note, payment.recorded_at, payment.recorded_by);
    db.prepare("UPDATE installments SET status = 'PAID', paid_at = ? WHERE id = ?").run(at, installment.id);
    audit(a.actor_id, a.actor_role, "payment", payment.id, "payment.recorded", null, payment);
    audit(a.actor_id, a.actor_role, "installment", installment.id, "installment.status_change", installment, { ...installment, status: "PAID", paid_at: at });
    const overdueLeft = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1", [installment.contract_id]);
    if (!overdueLeft && contract?.status === "OVERDUE") {
      db.prepare("UPDATE contracts SET status = 'ACTIVE' WHERE id = ?").run(contract.id);
      const openCase = row<any>("SELECT * FROM collections_cases WHERE contract_id = ? AND status != 'CLOSED' LIMIT 1", [contract.id]);
      if (openCase) {
        const cured = { ...openCase, status: "CURED", cured_at: at };
        db.prepare("UPDATE collections_cases SET status = 'CLOSED', cured_at = ? WHERE id = ?").run(at, openCase.id);
        audit(a.actor_id, a.actor_role, "case", openCase.id, "collections.cured", openCase, cured);
      }
      audit(a.actor_id, a.actor_role, "contract", contract.id, "contract.status_change", contract, { ...contract, status: "ACTIVE" });
      const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]);
      const openAlerts = rows<any>("SELECT * FROM alerts WHERE resolved_at IS NULL AND entity_id IN (?, ?)", [contract.id, vehicle?.id ?? ""]);
      for (const alert of openAlerts) {
        const resolved = { ...alert, resolved_at: at };
        db.prepare("UPDATE alerts SET resolved_at = ? WHERE id = ?").run(at, alert.id);
        audit(a.actor_id, a.actor_role, "alert", alert.id, "alert.resolved", alert, resolved);
      }
    }
  });
  tx();
  res.status(201).json(payment);
});

app.get("/collections", (_req, res) => {
  refreshOverdueState();
  const cases = rows<any>(
    "SELECT cc.*, cl.full_name AS client FROM collections_cases cc JOIN clients cl ON cl.id = cc.client_id JOIN contracts c ON c.id = cc.contract_id WHERE c.status = 'OVERDUE' AND cc.status != 'CLOSED' ORDER BY cc.id"
  );
  const actions = rows<any>("SELECT * FROM collection_actions ORDER BY performed_at");
  res.json({ cases, actions });
});

app.post("/collections/:id/sms", (req, res) => {
  const a = actor(req.body);
  if (a.actor_role !== "COLLECTIONS") return res.status(403).json({ error: "Forbidden" });
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase || kase.status !== "OPEN") return res.status(409).json({ error: "Invalid case transition" });
  const at = nowIso();
  const after = { ...kase, status: "SMS_SENT" };
  db.transaction(() => {
    db.prepare("UPDATE collections_cases SET status = 'SMS_SENT' WHERE id = ?").run(kase.id);
    db.prepare("INSERT INTO collection_actions VALUES (?, ?, ?, ?, ?)").run(nextId("ACT"), kase.id, "SMS", a.actor_id, at);
    audit(a.actor_id, a.actor_role, "case", kase.id, "collections.send_sms", kase, after);
  })();
  res.json(after);
});

app.post("/collections/:id/immobilize", (req, res) => {
  const a = actor(req.body);
  if (a.actor_role !== "COLLECTIONS") return res.status(403).json({ error: "Forbidden" });
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase || kase.status !== "SMS_SENT") return res.status(409).json({ error: "Invalid case transition" });
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [kase.contract_id]);
  const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]);
  const gps = row<any>("SELECT * FROM gps_devices WHERE vehicle_id = ?", [vehicle.id]);
  if (!gps || gps.status !== "ONLINE") return res.status(409).json({ error: "Invalid GPS transition" });
  const at = nowIso();
  const alert = { id: nextId("ALT"), severity: "CRITICAL", source: "GPS", entity_type: "vehicle", entity_id: vehicle.id, title: "Immobilizer armed", message: `${vehicle.plate} immobilizer armed for ${contract.id}`, created_at: at, acknowledged_at: null, resolved_at: null };
  db.transaction(() => {
    db.prepare("UPDATE collections_cases SET status = 'IMMOBILIZER_ARMED' WHERE id = ?").run(kase.id);
    db.prepare("UPDATE gps_devices SET status = 'IMMOBILIZER_ARMED', last_ping_at = ? WHERE id = ?").run(at, gps.id);
    db.prepare("INSERT INTO collection_actions VALUES (?, ?, ?, ?, ?)").run(nextId("ACT"), kase.id, "ARM_IMMOBILIZER", a.actor_id, at);
    db.prepare("INSERT INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(alert.id, alert.severity, alert.source, alert.entity_type, alert.entity_id, alert.title, alert.message, alert.created_at, null, null);
    audit(a.actor_id, a.actor_role, "case", kase.id, "collections.arm_immobilizer", kase, { ...kase, status: "IMMOBILIZER_ARMED" });
    audit(a.actor_id, a.actor_role, "vehicle", vehicle.id, "gps.status_change", jsonGps(gps), { ...jsonGps(gps), status: "IMMOBILIZER_ARMED", last_ping_at: at });
    audit(a.actor_id, a.actor_role, "alert", alert.id, "alert.created", null, alert);
  })();
  res.json(alert);
});

app.get("/gps", (_req, res) => {
  res.json({ vehicles: rows<any>("SELECT * FROM vehicles ORDER BY id"), gpsDevices: rows<any>("SELECT * FROM gps_devices ORDER BY id").map(jsonGps) });
});

app.get("/alerts", (_req, res) => res.json(rows<any>("SELECT * FROM alerts ORDER BY created_at DESC")));

app.post("/alerts/:id/ack", (req, res) => {
  const a = actor(req.body);
  const alert = row<any>("SELECT * FROM alerts WHERE id = ?", [req.params.id]);
  if (!alert || alert.acknowledged_at) return res.status(409).json({ error: "Invalid alert transition" });
  const after = { ...alert, acknowledged_at: nowIso() };
  db.prepare("UPDATE alerts SET acknowledged_at = ? WHERE id = ?").run(after.acknowledged_at, alert.id);
  audit(a.actor_id, a.actor_role, "alert", alert.id, "alert.acknowledge", alert, after);
  res.json(after);
});

app.get("/audit", (_req, res) => {
  res.json(rows<any>("SELECT id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json FROM audit ORDER BY ts").map((item) => ({ ...item, before: item.before_json ? JSON.parse(item.before_json) : null, after: item.after_json ? JSON.parse(item.after_json) : null })));
});

const server = app.listen(4000, "127.0.0.1", () => {
  console.log("EMC API listening on http://127.0.0.1:4000");
});

process.on("SIGTERM", () => server.close());
