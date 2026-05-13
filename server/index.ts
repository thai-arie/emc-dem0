import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, dbPath, nextId, nowIso, audit, rows, row } from "./db";
import { decideNextAction, decideRestoreAccess } from "./core/decisionEngine";

type Role = "ADMIN" | "SALES" | "FINANCE" | "COLLECTIONS_AGENT" | "OPS" | "CONTROLLER" | "VIEWER";
type Actor = { actor_id: string; actor_role: Role };
type SessionUser = { id: string; email: string; full_name: string; role: Role; status: "ACTIVE" | "DISABLED"; last_login_at: string | null };

const app = express();
app.use(cors({ origin: ["http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:5175", "http://127.0.0.1:5176", "http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:5176"], credentials: true }));
app.use(express.json());

const sessionSecret = process.env.EMC_SESSION_SECRET || "emc-local-session-secret";
const sessionCookie = "emc_session";
const authRoles: Role[] = ["ADMIN", "SALES", "FINANCE", "COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"];
const userStatuses = ["ACTIVE", "DISABLED"] as const;
const overdueGraceDays = 1;
const telegramNotifyUrl = process.env.TELEGRAM_NOTIFY_URL || "http://127.0.0.1:8081/notify";
const telegramAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID || "174324639";
const applicationDocumentUploadDir = path.join(process.cwd(), "server", "uploads", "application-documents");
const maxApplicationDocumentUploadBytes = 5 * 1024 * 1024;
const allowedApplicationDocumentExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const applicationDocumentMimeTypes: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png"
};

fs.mkdirSync(applicationDocumentUploadDir, { recursive: true });

type TelegramEvent = "SEND_REMINDER" | "APPROVE_IMMOBILIZER" | "EXECUTE_IMMOBILIZER" | "PAYMENT_RECEIVED" | "ACCESS_RESTORED";

function telegramMessage(event: TelegramEvent, contractId: string) {
  if (event === "SEND_REMINDER") {
    return `⚠️ EMC Notification

Contract: ${contractId}

Payment is overdue.
Please pay to avoid vehicle restriction.`;
  }
  if (event === "APPROVE_IMMOBILIZER") {
    return `⛔ EMC Action

Contract: ${contractId}

Vehicle restriction has been approved due to missed payment.
Please pay to avoid further enforcement.`;
  }
  if (event === "EXECUTE_IMMOBILIZER") {
    return `⛔ EMC Action

Contract: ${contractId}

Your vehicle has been restricted due to missed payment.
Please pay to restore access.`;
  }
  if (event === "PAYMENT_RECEIVED") {
    return `✅ EMC Update

Contract: ${contractId}

Payment received. Your account is being reviewed.`;
  }
  return `✅ EMC Access Restored

Contract: ${contractId}

Your balance is in good standing.
Vehicle access has been restored.`;
}



function normalizePhoneForTelegram(value: any) {
  return String(value || "").replace(/\D/g, "");
}

function notifyTelegram(eventType: string, payload: any = {}) {
  if (typeof payload === "string") payload = { contract_id: payload };

  let contractId =
    payload.contract_id ||
    payload.contractId ||
    payload.contract?.id ||
    payload.id ||
    null;

  if (contractId) {
    const resolvedFromCase = row<{ contract_id: string }>(
      `SELECT contract_id
       FROM collections_cases
       WHERE id = ?`,
      [contractId]
    )?.contract_id;

    if (resolvedFromCase) {
      contractId = resolvedFromCase;
    }
  }

  contractId = contractId || "unknown";

  const clientTelegramChatId =
    contractId !== "unknown"
      ? row<{ telegram_chat_id: string }>(
          `SELECT cl.telegram_chat_id
           FROM contracts c
           JOIN clients cl ON cl.id = c.client_id
           WHERE c.id = ?`,
          [contractId]
        )?.telegram_chat_id
      : "";

  const chat_id =
    payload.chat_id ||
    payload.telegram_chat_id ||
    payload.client?.telegram_chat_id ||
    clientTelegramChatId ||
    process.env.TELEGRAM_CHAT_ID ||
    process.env.TELEGRAM_ADMIN_CHAT_ID ||
    process.env.ADMIN_CHAT_ID ||
    process.env.ADMIN_CHAT_IDS ||
    telegramAdminChatId;

  console.log("[telegram routing]", {
    eventType,
    contractId,
    clientTelegramChatId,
    chat_id
  });

  const messages: Record<string, string> = {
    SEND_REMINDER:
      `⚠️ EMC Notification\n\nContract: ${contractId}\n\nPayment is overdue.\nPlease pay to avoid vehicle restriction.`,

    REQUEST_IMMOBILIZER:
      `⚠️ EMC Notification\n\nContract: ${contractId}\n\nPayment is still overdue.\nVehicle restriction has been requested.`,

    APPROVE_IMMOBILIZER:
      `⛔ EMC Action\n\nContract: ${contractId}\n\nVehicle restriction has been approved due to missed payment.\nPlease pay to avoid further enforcement.`,

    EXECUTE_IMMOBILIZER:
      `⛔ EMC Action\n\nContract: ${contractId}\n\nYour vehicle has been restricted due to missed payment.\nPlease pay to restore access.`,

    PAYMENT_RECEIVED:
      `✅ EMC Update\n\nContract: ${contractId}\n\nPayment received. Your account is being reviewed.`,

    ACCESS_RESTORED:
      `✅ EMC Access Restored\n\nContract: ${contractId}\n\nYour balance is in good standing.\nVehicle access has been restored.`
  };

  const message = messages[eventType] || `${eventType}\n\nContract: ${contractId}`;

  if (!chat_id) {
    console.warn("[telegram] skipped: missing chat_id", { eventType, contractId });
    return;
  }

  void fetch(telegramNotifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: String(chat_id).split(",")[0].trim(), message })
  })
    .then((r) => {
      console.log("Telegram notify:", eventType, contractId, "chat_id=", chat_id, "status=", r.status);
    })
    .catch((err) => {
      console.warn("[telegram] notify failed", eventType, err?.message || err);


    });
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        if (index < 0) return [decodeURIComponent(item), ""];
        return [decodeURIComponent(item.slice(0, index)), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function signSession(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token: string | undefined) {
  try {
    if (!token || !token.includes(".")) return null;
    const [payload, signature] = token.split(".");
    const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("base64url");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { id: string; role: Role; exp: number };
    if (!authRoles.includes(parsed.role) || parsed.exp < Date.now()) return null;
    const user = row<SessionUser>("SELECT id, email, full_name, role, status, last_login_at FROM users WHERE id = ?", [parsed.id]);
    if (!user || user.status !== "ACTIVE") return null;
    return user;
  } catch {
    return null;
  }
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const cookies = parseCookies(req.headers.cookie);
  const user = verifySession(cookies[sessionCookie]);
  if (!user) return res.status(401).json({ error: "Authentication required" });
  (req as express.Request & { user: SessionUser }).user = user;
  next();
}

function actor(req: express.Request): Actor {
  const user = (req as express.Request & { user: SessionUser }).user;
  return { actor_id: user.id, actor_role: user.role };
}

function can(action: "payment.record" | "gps.arm" | "contract.create" | "contract.update" | "contract.void" | "payment.reverse", role: Role) {
  if (role === "ADMIN") return true;
  if (action === "payment.record") return role === "COLLECTIONS_AGENT" || role === "FINANCE";
  if (action === "gps.arm") return role === "OPS";
  if (action === "contract.create") return false;
  if (action === "contract.void") return String(role) === "ADMIN";
  if (action === "contract.update" || action === "payment.reverse") return role === "FINANCE";
  return false;
}

function requirePermission(req: express.Request, res: express.Response, action: Parameters<typeof can>[0]) {
  const role = (req as express.Request & { user: SessionUser }).user.role;
  if (!can(action, role)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function userResponse(user: SessionUser) {
  return { id: user.id, email: user.email, full_name: user.full_name || user.email, role: user.role, status: user.status, is_active: user.status === "ACTIVE", last_login_at: user.last_login_at ?? null };
}

function jsonGps(gps: any) {
  return { ...gps, status: gpsStatusFromLatestAcknowledgedCommand(gps.id), last_position: { lat: gps.lat, lng: gps.lng } };
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

function addDaysToLocalDateKey(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

function cents(value: unknown) {
  return Math.round(Number(value || 0));
}

const applicationStages = ["DRAFT", "DOCS_PENDING", "BANK_REVIEW", "READY_TO_SIGN", "APPROVED", "REJECTED", "CANCELLED"] as const;
const applicationDocumentTypes = ["NATIONAL_ID_OR_PASSPORT", "DRIVER_LICENSE", "PROOF_OF_INCOME", "PROOF_OF_ADDRESS", "SIGNED_APPLICATION", "VEHICLE_DOCUMENTS", "OTHER"] as const;
const applicationDocumentStatuses = ["REQUIRED", "UPLOADED", "REVIEWED", "REJECTED", "WAIVED"] as const;
const requiredApplicationKycDocumentTypes = ["NATIONAL_ID_OR_PASSPORT", "DRIVER_LICENSE", "SIGNED_APPLICATION"] as const;
const partnerStatuses = ["ACTIVE", "INACTIVE"] as const;

function nullableText(value: unknown) {
  const next = String(value ?? "").trim();
  return next || null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function validateApplicationRecord(payload: any) {
  if (!String(payload.client_full_name || "").trim()) return "Client name is required";
  if (Number(payload.vehicle_price_cents) < 0) return "Vehicle price must be greater than or equal to 0";
  if (Number(payload.down_payment_cents) < 0) return "Down payment must be greater than or equal to 0";
  if (Number(payload.down_payment_cents) > Number(payload.vehicle_price_cents)) return "Down payment cannot exceed vehicle price";
  if (Number(payload.apr_pct) < 0) return "APR must be greater than or equal to 0";
  if (Number(payload.term_months) <= 0) return "Term months must be greater than 0";
  if (!(applicationStages as readonly string[]).includes(payload.stage)) return "Invalid application stage";
  return null;
}

function normalizeApplicationPayload(body: any, existing?: any) {
  const vehiclePrice = cents(body.vehicle_price_cents ?? existing?.vehicle_price_cents ?? 0);
  const downPayment = cents(body.down_payment_cents ?? existing?.down_payment_cents ?? 0);
  const downPaymentPct =
    body.down_payment_pct !== undefined
      ? Number(body.down_payment_pct)
      : vehiclePrice > 0
        ? Number(((downPayment / vehiclePrice) * 100).toFixed(2))
        : Number(existing?.down_payment_pct ?? 0);

  return {
    client_full_name: String(body.client_full_name ?? existing?.client_full_name ?? "").trim(),
    client_phone: String(body.client_phone ?? existing?.client_phone ?? "").trim(),
    client_national_id: nullableText(body.client_national_id ?? existing?.client_national_id),
    vehicle_catalog_id: nullableText(body.vehicle_catalog_id ?? existing?.vehicle_catalog_id),
    vehicle_brand: String(body.vehicle_brand ?? existing?.vehicle_brand ?? "").trim(),
    vehicle_model: String(body.vehicle_model ?? existing?.vehicle_model ?? "").trim(),
    vehicle_year: numberOrNull(body.vehicle_year ?? existing?.vehicle_year),
    vehicle_price_cents: vehiclePrice,
    vehicle_cost_cents: numberOrNull(body.vehicle_cost_cents ?? existing?.vehicle_cost_cents),
    down_payment_cents: downPayment,
    down_payment_pct: downPaymentPct,
    term_months: Math.round(Number(body.term_months ?? existing?.term_months ?? 1)),
    apr_pct: Number(body.apr_pct ?? existing?.apr_pct ?? 0),
    pricing_tier_id: nullableText(body.pricing_tier_id ?? existing?.pricing_tier_id),
    financial_partner_id: nullableText(body.financial_partner_id ?? existing?.financial_partner_id),
    insurance_partner_id: nullableText(body.insurance_partner_id ?? existing?.insurance_partner_id),
    bank_account_id: nullableText(body.bank_account_id ?? existing?.bank_account_id),
    bank_funded_amount_cents: numberOrNull(body.bank_funded_amount_cents ?? existing?.bank_funded_amount_cents),
    emc_funded_amount_cents: numberOrNull(body.emc_funded_amount_cents ?? existing?.emc_funded_amount_cents),
    settlement_mode: String(body.settlement_mode ?? existing?.settlement_mode ?? "partner_pass_through").trim(),
    closure_mode: String(body.closure_mode ?? existing?.closure_mode ?? "standard_signing").trim(),
    stage: String(body.stage ?? existing?.stage ?? "DRAFT").trim().toUpperCase(),
    notes: String(body.notes ?? existing?.notes ?? "").trim(),
    rejected_reason: nullableText(body.rejected_reason ?? existing?.rejected_reason)
  };
}

function normalizeApplicationDocumentPayload(body: any, existing?: any) {
  return {
    document_type: String(body.document_type ?? existing?.document_type ?? "").trim().toUpperCase(),
    status: String(body.status ?? existing?.status ?? "REQUIRED").trim().toUpperCase(),
    file_name: nullableText(body.file_name ?? existing?.file_name),
    storage_key: nullableText(body.storage_key ?? existing?.storage_key),
    notes: String(body.notes ?? existing?.notes ?? "").trim()
  };
}

function validateApplicationDocumentPayload(payload: any, role: Role) {
  if (!(applicationDocumentTypes as readonly string[]).includes(payload.document_type)) return "Invalid document type";
  if (!(applicationDocumentStatuses as readonly string[]).includes(payload.status)) return "Invalid document status";
  if (role === "SALES" && !["REQUIRED", "UPLOADED"].includes(payload.status)) return "Sales can only mark documents required or uploaded";
  return null;
}

function documentMetadataForStatus(payload: any, existing: any | null, actorPayload: Actor, at: string) {
  const next = {
    uploaded_by: existing?.uploaded_by ?? null,
    reviewed_by: existing?.reviewed_by ?? null,
    uploaded_at: existing?.uploaded_at ?? null,
    reviewed_at: existing?.reviewed_at ?? null
  };
  if (payload.status === "UPLOADED" && (!existing || existing.status !== "UPLOADED" || !existing.uploaded_at)) {
    next.uploaded_by = actorPayload.actor_id;
    next.uploaded_at = at;
  }
  if (["REVIEWED", "REJECTED", "WAIVED"].includes(payload.status) && (!existing || existing.status !== payload.status || !existing.reviewed_at)) {
    next.reviewed_by = actorPayload.actor_id;
    next.reviewed_at = at;
  }
  return next;
}

function documentTypeLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function splitMultipartBuffer(buffer: Buffer, boundary: Buffer) {
  const parts: Buffer[] = [];
  let start = buffer.indexOf(boundary);
  while (start !== -1) {
    start += boundary.length;
    if (buffer[start] === 45 && buffer[start + 1] === 45) break;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;
    const end = buffer.indexOf(boundary, start);
    if (end === -1) break;
    let part = buffer.subarray(start, end);
    if (part.length >= 2 && part[part.length - 2] === 13 && part[part.length - 1] === 10) {
      part = part.subarray(0, part.length - 2);
    }
    parts.push(part);
    start = end;
  }
  return parts;
}

function parseSingleMultipartFile(req: express.Request) {
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return { error: "Missing multipart boundary" };
  if (!Buffer.isBuffer(req.body)) return { error: "Invalid upload body" };
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  for (const part of splitMultipartBuffer(req.body, boundary)) {
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd < 0) continue;
    const headerText = part.subarray(0, headerEnd).toString("utf8");
    const content = part.subarray(headerEnd + 4);
    const disposition = headerText.match(/content-disposition:[^\r\n]+/i)?.[0] || "";
    const filenameMatch = disposition.match(/filename="([^"]*)"/i);
    if (!filenameMatch || !filenameMatch[1]) continue;
    const contentTypeMatch = headerText.match(/content-type:\s*([^\r\n]+)/i);
    return {
      originalName: path.basename(filenameMatch[1]),
      mimeType: contentTypeMatch?.[1]?.trim() || "application/octet-stream",
      buffer: content
    };
  }
  return { error: "Upload file is required" };
}

function safeApplicationDocumentStorageKey(documentId: string, originalName: string) {
  const extension = path.extname(originalName).toLowerCase();
  if (!allowedApplicationDocumentExtensions.has(extension)) return null;
  return `${documentId}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`;
}

function validatePartnerStatus(value: unknown) {
  const status = String(value || "").trim().toUpperCase();
  return (partnerStatuses as readonly string[]).includes(status) ? status : null;
}

function normalizeFinancialPartnerPayload(body: any, existing?: any) {
  return {
    name: String(body.name ?? existing?.name ?? "").trim(),
    funding_type: String(body.funding_type ?? existing?.funding_type ?? "").trim(),
    cost_rate_pct: Number(body.cost_rate_pct ?? existing?.cost_rate_pct ?? 0),
    active_contracts_count: Math.max(0, Math.round(Number(body.active_contracts_count ?? existing?.active_contracts_count ?? 0))),
    status: String(body.status ?? existing?.status ?? "ACTIVE").trim().toUpperCase(),
    notes: String(body.notes ?? existing?.notes ?? "").trim()
  };
}

function validateFinancialPartnerPayload(payload: any) {
  if (!payload.name) return "Partner name is required";
  if (!Number.isFinite(payload.cost_rate_pct) || payload.cost_rate_pct < 0) return "Cost rate cannot be negative";
  if (!(partnerStatuses as readonly string[]).includes(payload.status)) return "Invalid partner status";
  return null;
}

function normalizeInsurancePartnerPayload(body: any, existing?: any) {
  return {
    name: String(body.name ?? existing?.name ?? "").trim(),
    premium_pct: Number(body.premium_pct ?? existing?.premium_pct ?? 0),
    commission_pct: Number(body.commission_pct ?? existing?.commission_pct ?? 0),
    settlement_timing: String(body.settlement_timing ?? existing?.settlement_timing ?? "").trim(),
    status: validatePartnerStatus(body.status ?? existing?.status ?? "ACTIVE") ?? "ACTIVE",
    notes: String(body.notes ?? existing?.notes ?? "").trim()
  };
}

function validateInsurancePartnerPayload(payload: any) {
  if (!payload.name) return "Partner name is required";
  if (!Number.isFinite(payload.premium_pct) || payload.premium_pct < 0) return "Premium cannot be negative";
  if (!Number.isFinite(payload.commission_pct) || payload.commission_pct < 0) return "Commission cannot be negative";
  if (!(partnerStatuses as readonly string[]).includes(payload.status)) return "Invalid partner status";
  return null;
}

function wholeNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? Math.round(next) : null;
}

function normalizeVehicleCatalogPayload(body: any, existing?: any) {
  return {
    brand: String(body.brand ?? existing?.brand ?? "").trim(),
    model: String(body.model ?? existing?.model ?? "").trim(),
    variant: nullableText(body.variant ?? existing?.variant),
    year: wholeNumberOrNull(body.year ?? existing?.year),
    category: nullableText(body.category ?? existing?.category),
    default_price_cents: cents(body.default_price_cents ?? existing?.default_price_cents ?? 0),
    default_cost_cents: numberOrNull(body.default_cost_cents ?? existing?.default_cost_cents),
    stock_count: Math.round(Number(body.stock_count ?? existing?.stock_count ?? 0)),
    status: validatePartnerStatus(body.status ?? existing?.status ?? "ACTIVE") ?? "ACTIVE",
    notes: nullableText(body.notes ?? existing?.notes)
  };
}

function validateVehicleCatalogPayload(payload: any) {
  if (!payload.brand) return "Brand is required";
  if (!payload.model) return "Model is required";
  if (!Number.isFinite(payload.default_price_cents) || payload.default_price_cents < 0) return "Default price must be greater than or equal to 0";
  if (payload.default_cost_cents !== null && (!Number.isFinite(payload.default_cost_cents) || payload.default_cost_cents < 0)) return "Default cost must be greater than or equal to 0";
  if (!Number.isFinite(payload.stock_count) || payload.stock_count < 0) return "Stock count must be greater than or equal to 0";
  if (!(partnerStatuses as readonly string[]).includes(payload.status)) return "Invalid vehicle status";
  return null;
}

function installmentStatusForDate(installment: any, today = localDateKey(new Date())) {
  if (installment.status === "PAID" || installment.status === "CANCELLED_BY_PREPAYMENT") return installment.status;
  const dueDate = localDateKey(installment.due_date);
  const graceEnds = addDaysToLocalDateKey(dueDate, overdueGraceDays);
  if (graceEnds < today) return "OVERDUE";
  if (dueDate === today) return "DUE";
  if (dueDate < today) return "DUE";
  return "SCHEDULED";
}

function outstandingForContract(contractId: string) {
  // Outstanding is schedule-based: only fully paid or cancelled installments reduce it.
  // PAY_AHEAD leftover remains unapplied credit on the payment and does not reduce outstanding.
  return row<{ value: number }>(
    "SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE contract_id = ? AND status NOT IN ('PAID', 'CANCELLED_BY_PREPAYMENT')",
    [contractId]
  )?.value ?? 0;
}

function totalOutstanding() {
  // Same schedule-based accounting as outstandingForContract; unapplied credits stay visible on payments.
  return row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE status NOT IN ('PAID', 'CANCELLED_BY_PREPAYMENT')")?.value ?? 0;
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
      db.prepare("INSERT INTO gps_devices (id, vehicle_id, status, lat, lng, last_ping_at) VALUES (?, ?, ?, ?, ?, ?)").run(gpsId, vehicleId, "ONLINE", 11.5564 + ((i % 9) - 4) * 0.01, 104.9282 + ((i % 7) - 3) * 0.012, at);
      for (let m = 1; m <= 36; m += 1) {
        const dueDate = addMonths("2025-01-01T00:00:00.000Z", m);
        const status = special ? (m === 15 ? "OVERDUE" : m < 15 ? "PAID" : "SCHEDULED") : m <= 16 ? "PAID" : "SCHEDULED";
        db.prepare("INSERT INTO installments VALUES (?, ?, ?, ?, ?, ?, ?)").run(`INS-${suffix}-${String(m).padStart(2, "0")}`, contractId, m, dueDate, monthly, status, status === "PAID" ? dueDate : null);
      }
    }
    db.prepare(
      "INSERT INTO collections_cases (id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("COL-0341", "KT-0341", "CL-0341", "OPEN", at, null, "SEND_REMINDER", at, "");
  });
  tx();
}

function seedUsersIfEmpty() {
  const at = nowIso();
  const defaults: Array<{ email: string; full_name: string; role: Role }> = [
    { email: "admin@emc.local", full_name: "EMC Admin", role: "ADMIN" },
    { email: "sales@emc.local", full_name: "Sales Intake", role: "SALES" },
    { email: "finance@emc.local", full_name: "Finance Underwriting", role: "FINANCE" },
    { email: "collections@emc.local", full_name: "Collections Agent", role: "COLLECTIONS_AGENT" },
    { email: "ops@emc.local", full_name: "Operations", role: "OPS" },
    { email: "controller@emc.local", full_name: "Controller", role: "CONTROLLER" },
    { email: "viewer@emc.local", full_name: "Readonly Viewer", role: "VIEWER" }
  ];
  const passwordHash = bcrypt.hashSync("123456", 10);
  const tx = db.transaction(() => {
    for (const user of defaults) {
      const existing = row<any>("SELECT * FROM users WHERE email = ?", [user.email]);
      if (existing) {
        db.prepare("UPDATE users SET full_name = COALESCE(NULLIF(full_name, ''), ?), role = ?, status = COALESCE(NULLIF(status, ''), 'ACTIVE'), updated_at = ? WHERE id = ?").run(user.full_name, user.role, at, existing.id);
      } else {
        db.prepare("INSERT INTO users (id, full_name, email, password_hash, role, status, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
          nextId("USR"),
          user.full_name,
          user.email,
          passwordHash,
          user.role,
          "ACTIVE",
          at,
          at,
          null
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
    const created = { id: caseId, contract_id: contract.id, client_id: contract.client_id, status: "OPEN", opened_at: at, cured_at: null, next_action_type: "SEND_REMINDER", next_action_date: at, assigned_agent_id: "" };
    db.prepare(
      "INSERT INTO collections_cases (id, contract_id, client_id, status, opened_at, cured_at, next_action_type, next_action_date, assigned_agent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(caseId, contract.id, contract.client_id, "OPEN", at, null, "SEND_REMINDER", at, "");
    audit("USR-COL", "COLLECTIONS_AGENT", "case", caseId, "collections.case_created", null, created);
  }
}

function gpsForCase(kase: any) {
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [kase.contract_id]);
  const vehicle = contract ? row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]) : null;
  const gps = vehicle ? row<any>("SELECT * FROM gps_devices WHERE vehicle_id = ?", [vehicle.id]) : null;
  return { contract, vehicle, gps };
}

function gpsStatusFromLatestAcknowledgedCommand(deviceId: string) {
  const command = row<any>(
    "SELECT command_type FROM gps_commands WHERE device_id = ? AND status = 'ACKNOWLEDGED' ORDER BY created_at DESC LIMIT 1",
    [deviceId]
  );
  if (!command) return "ONLINE";
  return command.command_type === "IMMOBILIZE" ? "IMMOBILIZER_ARMED" : "ONLINE";
}

function latestAcknowledgedCommand(deviceId: string) {
  return row<any>(
    "SELECT * FROM gps_commands WHERE device_id = ? AND status = 'ACKNOWLEDGED' ORDER BY created_at DESC LIMIT 1",
    [deviceId]
  );
}

function computedDeviceStatus(device: any) {
  if (missingIdentityReason(device)) return "WARNING";
  const command = latestAcknowledgedCommand(device.id);
  if (!command) return "ONLINE";
  return command.command_type === "IMMOBILIZE" ? "RESTRICTED" : "ONLINE";
}

function missingIdentityReason(device: any) {
  const missingImei = !String(device.imei || "").trim();
  const missingProvider = !String(device.provider || "").trim();
  if (missingImei && missingProvider) return "Missing IMEI and provider";
  if (missingImei) return "Missing IMEI";
  if (missingProvider) return "Missing provider";
  return null;
}

function mockBattery(deviceId: string) {
  const numeric = Number(String(deviceId).replace(/\D/g, "")) || 0;
  return 62 + (numeric % 31);
}

function deviceHealthAlert(deviceId: string) {
  const failedRelease = row<any>(
    "SELECT * FROM gps_commands WHERE device_id = ? AND command_type = 'RELEASE' AND status = 'FAILED' ORDER BY created_at DESC LIMIT 1",
    [deviceId]
  );
  return failedRelease ? "FAILED_RELEASE" : null;
}

function deviceManagementRow(device: any) {
  const latestAck = latestAcknowledgedCommand(device.id);
  const missingReason = missingIdentityReason(device);
  return {
    device_id: device.id,
    id: device.id,
    vehicle_id: device.vehicle_id,
    contract_id: device.contract_id,
    client_id: device.client_id,
    client_name: device.client_name,
    imei: device.imei || "",
    sim: device.sim_number || "",
    sim_number: device.sim_number || "",
    provider: device.provider || "",
    last_seen_at: device.last_ping_at,
    battery: mockBattery(device.id),
    ignition: device.ignition_status || "OFF",
    latest_acknowledged_command_type: latestAck?.command_type ?? null,
    latest_acknowledged_command_status: latestAck?.status ?? null,
    latest_acknowledged_command_at: latestAck?.executed_at ?? latestAck?.created_at ?? null,
    computed_device_status: computedDeviceStatus(device),
    status: computedDeviceStatus(device),
    last_command: device.last_command || "",
    last_command_status: device.last_command_status || "",
    can_send_command: !missingReason,
    missing_identity_reason: missingReason,
    device_health_alert: deviceHealthAlert(device.id)
  };
}

function reconcileGpsStatusFromCommands() {
  const devices = rows<any>("SELECT * FROM gps_devices");
  const tx = db.transaction(() => {
    for (const device of devices) {
      const nextStatus = gpsStatusFromLatestAcknowledgedCommand(device.id);
      if (device.status !== nextStatus) {
        db.prepare("UPDATE gps_devices SET status = ? WHERE id = ?").run(nextStatus, device.id);
      }
    }
  });
  tx();
}


function activeGpsCommand(deviceId: string) {
  return row<any>(
    "SELECT * FROM gps_commands WHERE device_id = ? AND status IN ('REQUESTED', 'SENT') ORDER BY created_at DESC LIMIT 1",
    [deviceId]
  );
}

function simulateMockGpsProvider(commandId: string, gps: any, vehicle: any, a: Actor, shouldFail = false) {
  setTimeout(() => {
    const command = row<any>("SELECT * FROM gps_commands WHERE id = ?", [commandId]);
    const currentGps = row<any>("SELECT * FROM gps_devices WHERE id = ?", [gps.id]);
    if (!command || !currentGps || command.status !== "SENT") return;
    const at = nowIso();
    if (shouldFail) {
      db.transaction(() => {
        db.prepare("UPDATE gps_commands SET status = 'FAILED', provider_response = ? WHERE id = ?").run("Mock provider failed command", command.id);
        db.prepare("UPDATE gps_devices SET last_command_status = 'FAILED', last_command_at = ? WHERE id = ?").run(at, gps.id);
        db.prepare(
          "INSERT INTO alerts (id, severity, source, entity_type, entity_id, title, message, created_at, acknowledged_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          nextId("ALT"),
          "CRITICAL",
          "GPS",
          "vehicle",
          vehicle.id,
          "GPS command failed",
          `${command.command_type} command failed for GPS device ${gps.id}`,
          at,
          null,
          null
        );
        audit(a.actor_id, a.actor_role, "vehicle", vehicle.id, "gps.command_failed", jsonGps(currentGps), { ...jsonGps(currentGps), last_command_status: "FAILED", last_command_at: at, failed_command_id: command.id });
      })();
      syncDerivedAlerts();
      return;
    }
    const nextGpsStatus = command.command_type === "RELEASE" ? "ONLINE" : "IMMOBILIZER_ARMED";
    const providerResponse = command.command_type === "RELEASE" ? "Mock provider acknowledged release" : "Mock provider acknowledged command";
    db.transaction(() => {
      db.prepare("UPDATE gps_commands SET status = 'ACKNOWLEDGED', provider_response = ? WHERE id = ?").run(providerResponse, command.id);
      db.prepare("UPDATE gps_devices SET status = ?, last_ping_at = ?, last_command_status = 'ACKNOWLEDGED', last_command_at = ? WHERE id = ?").run(nextGpsStatus, at, at, gps.id);

      db.prepare(
        "UPDATE alerts SET resolved_at = ? WHERE source = 'GPS' AND resolved_at IS NULL AND title IN ('GPS command failed', 'GPS command timeout') AND entity_id IN (?, ?)"
      ).run(at, vehicle.id, gps.id);
      audit(a.actor_id, a.actor_role, "vehicle", vehicle.id, "gps.status_change", jsonGps(currentGps), { ...jsonGps(currentGps), status: nextGpsStatus, last_ping_at: at, last_command_status: "ACKNOWLEDGED", last_command_at: at });
    })();
    reconcileGpsStatusFromCommands();
    syncDerivedAlerts();
    if (command.command_type === "RELEASE") {
      const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [vehicle.contract_id]);
      if (contract) notifyTelegram("ACCESS_RESTORED", contract.id);
    }
  }, 250);
}

function executeRestoreAccessCommand(contract: any, vehicle: any, gps: any, a: Actor, at = nowIso()) {
  const existing = row<any>(
    "SELECT * FROM gps_commands WHERE device_id = ? AND command_type = 'RELEASE' AND status IN ('APPROVED', 'SENT') ORDER BY created_at DESC LIMIT 1",
    [gps.id]
  );
  const commandId = existing?.id ?? nextId("CMD");
  db.transaction(() => {
    if (!existing) {
      db.prepare("INSERT INTO gps_commands (id, device_id, command_type, requested_by, approved_by, status, provider_response, created_at, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        commandId,
        gps.id,
        "RELEASE",
        a.actor_id,
        a.actor_id,
        "SENT",
        "",
        at,
        at
      );
    } else if (existing.status === "APPROVED") {
      db.prepare("UPDATE gps_commands SET status = 'SENT', executed_at = ? WHERE id = ?").run(at, existing.id);
    }
    db.prepare("UPDATE gps_devices SET last_command = 'RELEASE', last_command_status = 'SENT', last_command_at = ? WHERE id = ?").run(at, gps.id);
    const kase = row<any>("SELECT * FROM collections_cases WHERE contract_id = ? ORDER BY opened_at DESC LIMIT 1", [contract.id]);
    if (kase) {
      db.prepare("UPDATE collections_cases SET next_action_type = 'COLLECT_PAYMENT', next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(at, a.actor_id, kase.id);
      audit(a.actor_id, a.actor_role, "case", kase.id, "restore_access.execute", kase, { ...kase, next_action_type: "COLLECT_PAYMENT", next_action_date: at, assigned_agent_id: a.actor_id, decision_reason: "AUTO_RESTORE" });
    }
  })();
  simulateMockGpsProvider(commandId, gps, vehicle, a);
  return commandId;
}

function evaluateRestoreAfterPayment(contractId: string, a: Actor, at = nowIso()) {
  reconcileGpsStatusFromCommands();
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [contractId]);
  const vehicle = contract ? row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]) : null;
  const gps = vehicle ? row<any>("SELECT * FROM gps_devices WHERE vehicle_id = ?", [vehicle.id]) : null;
  if (!contract || !vehicle || !gps || gps.status !== "IMMOBILIZER_ARMED") {
    notifyTelegram("PAYMENT_RECEIVED", contractId);
    return;
  }

  const overdueAmount = row<{ value: number }>(
    "SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE contract_id = ? AND status = 'OVERDUE'",
    [contract.id]
  )?.value ?? 0;
  const firstOverdue = row<any>("SELECT due_date FROM installments WHERE contract_id = ? AND status = 'OVERDUE' ORDER BY due_date, seq_no LIMIT 1", [contract.id]);
  const dpd = firstOverdue ? Math.max(0, Math.floor((new Date(localDateKey(new Date())).getTime() - new Date(`${localDateKey(firstOverdue.due_date)}T00:00:00`).getTime()) / 86400000)) : 0;
  const otherActiveOverdueContracts = row<{ value: number }>(
    "SELECT COUNT(*) AS value FROM contracts WHERE client_id = ? AND id != ? AND status = 'OVERDUE'",
    [contract.client_id, contract.id]
  )?.value ?? 0;
  const decision = decideRestoreAccess({ dpd, overdueAmount, otherActiveOverdueContracts });
  audit(
    a.actor_id,
    a.actor_role,
    "contract",
    contract.id,
    "restore_access.decision",
    null,
    { decision_reason: decision.decisionReason, dpd, overdue_amount: overdueAmount, other_active_overdue_contracts: otherActiveOverdueContracts }
  );


  notifyTelegram("PAYMENT_RECEIVED", contract.id);
}

function cureContractIfNoOverdue(contract: any, a: Actor, at: string) {
  const overdueLeft = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1", [contract.id]);
  if (overdueLeft) return;

  if (contract.status === "OVERDUE") {
    db.prepare("UPDATE contracts SET status = 'ACTIVE' WHERE id = ?").run(contract.id);
    audit(a.actor_id, a.actor_role, "contract", contract.id, "contract.status_change", contract, { ...contract, status: "ACTIVE" });
  }

  const openCases = rows<any>("SELECT * FROM collections_cases WHERE contract_id = ? AND status != 'CLOSED'", [contract.id]);
  for (const openCase of openCases) {
    const cured = { ...openCase, status: "CURED", cured_at: at };
    db.prepare("UPDATE collections_cases SET status = 'CLOSED', cured_at = ? WHERE id = ?").run(at, openCase.id);
    audit(a.actor_id, a.actor_role, "case", openCase.id, "collections.cured", openCase, cured);
  }

  const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]);
  const openAlerts = rows<any>("SELECT * FROM alerts WHERE resolved_at IS NULL AND entity_id = ?", [contract.id]);
  for (const alert of openAlerts) {
    const resolved = { ...alert, resolved_at: at };
    db.prepare("UPDATE alerts SET resolved_at = ? WHERE id = ?").run(at, alert.id);
    audit(a.actor_id, a.actor_role, "alert", alert.id, "alert.resolved", alert, resolved);
  }
}

function recalculateContractStatus(contractId: string, a: Actor = { actor_id: "SYSTEM", actor_role: "ADMIN" }, at = nowIso()) {
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [contractId]);
  if (!contract) return null;
  const overdue = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1", [contractId]);
  if (overdue) {
    if (contract.status !== "OVERDUE") {
      db.prepare("UPDATE contracts SET status = 'OVERDUE' WHERE id = ?").run(contract.id);
    }
    ensureCollectionCase(contract.id, at);
    return { ...contract, status: "OVERDUE" };
  }
  cureContractIfNoOverdue(contract, a, at);
  return { ...contract, status: "ACTIVE" };
}

function repairCorruptedSeedSchedules() {
  const corruptedSeedContracts = rows<any>(`
    SELECT c.*
    FROM contracts c
    WHERE (c.id = 'KT-0341' OR c.id GLOB 'KT-[0-9][0-9][0-9]')
      AND EXISTS (
        SELECT 1
        FROM installments i
        WHERE i.contract_id = c.id
        GROUP BY i.due_date
        HAVING COUNT(*) >= 3
      )
  `);
  if (!corruptedSeedContracts.length) return;
  const today = localDateKey(new Date());
  const tx = db.transaction(() => {
    for (const contract of corruptedSeedContracts) {
      const installments = rows<any>("SELECT * FROM installments WHERE contract_id = ? ORDER BY seq_no", [contract.id]);
      for (const installment of installments) {
        const dueDate = addMonths(contract.start_date, installment.seq_no);
        const status = installmentStatusForDate({ ...installment, due_date: dueDate }, today);
        const paidAt = status === "PAID" ? installment.paid_at : null;
        if (installment.due_date !== dueDate || installment.status !== status || installment.paid_at !== paidAt) {
          db.prepare("UPDATE installments SET due_date = ?, status = ?, paid_at = ? WHERE id = ?").run(dueDate, status, paidAt, installment.id);
        }
      }
      recalculateContractStatus(contract.id);
    }
  });
  tx();
}

function derivedAlerts() {
  const contracts = rows<any>("SELECT c.*, cl.full_name AS client FROM contracts c JOIN clients cl ON cl.id = c.client_id");
  const vehicles = rows<any>("SELECT * FROM vehicles");

  const gpsDevices = rows<any>("SELECT * FROM gps_devices");
  const openCases = rows<any>("SELECT * FROM collections_cases WHERE status NOT IN ('CLOSED', 'CURED')");
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const gpsByVehicleId = new Map(gpsDevices.map((gps) => [gps.vehicle_id, gps]));
  const caseByContractId = new Map(openCases.map((kase) => [kase.contract_id, kase]));
  const alerts: any[] = [];

  for (const contract of contracts) {
    const vehicle = vehiclesById.get(contract.vehicle_id);
    const gps = vehicle ? gpsByVehicleId.get(vehicle.id) : null;
    const openCase = caseByContractId.get(contract.id);
    const isArmed = gps?.status === "IMMOBILIZER_ARMED";
    if (isArmed && vehicle && gps) {
      alerts.push({
        id: `DERIVED-IMMOBILIZER-${gps.id}`,
        severity: "CRITICAL",
        source: "GPS",
        entity_type: "vehicle",
        entity_id: vehicle.id,
        title: "Immobilizer armed",
        message: `${vehicle.plate} immobilizer armed for ${contract.id}`,
        created_at: gps.last_ping_at,
        acknowledged_at: null,
        resolved_at: null
      });
      continue;
    }
    if (contract.status === "OVERDUE" || openCase) {
      const firstOverdue = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' ORDER BY due_date, seq_no LIMIT 1", [contract.id]);
      alerts.push({
        id: `DERIVED-OVERDUE-${contract.id}`,
        severity: "WARN",
        source: "COLLECTIONS",
        entity_type: "contract",
        entity_id: contract.id,
        title: "Overdue contract",
        message: `${contract.id} has an unpaid overdue installment`,
        created_at: firstOverdue?.due_date ?? openCase?.opened_at ?? nowIso(),
        acknowledged_at: null,
        resolved_at: null
      });
    }
  }

  return alerts;
}

function syncDerivedAlerts() {
  reconcileGpsStatusFromCommands();
  const at = nowIso();
  const desired = derivedAlerts();
  const desiredIds = new Set(desired.map((alert) => alert.id));
  const tx = db.transaction(() => {
    for (const alert of desired) {
      const existing = row<any>("SELECT * FROM alerts WHERE id = ?", [alert.id]);
      if (existing) {
        db.prepare(
          "UPDATE alerts SET severity = ?, source = ?, entity_type = ?, entity_id = ?, title = ?, message = ?, created_at = ?, resolved_at = NULL WHERE id = ?"
        ).run(alert.severity, alert.source, alert.entity_type, alert.entity_id, alert.title, alert.message, alert.created_at, alert.id);
      } else {
        db.prepare("INSERT INTO alerts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(alert.id, alert.severity, alert.source, alert.entity_type, alert.entity_id, alert.title, alert.message, alert.created_at, null, null);
      }
    }

    const stale = rows<any>("SELECT * FROM alerts WHERE resolved_at IS NULL AND severity IN ('WARN', 'CRITICAL')");
    for (const alert of stale) {
      if (!desiredIds.has(alert.id)) {
        db.prepare("UPDATE alerts SET resolved_at = ? WHERE id = ?").run(at, alert.id);
      }
    }
  });
  tx();
  return rows<any>(
    "SELECT * FROM alerts WHERE id LIKE 'DERIVED-%' AND resolved_at IS NULL ORDER BY CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'WARN' THEN 1 ELSE 2 END, created_at DESC"
  );
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysBetweenLocalDates(from: string, to = new Date()) {
  const fromDate = startOfLocalDay(new Date(from));
  const toDate = startOfLocalDay(to);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000);
}

function isoFromDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function reportingSummary() {
  const contracts = rows<any>("SELECT * FROM contracts");
  const totalContracts = contracts.length;
  const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE").length;
  const overdueContracts = contracts.filter((contract) => contract.status === "OVERDUE").length;
  const totalOutstanding = row<{ value: number }>(
    "SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE status NOT IN ('PAID', 'CANCELLED_BY_PREPAYMENT')"
  )?.value ?? 0;
  const totalOverdueAmount = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE status = 'OVERDUE'")?.value ?? 0;
  const now = new Date();
  const todayKey = localDateKey(now);
  const sevenDaysAgo = isoFromDaysAgo(6);
  const thirtyDaysAgo = isoFromDaysAgo(29);
  const collectedToday = row<{ value: number }>("SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE substr(recorded_at, 1, 10) = ?", [todayKey])?.value ?? 0;
  const collected7Days = row<{ value: number }>("SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE recorded_at >= ?", [sevenDaysAgo])?.value ?? 0;
  const collected30Days = row<{ value: number }>("SELECT COALESCE(SUM(amount), 0) AS value FROM payments WHERE recorded_at >= ?", [thirtyDaysAgo])?.value ?? 0;
  const totalCollected = row<{ value: number }>("SELECT COALESCE(SUM(amount), 0) AS value FROM payments")?.value ?? 0;
  const openCases = row<{ value: number }>("SELECT COUNT(*) AS value FROM collections_cases WHERE status NOT IN ('CLOSED', 'CURED')")?.value ?? 0;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const casesCuredThisMonth = row<{ value: number }>("SELECT COUNT(*) AS value FROM collections_cases WHERE cured_at >= ?", [monthStart])?.value ?? 0;
  const immobilizerArmedCount = row<{ value: number }>("SELECT COUNT(*) AS value FROM gps_devices WHERE status = 'IMMOBILIZER_ARMED'")?.value ?? 0;

  return {
    portfolio: {
      total_contracts: totalContracts,
      active_contracts: activeContracts,
      overdue_contracts: overdueContracts,
      overdue_percent: totalContracts ? overdueContracts / totalContracts : 0,
      total_outstanding: totalOutstanding,
      total_overdue_amount: totalOverdueAmount
    },
    payments: {
      collected_today: collectedToday,
      collected_last_7_days: collected7Days,
      collected_last_30_days: collected30Days,
      total_collected_all_time: totalCollected
    },
    collections: {
      open_cases: openCases,
      cases_cured_this_month: casesCuredThisMonth,
      immobilizer_armed_count: immobilizerArmedCount,
      critical_alerts_count: immobilizerArmedCount
    }
  };
}

function reportingAging() {
  const buckets = [
    { bucket: "Current", min: 0, max: 0, contractIds: new Set<string>(), amount_overdue: 0 },
    { bucket: "1-7 DPD", min: 1, max: 7, contractIds: new Set<string>(), amount_overdue: 0 },
    { bucket: "8-30 DPD", min: 8, max: 30, contractIds: new Set<string>(), amount_overdue: 0 },
    { bucket: "31-60 DPD", min: 31, max: 60, contractIds: new Set<string>(), amount_overdue: 0 },
    { bucket: "61+ DPD", min: 61, max: Infinity, contractIds: new Set<string>(), amount_overdue: 0 }
  ];
  const currentContracts = rows<any>("SELECT id FROM contracts WHERE status != 'OVERDUE'");
  for (const contract of currentContracts) buckets[0].contractIds.add(contract.id);

  const overdue = rows<any>("SELECT contract_id, due_date, amount_due FROM installments WHERE status = 'OVERDUE'");
  const grouped = new Map<string, { maxDpd: number; amount: number }>();
  for (const installment of overdue) {
    const dpd = Math.max(1, daysBetweenLocalDates(installment.due_date));
    const current = grouped.get(installment.contract_id) ?? { maxDpd: 0, amount: 0 };
    current.maxDpd = Math.max(current.maxDpd, dpd);
    current.amount += installment.amount_due;
    grouped.set(installment.contract_id, current);
  }

  for (const [contractId, value] of grouped) {
    const bucket = buckets.find((item) => value.maxDpd >= item.min && value.maxDpd <= item.max) ?? buckets[buckets.length - 1];
    bucket.contractIds.add(contractId);
    bucket.amount_overdue += value.amount;
  }

  return buckets.map((bucket) => ({ bucket: bucket.bucket, contract_count: bucket.contractIds.size, amount_overdue: bucket.amount_overdue }));
}

function reportingCashflow() {
  const byDate = new Map<string, { date: string; amount_collected: number; payment_count: number }>();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const key = localDateKey(date);
    byDate.set(key, { date: key, amount_collected: 0, payment_count: 0 });
  }
  const since = isoFromDaysAgo(29);
  const payments = rows<any>("SELECT amount, recorded_at FROM payments WHERE recorded_at >= ?", [since]);
  for (const payment of payments) {
    const key = localDateKey(payment.recorded_at);
    const item = byDate.get(key);
    if (item) {
      item.amount_collected += payment.amount;
      item.payment_count += 1;
    }
  }
  return [...byDate.values()];
}

function refreshOverdueState() {
  const at = nowIso();
  const today = localDateKey(new Date());
  const tx = db.transaction(() => {
    const unpaid = rows<any>("SELECT * FROM installments WHERE status NOT IN ('PAID', 'CANCELLED_BY_PREPAYMENT')");
    const contractIds = new Set<string>();
    for (const installment of unpaid) {
      const status = installmentStatusForDate(installment, today);
      if (installment.status !== status) {
        db.prepare("UPDATE installments SET status = ?, paid_at = NULL WHERE id = ?").run(status, installment.id);
      }
      contractIds.add(installment.contract_id);
    }
    for (const contract of rows<any>("SELECT id FROM contracts")) {
      contractIds.add(contract.id);
    }
    for (const contractId of contractIds) {
      recalculateContractStatus(contractId, { actor_id: "SYSTEM", actor_role: "ADMIN" }, at);
    }
  });
  tx();
}

seedUsersIfEmpty();
seedIfEmpty();
repairCorruptedSeedSchedules();

app.post("/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = row<SessionUser & { password_hash: string }>("SELECT id, full_name, email, password_hash, role, status, last_login_at FROM users WHERE email = ?", [email]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: "Invalid email or password" });
  if (user.status !== "ACTIVE") return res.status(403).json({ error: "User is disabled" });
  const at = nowIso();
  db.prepare("UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?").run(at, at, user.id);
  user.last_login_at = at;
  res.cookie(sessionCookie, signSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
  res.json({ user: userResponse(user) });
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ user: userResponse((req as express.Request & { user: SessionUser }).user) });
});

app.post("/auth/logout", (_req, res) => {
  res.clearCookie(sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/"
  });
  res.json({ ok: true });
});

app.use(requireAuth);

function requireAdmin(req: express.Request, res: express.Response) {
  const currentUser = (req as unknown as express.Request & { user: SessionUser }).user;
  if (currentUser.role !== "ADMIN") {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function requireOneOf(req: express.Request, res: express.Response, roles: Role[]) {
  const currentUser = (req as unknown as express.Request & { user: SessionUser }).user;
  if (currentUser.role !== "ADMIN" && !roles.includes(currentUser.role)) {
    res.status(403).json({ error: "Forbidden" });
    return false;
  }
  return true;
}

function normalizeUserPayload(body: any, existing?: any) {
  return {
    full_name: String(body.full_name ?? existing?.full_name ?? "").trim(),
    email: String(body.email ?? existing?.email ?? "").trim().toLowerCase(),
    role: String(body.role ?? existing?.role ?? "VIEWER").trim().toUpperCase(),
    status: String(body.status ?? existing?.status ?? "ACTIVE").trim().toUpperCase()
  };
}

function validateUserPayload(payload: any, password?: string, requirePassword = false) {
  if (!payload.full_name) return "Full name is required";
  if (!payload.email || !payload.email.includes("@")) return "Valid email is required";
  if (!authRoles.includes(payload.role)) return "Invalid user role";
  if (!(userStatuses as readonly string[]).includes(payload.status)) return "Invalid user status";
  if (requirePassword && !password) return "Password is required";
  if (password && password.length < 6) return "Password must be at least 6 characters";
  return null;
}

app.get("/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({
    users: rows<any>("SELECT id, full_name, email, role, status, created_at, updated_at, last_login_at FROM users ORDER BY role, email")
  });
});

app.post("/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const currentUser = (req as unknown as express.Request & { user: SessionUser }).user;
  const password = String(req.body.password || "");
  const payload = normalizeUserPayload(req.body);
  const validationError = validateUserPayload(payload, password, true);
  if (validationError) return res.status(400).json({ error: validationError });
  if (row<any>("SELECT id FROM users WHERE email = ?", [payload.email])) return res.status(409).json({ error: "Email already exists" });
  const at = nowIso();
  const user = { id: nextId("USR"), ...payload, created_at: at, updated_at: at, last_login_at: null };
  db.transaction(() => {
    db.prepare("INSERT INTO users (id, full_name, email, password_hash, role, status, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      user.id,
      user.full_name,
      user.email,
      bcrypt.hashSync(password, 10),
      user.role,
      user.status,
      user.created_at,
      user.updated_at,
      user.last_login_at
    );
    audit(currentUser.id, currentUser.role, "user", user.id, "user.created", null, user);
  })();
  res.status(201).json(user);
});

app.patch("/admin/users/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const currentUser = (req as unknown as express.Request & { user: SessionUser }).user;
  const existing = row<any>("SELECT id, full_name, email, role, status, created_at, updated_at, last_login_at FROM users WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "User not found" });
  const payload = normalizeUserPayload(req.body, existing);
  const validationError = validateUserPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const duplicate = row<any>("SELECT id FROM users WHERE email = ? AND id != ?", [payload.email, existing.id]);
  if (duplicate) return res.status(409).json({ error: "Email already exists" });
  const at = nowIso();
  const after = { ...existing, ...payload, updated_at: at };
  db.transaction(() => {
    db.prepare("UPDATE users SET full_name = ?, email = ?, role = ?, status = ?, updated_at = ? WHERE id = ?").run(after.full_name, after.email, after.role, after.status, after.updated_at, existing.id);
    audit(currentUser.id, currentUser.role, "user", existing.id, "user.updated", existing, after);
    if (existing.role !== after.role) audit(currentUser.id, currentUser.role, "user", existing.id, "user.role_changed", { role: existing.role }, { role: after.role });
    if (existing.status !== "DISABLED" && after.status === "DISABLED") audit(currentUser.id, currentUser.role, "user", existing.id, "user.disabled", { status: existing.status }, { status: after.status });
  })();
  res.json(after);
});

app.post("/admin/users/:id/reset-password", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const currentUser = (req as unknown as express.Request & { user: SessionUser }).user;
  const existing = row<any>("SELECT id, full_name, email, role, status, created_at, updated_at, last_login_at FROM users WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "User not found" });
  const password = String(req.body.password || "");
  const validationError = validateUserPayload(existing, password, true);
  if (validationError) return res.status(400).json({ error: validationError });
  const at = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(bcrypt.hashSync(password, 10), at, existing.id);
    audit(currentUser.id, currentUser.role, "user", existing.id, "user.password_reset", null, { id: existing.id, email: existing.email, updated_at: at });
  })();
  res.json({ ok: true });
});

app.get("/finance/vehicle-catalog", (_req, res) => {
  res.json({ vehicles: rows<any>("SELECT * FROM vehicle_catalog ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END, brand, model, year") });
});

app.post("/finance/vehicle-catalog", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const at = nowIso();
  const payload = normalizeVehicleCatalogPayload(req.body);
  const validationError = validateVehicleCatalogPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const vehicle = { id: nextId("VC"), ...payload, created_at: at, updated_at: at };
  db.prepare(`
    INSERT INTO vehicle_catalog (
      id, brand, model, variant, year, category, default_price_cents,
      default_cost_cents, stock_count, status, notes, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    vehicle.id,
    vehicle.brand,
    vehicle.model,
    vehicle.variant,
    vehicle.year,
    vehicle.category,
    vehicle.default_price_cents,
    vehicle.default_cost_cents,
    vehicle.stock_count,
    vehicle.status,
    vehicle.notes,
    vehicle.created_at,
    vehicle.updated_at
  );
  res.status(201).json(vehicle);
});

app.patch("/finance/vehicle-catalog/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const existing = row<any>("SELECT * FROM vehicle_catalog WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Vehicle catalog item not found" });
  const at = nowIso();
  const payload = normalizeVehicleCatalogPayload(req.body, existing);
  const validationError = validateVehicleCatalogPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const vehicle = { ...existing, ...payload, updated_at: at };
  db.prepare(`
    UPDATE vehicle_catalog
    SET brand = ?,
        model = ?,
        variant = ?,
        year = ?,
        category = ?,
        default_price_cents = ?,
        default_cost_cents = ?,
        stock_count = ?,
        status = ?,
        notes = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    vehicle.brand,
    vehicle.model,
    vehicle.variant,
    vehicle.year,
    vehicle.category,
    vehicle.default_price_cents,
    vehicle.default_cost_cents,
    vehicle.stock_count,
    vehicle.status,
    vehicle.notes,
    vehicle.updated_at,
    existing.id
  );
  res.json(vehicle);
});

app.get("/finance/financial-partners", (_req, res) => {
  res.json({ partners: rows<any>("SELECT * FROM financial_partners ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END, name") });
});

app.post("/finance/financial-partners", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const at = nowIso();
  const payload = normalizeFinancialPartnerPayload(req.body);
  const validationError = validateFinancialPartnerPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const partner = { id: nextId("FP"), ...payload, created_at: at, updated_at: at };
  db.prepare(`
    INSERT INTO financial_partners (id, name, funding_type, cost_rate_pct, active_contracts_count, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    partner.id,
    partner.name,
    partner.funding_type,
    partner.cost_rate_pct,
    partner.active_contracts_count,
    partner.status,
    partner.notes,
    partner.created_at,
    partner.updated_at
  );
  res.status(201).json(partner);
});

app.patch("/finance/financial-partners/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const existing = row<any>("SELECT * FROM financial_partners WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Financial partner not found" });
  const at = nowIso();
  const payload = normalizeFinancialPartnerPayload(req.body, existing);
  const validationError = validateFinancialPartnerPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const partner = { ...existing, ...payload, updated_at: at };
  db.prepare(`
    UPDATE financial_partners
    SET name = ?, funding_type = ?, cost_rate_pct = ?, active_contracts_count = ?, status = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    partner.name,
    partner.funding_type,
    partner.cost_rate_pct,
    partner.active_contracts_count,
    partner.status,
    partner.notes,
    partner.updated_at,
    existing.id
  );
  res.json(partner);
});

app.get("/finance/insurance-partners", (_req, res) => {
  res.json({ partners: rows<any>("SELECT * FROM insurance_partners ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END, name") });
});

app.post("/finance/insurance-partners", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const at = nowIso();
  const payload = normalizeInsurancePartnerPayload(req.body);
  const validationError = validateInsurancePartnerPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const partner = { id: nextId("IP"), ...payload, created_at: at, updated_at: at };
  db.prepare(`
    INSERT INTO insurance_partners (id, name, premium_pct, commission_pct, settlement_timing, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    partner.id,
    partner.name,
    partner.premium_pct,
    partner.commission_pct,
    partner.settlement_timing,
    partner.status,
    partner.notes,
    partner.created_at,
    partner.updated_at
  );
  res.status(201).json(partner);
});

app.patch("/finance/insurance-partners/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const existing = row<any>("SELECT * FROM insurance_partners WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Insurance partner not found" });
  const at = nowIso();
  const payload = normalizeInsurancePartnerPayload(req.body, existing);
  const validationError = validateInsurancePartnerPayload(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const partner = { ...existing, ...payload, updated_at: at };
  db.prepare(`
    UPDATE insurance_partners
    SET name = ?, premium_pct = ?, commission_pct = ?, settlement_timing = ?, status = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(
    partner.name,
    partner.premium_pct,
    partner.commission_pct,
    partner.settlement_timing,
    partner.status,
    partner.notes,
    partner.updated_at,
    existing.id
  );
  res.json(partner);
});

app.get("/applications", (_req, res) => {
  res.json({ applications: rows<any>("SELECT * FROM applications ORDER BY updated_at DESC, created_at DESC") });
});

app.get("/applications/:id", (req, res) => {
  const application = row<any>("SELECT * FROM applications WHERE id = ?", [req.params.id]);
  if (!application) return res.status(404).json({ error: "Application not found" });
  res.json(application);
});

app.get("/applications/:id/conversion-preview", (req, res) => {
  if (!requireOneOf(req, res, ["FINANCE"])) return;
  const application = row<any>("SELECT * FROM applications WHERE id = ?", [req.params.id]);
  if (!application) return res.status(404).json({ error: "Application not found" });

  const documents = rows<any>("SELECT * FROM application_documents WHERE application_id = ?", [req.params.id]);
  const errors: string[] = [];
  const warnings: string[] = [];
  const financedAmount = Number(application.vehicle_price_cents || 0) - Number(application.down_payment_cents || 0);

  if (!["READY_TO_SIGN", "APPROVED"].includes(application.stage)) errors.push("Stage must be READY_TO_SIGN or APPROVED");
  if (application.converted_contract_id) errors.push("Application is already linked to a converted contract");
  if (financedAmount <= 0) errors.push("Financed amount must be greater than 0");
  if (Number(application.term_months || 0) <= 0) errors.push("Term months must be greater than 0");
  if (!String(application.client_full_name || "").trim()) errors.push("Client full name is required");
  if (!String(application.client_phone || "").trim()) errors.push("Phone is required");

  const documentsByType = new Map<string, any[]>();
  documents.forEach((document) => {
    documentsByType.set(document.document_type, [...(documentsByType.get(document.document_type) ?? []), document]);
  });
  const rejectedRequiredDocuments = requiredApplicationKycDocumentTypes.filter((type) => (documentsByType.get(type) ?? []).some((document) => document.status === "REJECTED"));
  const missingRequiredDocuments = requiredApplicationKycDocumentTypes.filter((type) => !(documentsByType.get(type) ?? []).some((document) => document.status === "REVIEWED" || document.status === "WAIVED"));
  rejectedRequiredDocuments.forEach((type) => errors.push(`Required document ${documentTypeLabel(type)} is rejected`));
  missingRequiredDocuments.forEach((type) => errors.push(`Required document ${documentTypeLabel(type)} must be reviewed or waived`));
  const kycReady = missingRequiredDocuments.length === 0 && rejectedRequiredDocuments.length === 0;

  warnings.push("Missing VIN");
  warnings.push("Missing plate");
  warnings.push("Missing GPS assignment");

  res.json({
    convertible: errors.length === 0,
    errors,
    warnings,
    preview: {
      client_name: application.client_full_name,
      financed_amount: financedAmount,
      term_months: application.term_months,
      estimated_installments: application.term_months,
      vehicle: {
        brand: application.vehicle_brand,
        model: application.vehicle_model,
        year: application.vehicle_year
      },
      stage: application.stage,
      kyc_ready: kycReady
    }
  });
});

app.post("/applications", (req, res) => {
  if (!requireOneOf(req, res, ["SALES", "FINANCE"])) return;
  const a = actor(req);
  const at = nowIso();
  const payload = normalizeApplicationPayload(req.body);
  const validationError = validateApplicationRecord(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const id = nextId("APP");
  const application = { id, ...payload, created_at: at, updated_at: at };
  db.transaction(() => {
    db.prepare(`
      INSERT INTO applications (
        id, client_full_name, client_phone, client_national_id, vehicle_catalog_id,
        vehicle_brand, vehicle_model, vehicle_year, vehicle_price_cents, vehicle_cost_cents,
        down_payment_cents, down_payment_pct, term_months, apr_pct, pricing_tier_id,
        financial_partner_id, insurance_partner_id, bank_account_id, bank_funded_amount_cents,
        emc_funded_amount_cents, settlement_mode, closure_mode, stage, notes,
        created_at, updated_at, rejected_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      application.id,
      application.client_full_name,
      application.client_phone,
      application.client_national_id,
      application.vehicle_catalog_id,
      application.vehicle_brand,
      application.vehicle_model,
      application.vehicle_year,
      application.vehicle_price_cents,
      application.vehicle_cost_cents,
      application.down_payment_cents,
      application.down_payment_pct,
      application.term_months,
      application.apr_pct,
      application.pricing_tier_id,
      application.financial_partner_id,
      application.insurance_partner_id,
      application.bank_account_id,
      application.bank_funded_amount_cents,
      application.emc_funded_amount_cents,
      application.settlement_mode,
      application.closure_mode,
      application.stage,
      application.notes,
      application.created_at,
      application.updated_at,
      application.rejected_reason
    );
    audit(a.actor_id, a.actor_role, "application", id, "application.created", null, application);
  })();
  res.status(201).json(application);
});

app.patch("/applications/:id", (req, res) => {
  if (!requireOneOf(req, res, ["SALES", "FINANCE"])) return;
  const a = actor(req);
  const existing = row<any>("SELECT * FROM applications WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Application not found" });
  const at = nowIso();
  const payload = normalizeApplicationPayload(req.body, existing);
  const validationError = validateApplicationRecord(payload);
  if (validationError) return res.status(400).json({ error: validationError });
  const after = { ...existing, ...payload, updated_at: at };
  db.transaction(() => {
    db.prepare(`
      UPDATE applications
      SET client_full_name = ?,
          client_phone = ?,
          client_national_id = ?,
          vehicle_catalog_id = ?,
          vehicle_brand = ?,
          vehicle_model = ?,
          vehicle_year = ?,
          vehicle_price_cents = ?,
          vehicle_cost_cents = ?,
          down_payment_cents = ?,
          down_payment_pct = ?,
          term_months = ?,
          apr_pct = ?,
          pricing_tier_id = ?,
          financial_partner_id = ?,
          insurance_partner_id = ?,
          bank_account_id = ?,
          bank_funded_amount_cents = ?,
          emc_funded_amount_cents = ?,
          settlement_mode = ?,
          closure_mode = ?,
          stage = ?,
          notes = ?,
          updated_at = ?,
          rejected_reason = ?
      WHERE id = ?
    `).run(
      after.client_full_name,
      after.client_phone,
      after.client_national_id,
      after.vehicle_catalog_id,
      after.vehicle_brand,
      after.vehicle_model,
      after.vehicle_year,
      after.vehicle_price_cents,
      after.vehicle_cost_cents,
      after.down_payment_cents,
      after.down_payment_pct,
      after.term_months,
      after.apr_pct,
      after.pricing_tier_id,
      after.financial_partner_id,
      after.insurance_partner_id,
      after.bank_account_id,
      after.bank_funded_amount_cents,
      after.emc_funded_amount_cents,
      after.settlement_mode,
      after.closure_mode,
      after.stage,
      after.notes,
      after.updated_at,
      after.rejected_reason,
      existing.id
    );
    audit(a.actor_id, a.actor_role, "application", existing.id, "application.updated", existing, after);
    if (existing.stage !== after.stage) {
      audit(a.actor_id, a.actor_role, "application", existing.id, "application.stage_changed", { stage: existing.stage }, { stage: after.stage });
    }
  })();
  res.json(after);
});

app.get("/applications/:id/documents", (req, res) => {
  const application = row<any>("SELECT id FROM applications WHERE id = ?", [req.params.id]);
  if (!application) return res.status(404).json({ error: "Application not found" });
  res.json({ documents: rows<any>("SELECT * FROM application_documents WHERE application_id = ? ORDER BY document_type, id", [req.params.id]) });
});

app.post("/applications/:id/documents", (req, res) => {
  if (!requireOneOf(req, res, ["SALES", "FINANCE"])) return;
  const application = row<any>("SELECT id FROM applications WHERE id = ?", [req.params.id]);
  if (!application) return res.status(404).json({ error: "Application not found" });
  const a = actor(req);
  const at = nowIso();
  const payload = normalizeApplicationDocumentPayload(req.body);
  const validationError = validateApplicationDocumentPayload(payload, a.actor_role);
  if (validationError) return res.status(400).json({ error: validationError });
  const metadata = documentMetadataForStatus(payload, null, a, at);
  const document = { id: nextId("DOC"), application_id: req.params.id, ...payload, ...metadata };
  db.prepare(`
    INSERT INTO application_documents (
      id, application_id, document_type, status, file_name, storage_key,
      uploaded_by, reviewed_by, uploaded_at, reviewed_at, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    document.id,
    document.application_id,
    document.document_type,
    document.status,
    document.file_name,
    document.storage_key,
    document.uploaded_by,
    document.reviewed_by,
    document.uploaded_at,
    document.reviewed_at,
    document.notes
  );
  res.status(201).json(document);
});

app.patch("/application-documents/:id", (req, res) => {
  if (!requireOneOf(req, res, ["SALES", "FINANCE"])) return;
  const existing = row<any>("SELECT * FROM application_documents WHERE id = ?", [req.params.id]);
  if (!existing) return res.status(404).json({ error: "Application document not found" });
  const a = actor(req);
  const at = nowIso();
  const payload = normalizeApplicationDocumentPayload(req.body, existing);
  const validationError = validateApplicationDocumentPayload(payload, a.actor_role);
  if (validationError) return res.status(400).json({ error: validationError });
  const metadata = documentMetadataForStatus(payload, existing, a, at);
  const after = { ...existing, ...payload, ...metadata };
  db.prepare(`
    UPDATE application_documents
    SET document_type = ?,
        status = ?,
        file_name = ?,
        storage_key = ?,
        uploaded_by = ?,
        reviewed_by = ?,
        uploaded_at = ?,
        reviewed_at = ?,
        notes = ?
    WHERE id = ?
  `).run(
    after.document_type,
    after.status,
    after.file_name,
    after.storage_key,
    after.uploaded_by,
    after.reviewed_by,
    after.uploaded_at,
    after.reviewed_at,
    after.notes,
    existing.id
  );
  res.json(after);
});

app.post(
  "/application-documents/:id/upload",
  express.raw({
    type: (req) => String(req.headers["content-type"] || "").toLowerCase().startsWith("multipart/form-data"),
    limit: maxApplicationDocumentUploadBytes
  }),
  (req, res) => {
    if (!requireOneOf(req, res, ["SALES", "FINANCE"])) return;
    const existing = row<any>("SELECT * FROM application_documents WHERE id = ?", [req.params.id]);
    if (!existing) return res.status(404).json({ error: "Application document not found" });

    const parsed = parseSingleMultipartFile(req);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });
    if (parsed.buffer.length <= 0) return res.status(400).json({ error: "Upload file is empty" });
    if (parsed.buffer.length > maxApplicationDocumentUploadBytes) return res.status(413).json({ error: "Upload file is too large" });

    const storageKey = safeApplicationDocumentStorageKey(existing.id, parsed.originalName);
    if (!storageKey) return res.status(400).json({ error: "Only PDF, JPG, JPEG, and PNG files are allowed" });

    const extension = path.extname(storageKey).toLowerCase();
    const expectedMime = applicationDocumentMimeTypes[extension];
    if (parsed.mimeType && parsed.mimeType !== "application/octet-stream" && parsed.mimeType !== expectedMime) {
      return res.status(400).json({ error: "File type does not match allowed formats" });
    }

    const a = actor(req);
    const at = nowIso();
    const targetPath = path.join(applicationDocumentUploadDir, storageKey);
    const resolvedTarget = path.resolve(targetPath);
    if (!resolvedTarget.startsWith(`${path.resolve(applicationDocumentUploadDir)}${path.sep}`)) return res.status(400).json({ error: "Invalid storage path" });

    fs.writeFileSync(resolvedTarget, parsed.buffer, { flag: "wx" });
    const nextStatus = (a.actor_role === "FINANCE" || a.actor_role === "ADMIN") && ["REVIEWED", "REJECTED", "WAIVED"].includes(existing.status) ? existing.status : "UPLOADED";
    const after = {
      ...existing,
      file_name: parsed.originalName,
      storage_key: storageKey,
      uploaded_by: a.actor_id,
      uploaded_at: at,
      status: nextStatus
    };
    db.prepare(`
      UPDATE application_documents
      SET file_name = ?,
          storage_key = ?,
          uploaded_by = ?,
          uploaded_at = ?,
          status = ?
      WHERE id = ?
    `).run(after.file_name, after.storage_key, after.uploaded_by, after.uploaded_at, after.status, existing.id);
    res.json(after);
  }
);

app.get("/application-documents/:id/file", (req, res) => {
  const document = row<any>("SELECT * FROM application_documents WHERE id = ?", [req.params.id]);
  if (!document) return res.status(404).json({ error: "Application document not found" });
  if (!document.storage_key) return res.status(404).json({ error: "No file uploaded" });

  const storageKey = path.basename(document.storage_key);
  if (storageKey !== document.storage_key) return res.status(400).json({ error: "Invalid storage key" });
  const extension = path.extname(storageKey).toLowerCase();
  if (!allowedApplicationDocumentExtensions.has(extension)) return res.status(400).json({ error: "Invalid file type" });

  const filePath = path.resolve(applicationDocumentUploadDir, storageKey);
  if (!filePath.startsWith(`${path.resolve(applicationDocumentUploadDir)}${path.sep}`) || !fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.setHeader("Content-Type", applicationDocumentMimeTypes[extension] || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.file_name || storageKey)}"`);
  res.sendFile(filePath);
});

app.get("/contracts", (_req, res) => {
  refreshOverdueState();
  const contracts = rows<any>("SELECT c.*, cl.full_name AS client, cl.phone FROM contracts c JOIN clients cl ON cl.id = c.client_id WHERE c.status != 'VOID' ORDER BY c.id");
  const payments = rows<any>("SELECT * FROM payments ORDER BY recorded_at DESC LIMIT 20");
  // Source: contracts.financed_amount, falling back to generated schedule total for legacy rows.
  const total_disbursed = contracts.reduce((sum, contract) => sum + (contract.financed_amount || contract.monthly_total * contract.term_months), 0);
  // Source: raw sum of payments.amount recorded in the payments table.
  const total_collected = row<{ value: number }>("SELECT COALESCE(SUM(amount), 0) AS value FROM payments")?.value ?? 0;
  // Source: schedule-based unpaid principal; this does not subtract contracts.credit_balance.
  const outstanding = totalOutstanding();
  const overdue_amount = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE status = 'OVERDUE'")?.value ?? 0;
  const active_contracts = contracts.filter((contract) => contract.status === "ACTIVE").length;
  const overdue_contracts = contracts.filter((contract) => contract.status === "OVERDUE").length;
  res.json({  contracts, payments, cash: { total_disbursed, total_collected, outstanding, overdue_amount, active_contracts, overdue_contracts } });
});

app.get("/contracts/void", (req, res) => {
  if (!requireAdmin(req, res)) return;

  const rows = db.prepare(`
    SELECT c.*, cl.full_name as client, cl.phone
    FROM contracts c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.status = 'VOID'
    ORDER BY c.id DESC
  `).all();

  res.json({  contracts: rows });
});

app.get("/contracts/:id", (req, res) => {
  refreshOverdueState();
  reconcileGpsStatusFromCommands();
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [req.params.id]);
  if (!contract) return res.status(404).json({ error: "Contract not found" });
  const client = row<any>("SELECT * FROM clients WHERE id = ?", [contract.client_id]);
  const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [contract.vehicle_id]);
  const gps = vehicle ? row<any>("SELECT * FROM gps_devices WHERE vehicle_id = ?", [vehicle.id]) : null;
  const payments = rows<any>("SELECT * FROM payments WHERE contract_id = ? ORDER BY recorded_at DESC", [contract.id]);
  const has_payments = payments.length > 0;

  

  const cases = rows<any>(
    `SELECT
      cc.*,
      COALESCE((SELECT SUM(amount_due) FROM installments WHERE contract_id = cc.contract_id AND status = 'OVERDUE'), 0) AS overdue_amount,
      (
        SELECT type || ' by ' || performed_by || ' at ' || performed_at
        FROM collection_actions
        WHERE case_id = cc.id
        ORDER BY performed_at DESC
        LIMIT 1
      ) AS last_action
    FROM collections_cases cc
    WHERE cc.contract_id = ?
    ORDER BY cc.opened_at DESC`,
    [contract.id]
  );
  const installments = rows<any>("SELECT id FROM installments WHERE contract_id = ?", [contract.id]);
  const alerts = rows<any>("SELECT id FROM alerts WHERE entity_id IN (?, ?)", [contract.id, vehicle?.id ?? ""]);
  const auditEntityIds = [contract.id, vehicle.id, gps?.id ?? "", ...payments.map((item) => item.id), ...cases.map((item) => item.id), ...installments.map((item) => item.id), ...alerts.map((item) => item.id)].filter(Boolean);
  const auditRows = rows<any>(`SELECT id, ts, actor_id, actor_role, entity_type, entity_id, action, before_json, after_json FROM audit WHERE entity_id IN (${auditEntityIds.map(() => "?").join(",")}) ORDER BY ts DESC`, auditEntityIds);
  const paid_to_date = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding_balance = outstandingForContract(contract.id);
  const overdue_amount = row<{ value: number }>("SELECT COALESCE(SUM(amount_due), 0) AS value FROM installments WHERE contract_id = ? AND status = 'OVERDUE'", [contract.id])?.value ?? 0;
  res.json({  contract, client, vehicle, gps: gps ? jsonGps(gps) : null, payments, cases, audit: auditRows.map((item) => ({ ...item, before: item.before_json ? JSON.parse(item.before_json) : null, after: item.after_json ? JSON.parse(item.after_json) : null })), financials: { paid_to_date, outstanding_balance, overdue_amount, credit_balance: contract.credit_balance ?? 0 } });
});

app.post("/contracts", (req, res) => {
  if (!requirePermission(req, res, "contract.create")) return;
  const at = nowIso();
  const a = actor(req);
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
    db.prepare("INSERT INTO gps_devices (id, vehicle_id, status, lat, lng, last_ping_at) VALUES (?, ?, ?, ?, ?, ?)").run(gpsId, vehicleId, "ONLINE", 11.5564, 104.9282, at);
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


app.post("/applications/:id/convert-to-contract", (req, res) => {
  if (!requirePermission(req, res, "contract.create")) return;
  const a = actor(req);
  const at = nowIso();

  const application = row<any>("SELECT * FROM applications WHERE id = ?", [req.params.id]);
  if (!application) return res.status(404).json({ error: "Application not found" });

  if (application.converted_contract_id) {
    return res.status(409).json({ error: "Application already converted", contract_id: application.converted_contract_id });
  }

  if (!["READY_TO_SIGN", "APPROVED"].includes(application.stage)) {
    return res.status(400).json({ error: "Application is not ready for conversion" });
  }

  const requiredDocs = ["NATIONAL_ID_OR_PASSPORT", "DRIVER_LICENSE", "SIGNED_APPLICATION"];
  const docs = rows<any>("SELECT * FROM application_documents WHERE application_id = ?", [application.id]);

  const missingRequired = requiredDocs.filter((docType) => {
    const matching = docs.filter((doc) => doc.document_type === docType);
    return !matching.some((doc) => ["REVIEWED", "WAIVED"].includes(doc.status));
  });

  if (missingRequired.length) {
    return res.status(400).json({ error: "KYC requirements incomplete", missing: missingRequired });
  }

  const rejectedRequired = docs.filter((doc) => requiredDocs.includes(doc.document_type) && doc.status === "REJECTED");
  if (rejectedRequired.length) return res.status(400).json({ error: "Rejected KYC documents present" });

  const financedAmount = Number(application.vehicle_price_cents || 0) - Number(application.down_payment_cents || 0);
  const termMonths = Math.max(1, Number(application.term_months || 0));

  if (financedAmount <= 0) return res.status(400).json({ error: "Invalid financed amount" });
  if (termMonths <= 0) return res.status(400).json({ error: "Invalid term months" });
  if (!application.client_full_name || !application.client_phone) return res.status(400).json({ error: "Missing client identity fields" });

  const suffix = String(Date.now()).slice(-4);
  const contractId = `KT-${suffix}`;
  const vehicleId = nextId("VEH");
  const gpsId = nextId("GPS");
  const vin = `APP-${String(application.id).slice(-6)}`;
  const plate = `PENDING-${String(application.id).slice(-4)}`;
  const monthly = Math.round(financedAmount / termMonths);
  const startDate = new Date();
  const startIso = startDate.toISOString();

  const existingClient = row<any>(
    `SELECT * FROM clients
     WHERE (? != '' AND national_id = ?)
        OR (? != '' AND phone = ?)
     LIMIT 1`,
    [
      application.client_national_id || "",
      application.client_national_id || "",
      application.client_phone || "",
      application.client_phone || ""
    ]
  );

  const clientId = existingClient?.id || nextId("CL");

  const tx = db.transaction(() => {
    if (!existingClient) {
      db.prepare(`
        INSERT INTO clients (id, full_name, phone, address, national_id, emergency_contact_name, emergency_contact_phone)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(clientId, application.client_full_name, application.client_phone, "", application.client_national_id || "", "", "");
    }

    db.prepare(`
      INSERT INTO contracts (id, client_id, vehicle_id, status, monthly_total, start_date, term_months, vehicle_price, down_payment, financed_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contractId, clientId, vehicleId, "ACTIVE", monthly, startIso, termMonths, application.vehicle_price_cents, application.down_payment_cents, financedAmount);

    db.prepare("INSERT INTO vehicles VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      vehicleId,
      vin,
      application.vehicle_brand || "Unknown",
      application.vehicle_model || "Unknown",
      plate,
      contractId,
      gpsId
    );

    db.prepare("INSERT INTO gps_devices (id, vehicle_id, status, lat, lng, last_ping_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      gpsId,
      vehicleId,
      "ONLINE",
      11.5564,
      104.9282,
      at
    );

    for (let i = 1; i <= termMonths; i += 1) {
      const due = new Date(startDate);
      due.setUTCMonth(startDate.getUTCMonth() + i);
      db.prepare("INSERT INTO installments VALUES (?, ?, ?, ?, ?, ?, ?)").run(nextId("INS"), contractId, i, due.toISOString(), monthly, "SCHEDULED", null);
    }

    db.prepare("UPDATE applications SET converted_contract_id = ?, converted_at = ?, updated_at = ? WHERE id = ?").run(contractId, at, at, application.id);

    audit(a.actor_id, a.actor_role, "application", application.id, "application.converted", null, { contract_id: contractId });
    audit(a.actor_id, a.actor_role, "contract", contractId, "contract.created_from_application", null, { application_id: application.id });
    audit(a.actor_id, a.actor_role, "vehicle", vehicleId, "vehicle.created_from_application", null, { application_id: application.id, contract_id: contractId });
    audit(a.actor_id, a.actor_role, "installment", contractId, "installments.generated_from_application", null, { application_id: application.id, count: termMonths });
  });

  tx();

  res.status(201).json({
    contract_id: contractId,
    application_id: application.id,
    client_id: clientId,
    vehicle_id: vehicleId,
    gps_device_id: gpsId,
    installments_created: termMonths
  });
});


app.post("/contracts/:id/void", (req, res) => {
  if (!requirePermission(req, res, "contract.void")) return;

  const a = actor(req);
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [req.params.id]);
  if (!contract) return res.status(404).json({ error: "Contract not found" });

  const payments = row<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM payments WHERE contract_id = ?",
    [contract.id]
  )?.cnt ?? 0;

  if (payments > 0) {
    return res.status(409).json({
    error: {
      code: "HAS_PAYMENTS",
      message: "Cannot void contract because payments already exist",
      details: {
        contract_id: contract.id
      }
    }
  });
  }

  db.prepare("UPDATE contracts SET status = 'VOID' WHERE id = ?").run(contract.id);

  audit(a.actor_id, a.actor_role, "contract", contract.id, "contract.voided", contract, {
    ...contract,
    status: "VOID"
  });

  res.json({ ok: true });
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
  const a = actor(req);
  if (!requirePermission(req, res, "payment.record")) return;
  const idempotencyKey = String(req.body.idempotency_key || "").trim();
  if (!idempotencyKey) return res.status(400).json({ error: "idempotency_key is required" });
  const existingPayment = row<any>("SELECT * FROM payments WHERE idempotency_key = ?", [idempotencyKey]);
  if (existingPayment) return res.json(existingPayment);
  const installment = row<any>("SELECT * FROM installments WHERE id = ?", [req.body.installment_id]);
  if (!installment || !["SCHEDULED", "DUE", "OVERDUE"].includes(installment.status)) return res.status(409).json({ error: "Invalid installment transition" });
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [installment.contract_id]);
  if (!contract) return res.status(404).json({ error: "Contract not found" });
  const at = nowIso();
  const method = ["cash", "transfer", "aba", "wing"].includes(req.body.method) ? req.body.method : "cash";
  const amount = cents(req.body.amount || installment.amount_due);
  if (amount <= 0) return res.status(400).json({ error: "Invalid payment amount" });
  const requestedAllocation = req.body.allocation_type;
  if (amount > installment.amount_due && !["PAY_AHEAD", "PRINCIPAL_PREPAYMENT"].includes(requestedAllocation)) {
    return res.status(400).json({ error: "Allocation type required for overpayment" });
  }
  const allocationType = amount > installment.amount_due ? requestedAllocation : "REGULAR";
  const principalExtraAmount = allocationType === "PRINCIPAL_PREPAYMENT" ? Math.max(0, amount - installment.amount_due) : 0;
  const previousCreditBalance = contract.credit_balance ?? 0;
  let appliedAmount = 0;
  let unappliedAmount = 0;
  let creditBalanceAfter = previousCreditBalance;
  let creditAppliedAmount = 0;
  let totalAppliedToInstallments = 0;
  let payAheadTargets: any[] = [];
  let regularTarget: any | null = null;

  const settleInstallmentAllocation = (totalApplied: number) => {
    totalAppliedToInstallments = totalApplied;
    creditAppliedAmount = Math.min(previousCreditBalance, totalAppliedToInstallments);
    appliedAmount = totalAppliedToInstallments - creditAppliedAmount;
    creditBalanceAfter = previousCreditBalance + amount - totalAppliedToInstallments;
    unappliedAmount = amount - appliedAmount;
  };

  if (allocationType === "PAY_AHEAD") {
    let available = previousCreditBalance + amount;
    const unpaid = rows<any>(
      "SELECT * FROM installments WHERE contract_id = ? AND status IN ('SCHEDULED', 'DUE', 'OVERDUE') ORDER BY due_date, seq_no",
      [installment.contract_id]
    );
    for (const item of unpaid) {
      if (available < item.amount_due) break;
      available -= item.amount_due;
      totalAppliedToInstallments += item.amount_due;
      payAheadTargets.push(item);
    }
    settleInstallmentAllocation(totalAppliedToInstallments);
  } else if (allocationType === "PRINCIPAL_PREPAYMENT") {
    appliedAmount = installment.amount_due;
    creditBalanceAfter = previousCreditBalance;
    totalAppliedToInstallments = installment.amount_due;
    regularTarget = installment;
  } else {
    const available = previousCreditBalance + amount;
    if (available >= installment.amount_due) {
      regularTarget = installment;
      settleInstallmentAllocation(installment.amount_due);
    } else {
      totalAppliedToInstallments = 0;
      creditAppliedAmount = 0;
      creditBalanceAfter = available;
      unappliedAmount = amount;
    }
  }
  const payment = {
    id: nextId("PAY"),
    contract_id: installment.contract_id,
    installment_id: installment.id,
    amount,
    method,
    reference: req.body.reference || "",
    note: req.body.note || "",
    allocation_type: allocationType,
    principal_extra_amount: principalExtraAmount,
    applied_amount: appliedAmount,
    unapplied_amount: unappliedAmount,
    credit_balance_after: creditBalanceAfter,
    idempotency_key: idempotencyKey,
    recorded_at: at,
    recorded_by: a.actor_id
  };
  const tx = db.transaction(() => {
    const outstandingBefore = outstandingForContract(contract.id);
    db.prepare("INSERT INTO payments (id, contract_id, installment_id, amount, method, reference, note, allocation_type, principal_extra_amount, applied_amount, unapplied_amount, credit_balance_after, idempotency_key, recorded_at, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(payment.id, payment.contract_id, payment.installment_id, payment.amount, payment.method, payment.reference, payment.note, payment.allocation_type, payment.principal_extra_amount, payment.applied_amount, payment.unapplied_amount, payment.credit_balance_after, payment.idempotency_key, payment.recorded_at, payment.recorded_by);
    audit(a.actor_id, a.actor_role, "payment", payment.id, "payment.recorded", null, payment);
    audit(a.actor_id, a.actor_role, "payment", payment.id, "payment.allocated", null, {
      payment_id: payment.id,
      allocation_type: allocationType,
      amount,
      applied_amount: appliedAmount,
      credit_applied_amount: creditAppliedAmount,
      principal_extra_amount: principalExtraAmount,
      unapplied_amount: unappliedAmount,
      credit_balance_before: previousCreditBalance,
      credit_balance_after: creditBalanceAfter,
      paid_installment_ids: allocationType === "PAY_AHEAD" ? payAheadTargets.map((item) => item.id) : regularTarget ? [regularTarget.id] : []
    });

    if (allocationType === "PAY_AHEAD") {
      for (const item of payAheadTargets) {
        db.prepare("UPDATE installments SET status = 'PAID', paid_at = ? WHERE id = ?").run(at, item.id);
        audit(a.actor_id, a.actor_role, "installment", item.id, "installment.status_changed", item, { ...item, status: "PAID", paid_at: at });
      }
    } else if (regularTarget) {
      db.prepare("UPDATE installments SET status = 'PAID', paid_at = ? WHERE id = ?").run(at, installment.id);
      audit(a.actor_id, a.actor_role, "installment", installment.id, "installment.status_changed", installment, { ...installment, status: "PAID", paid_at: at });
    }

    db.prepare("UPDATE contracts SET credit_balance = ? WHERE id = ?").run(creditBalanceAfter, contract.id);
    if (previousCreditBalance !== creditBalanceAfter) {
      audit(
        a.actor_id,
        a.actor_role,
        "contract",
        contract.id,
        "credit.balance_updated",
        { credit_balance: previousCreditBalance },
        { payment_id: payment.id, credit_balance: creditBalanceAfter, applied_amount: appliedAmount, credit_applied_amount: creditAppliedAmount, unapplied_amount: unappliedAmount }
      );
    }

    if (allocationType === "PRINCIPAL_PREPAYMENT" && principalExtraAmount > 0) {
      const monthsToRemove = Math.floor(principalExtraAmount / contract.monthly_total);
      const cancelled: any[] = [];
      if (monthsToRemove > 0) {
        const futureInstallments = rows<any>(
          "SELECT * FROM installments WHERE contract_id = ? AND status IN ('SCHEDULED', 'DUE', 'OVERDUE') ORDER BY due_date DESC, seq_no DESC LIMIT ?",
          [contract.id, monthsToRemove]
        );
        for (const item of futureInstallments) {
          const after = { ...item, status: "CANCELLED_BY_PREPAYMENT", paid_at: null };
          db.prepare("UPDATE installments SET status = 'CANCELLED_BY_PREPAYMENT', paid_at = NULL WHERE id = ?").run(item.id);
          audit(a.actor_id, a.actor_role, "installment", item.id, "installment.status_changed", item, after);
          cancelled.push(after);
        }
        audit(
          a.actor_id,
          a.actor_role,
          "contract",
          contract.id,
          "schedule.shortened",
          { outstanding_balance: outstandingBefore, months_removed: 0 },
          { payment_id: payment.id, months_removed: cancelled.length, cancelled_installment_ids: cancelled.map((item) => item.id), outstanding_balance: outstandingForContract(contract.id) }
        );
      }
      audit(
        a.actor_id,
        a.actor_role,
        "contract",
        contract.id,
        "principal.prepayment_recorded",
        { outstanding_balance: outstandingBefore },
        { payment_id: payment.id, principal_extra_amount: principalExtraAmount, outstanding_balance: outstandingForContract(contract.id) }
      );
    }

    cureContractIfNoOverdue(contract, a, at);
  });
  tx();
  evaluateRestoreAfterPayment(contract.id, a, at);
  res.status(201).json(payment);
});

app.get("/collections", (req, res) => {
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"])) return;
  refreshOverdueState();
  reconcileGpsStatusFromCommands();
  const cases = rows<any>(
    `SELECT
      cc.*,
      cl.full_name AS client,
      cl.full_name AS client_name,
      cl.phone AS client_phone,
      cl.address AS client_address,
      cl.national_id AS client_national_id,
      c.status AS contract_status,
      c.monthly_total,
      c.vehicle_price,
      c.down_payment,
      c.financed_amount,
      c.credit_balance,
      v.plate,
      v.vin,
      COALESCE((SELECT SUM(amount_due) FROM installments WHERE contract_id = cc.contract_id AND status = 'OVERDUE'), 0) AS overdue_amount,
      COALESCE(
        CAST(julianday('now', 'localtime') - julianday((SELECT MIN(due_date) FROM installments WHERE contract_id = cc.contract_id AND status = 'OVERDUE')) AS INTEGER),
        0
      ) AS dpd,
      COALESCE((SELECT type FROM collection_actions WHERE case_id = cc.id ORDER BY performed_at DESC LIMIT 1), '') AS last_action,
      COALESCE(g.status, '') AS gps_status,
      COALESCE((SELECT status FROM gps_commands WHERE device_id = g.id AND command_type = 'RELEASE' ORDER BY created_at DESC LIMIT 1), '') AS restore_command_status
    FROM collections_cases cc
    JOIN clients cl ON cl.id = cc.client_id
    JOIN contracts c ON c.id = cc.contract_id
    JOIN vehicles v ON v.id = c.vehicle_id
    JOIN gps_devices g ON g.vehicle_id = v.id
    WHERE g.status = 'IMMOBILIZER_ARMED'
      OR (cc.status NOT IN ('CLOSED', 'CURED') AND (c.status = 'OVERDUE' OR cc.status NOT IN ('CLOSED', 'CURED')))
    ORDER BY dpd DESC, cc.id`
  );
  const casesWithDecision = cases.map((kase) => {
    const decision = decideNextAction({
      overdueAmount: kase.overdue_amount,
      dpd: kase.dpd,
      gpsStatus: kase.gps_status
    });
    const restoreDecision = kase.gps_status === "IMMOBILIZER_ARMED"
      ? decideRestoreAccess({
        dpd: kase.dpd,
        overdueAmount: kase.overdue_amount,
        otherActiveOverdueContracts: row<{ value: number }>(
          "SELECT COUNT(*) AS value FROM contracts WHERE client_id = ? AND id != ? AND status = 'OVERDUE'",
          [kase.client_id, kase.contract_id]
        )?.value ?? 0
      })
      : null;
    return {
      ...kase,
      workflow_next_action_type: kase.next_action_type,
      next_action_type: decision.nextAction,
      decision_reason: restoreDecision?.decisionReason ?? decision.reason,
      restore_decision_reason: restoreDecision?.decisionReason ?? ""
    };
  });
  const actions = rows<any>("SELECT * FROM collection_actions ORDER BY performed_at");
  res.json({ cases: casesWithDecision, actions });
});


app.get("/collections/:id/gps-commands", (req, res) => {
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"])) return;
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase) return res.status(404).json({ error: "Case not found" });

  const { gps } = gpsForCase(kase);
  if (!gps) return res.json([]);

  const commands = rows<any>(
    `
    SELECT *
    FROM gps_commands
    WHERE device_id = ?
    ORDER BY created_at DESC
    `,
    [gps.id]
  );

  res.json(commands);
});

app.post("/collections/:id/sms", (req, res) => {
  const a = actor(req);
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT"])) return;
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase || kase.status !== "OPEN") return res.status(409).json({ error: "Invalid case transition" });
  const at = nowIso();
  const after = { ...kase, next_action_type: "CALL_ATTEMPT", next_action_date: at, assigned_agent_id: a.actor_id };
  db.transaction(() => {
    db.prepare("UPDATE collections_cases SET next_action_type = 'CALL_ATTEMPT', next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(at, a.actor_id, kase.id);
    db.prepare("INSERT INTO collection_actions (id, case_id, type, performed_by, performed_at, note) VALUES (?, ?, ?, ?, ?, ?)").run(nextId("ACT"), kase.id, "SMS", a.actor_id, at, "");
    audit(a.actor_id, a.actor_role, "case", kase.id, "collections.send_sms", kase, after);
  })();
  notifyTelegram("SEND_REMINDER", kase.contract_id);
  res.json(after);
});

app.post("/collections/:id/actions", (req, res) => {
  const a = actor(req);
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT"])) return;
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  const note = String(req.body.note || "");
  const rawType = String(req.body.type || "").trim().toUpperCase();
  const restoreRequestTypes = ["REQUEST_RESTORE", "REQUEST_RESTORE_ACCESS", "RESTORE_REQUESTED", "RELEASE_REQUESTED"];
  const isRestoreRequest = restoreRequestTypes.includes(rawType) || (rawType === "NOTE" && note.includes("RESTORE_ACCESS_REQUESTED"));
  const type = isRestoreRequest ? "REQUEST_RESTORE" : rawType;
  if (!kase || ((kase.status === "CLOSED" || kase.status === "CURED") && !isRestoreRequest)) return res.status(409).json({ error: "Invalid case action" });
  if (!["SEND_REMINDER", "CALL_ATTEMPT", "NOTE", "REQUEST_IMMOBILIZER", "REQUEST_RESTORE"].includes(type)) return res.status(400).json({ error: "Invalid action type" });
  if (type === "REQUEST_IMMOBILIZER" && kase.status !== "OPEN") {
    return res.status(409).json({ error: "Invalid case transition" });
  }
  const at = nowIso();
  const nextStatus = kase.status;
  const nextActionType = isRestoreRequest ? "APPROVE_RESTORE" : type === "REQUEST_IMMOBILIZER" ? "APPROVE_IMMOBILIZER" : type === "NOTE" ? kase.next_action_type || "CALL_ATTEMPT" : type;
  const action = { id: nextId("ACT"), case_id: kase.id, type, performed_by: a.actor_id, performed_at: at, note };
  const { contract, gps } = type === "REQUEST_IMMOBILIZER" || isRestoreRequest ? gpsForCase(kase) : { contract: null, gps: null };
  if (isRestoreRequest) {
    if (!contract || !gps || gps.status !== "IMMOBILIZER_ARMED") return res.status(409).json({ error: "Vehicle is not restricted" });
    const overdueLeft = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1", [contract.id]);
    if (overdueLeft || contract.status === "VOID") return res.status(409).json({ error: "Contract is not eligible for restore" });
    const existingRestore = row<any>(
      "SELECT * FROM gps_commands WHERE device_id = ? AND command_type = 'RELEASE' AND status IN ('APPROVED', 'SENT', 'ACKNOWLEDGED') ORDER BY created_at DESC LIMIT 1",
      [gps.id]
    );
    if (existingRestore) return res.status(409).json({ error: "Restore already requested" });
  }
  db.transaction(() => {
    db.prepare("INSERT INTO collection_actions (id, case_id, type, performed_by, performed_at, note) VALUES (?, ?, ?, ?, ?, ?)").run(action.id, action.case_id, action.type, action.performed_by, action.performed_at, action.note);
    db.prepare("UPDATE collections_cases SET status = ?, next_action_type = ?, next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(nextStatus, nextActionType, at, a.actor_id, kase.id);
    if (type === "REQUEST_IMMOBILIZER" && gps) {
      db.prepare("INSERT INTO gps_commands (id, device_id, command_type, requested_by, approved_by, status, provider_response, created_at, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
        nextId("CMD"),
        gps.id,
        "IMMOBILIZE",
        a.actor_id,
        null,
        "REQUESTED",
        "",
        at,
        null
      );
      db.prepare("UPDATE gps_devices SET last_command = 'IMMOBILIZE', last_command_status = 'REQUESTED', last_command_at = ? WHERE id = ?").run(at, gps.id);
    }
    audit(a.actor_id, a.actor_role, "case", kase.id, `collections.${type.toLowerCase()}`, kase, { ...kase, status: nextStatus, next_action_type: nextActionType, next_action_date: at, assigned_agent_id: a.actor_id });
  })();
  if (type === "SEND_REMINDER") notifyTelegram("SEND_REMINDER", kase.contract_id);
  if (type === "REQUEST_IMMOBILIZER") notifyTelegram("REQUEST_IMMOBILIZER", kase.contract_id);
  res.status(201).json(action);
});

app.post("/collections/:id/approve-immobilizer", (req, res) => {
  const a = actor(req);
  if (a.actor_role !== "CONTROLLER" && a.actor_role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase || kase.status !== "OPEN") return res.status(409).json({ error: "Invalid case transition" });
  const at = nowIso();
  const action = { id: nextId("ACT"), case_id: kase.id, type: "APPROVE_IMMOBILIZER", performed_by: a.actor_id, performed_at: at, note: String(req.body.note || "") };
  const after = { ...kase, status: "APPROVED", next_action_type: "ARM_IMMOBILIZER", next_action_date: at, assigned_agent_id: a.actor_id };
  const { gps } = gpsForCase(kase);
  let pendingCommand = gps
    ? row<any>("SELECT * FROM gps_commands WHERE device_id = ? AND command_type = 'IMMOBILIZE' AND status = 'REQUESTED' ORDER BY created_at DESC LIMIT 1", [gps.id])
    : null;

  if (gps && !pendingCommand) {
    const recoveredId = nextId("CMD");
    db.prepare(
      "INSERT INTO gps_commands (id, device_id, command_type, requested_by, approved_by, status, provider_response, created_at, executed_at) VALUES (?, ?, 'IMMOBILIZE', ?, NULL, 'REQUESTED', '', ?, NULL)"
    ).run(recoveredId, gps.id, kase.assigned_agent_id || a.actor_id, at);

    pendingCommand = row<any>(
      "SELECT * FROM gps_commands WHERE id = ?",
      [recoveredId]
    );

    console.log("[gps recovery] created missing REQUESTED immobilize command", recoveredId, gps.id);
  }

  if (!pendingCommand) return res.status(409).json({ error: "Invalid case transition: missing GPS device or request" });
  db.transaction(() => {
    db.prepare("UPDATE collections_cases SET status = 'APPROVED', next_action_type = 'ARM_IMMOBILIZER', next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(at, a.actor_id, kase.id);
    db.prepare("INSERT INTO collection_actions (id, case_id, type, performed_by, performed_at, note) VALUES (?, ?, ?, ?, ?, ?)").run(action.id, action.case_id, action.type, action.performed_by, action.performed_at, action.note);
    if (gps) {
      db.prepare(
        "UPDATE gps_commands SET status = 'APPROVED', approved_by = ? WHERE id = (SELECT id FROM gps_commands WHERE device_id = ? AND command_type = 'IMMOBILIZE' AND status = 'REQUESTED' ORDER BY created_at DESC LIMIT 1)"
      ).run(a.actor_id, gps.id);
      db.prepare("UPDATE gps_devices SET last_command = 'IMMOBILIZE', last_command_status = 'APPROVED', last_command_at = ? WHERE id = ?").run(at, gps.id);
    }
    audit(a.actor_id, a.actor_role, "case", kase.id, "collections.approve_immobilizer", kase, after);
  })();
  notifyTelegram("APPROVE_IMMOBILIZER", kase.contract_id);
  res.json(after);
});

app.post("/collections/:id/immobilize", (req, res) => {
  const a = actor(req);
  if (!requireOneOf(req, res, ["OPS"])) return;
  reconcileGpsStatusFromCommands();
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase) return res.status(404).json({ error: "Case not found" });
  if (kase.status !== "APPROVED") return res.status(409).json({ error: "Immobilizer approval required" });
  const { contract, vehicle, gps } = gpsForCase(kase);

  const active = activeGpsCommand(gps.id);
  if (active) {
    return res.status(409).json({ error: "Another GPS command is still in progress" });
  }

  const overdueLeft = row<any>(
    "SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1",
    [contract.id]
  );
  if (!overdueLeft || contract.status !== "OVERDUE") {
    audit(a.actor_id, a.actor_role, "case", kase.id, "collections.arm_immobilizer_blocked_cured", kase, {
      reason: "Contract is no longer overdue at execution time",
      contract_status: contract.status
    });
    return res.status(409).json({ error: "Contract is no longer overdue. Immobilization blocked." });
  }

  if (!gps || gps.status !== "ONLINE") return res.status(409).json({ error: "Invalid GPS transition" });
  const at = nowIso();
  let sentCommandId = "";
  db.transaction(() => {
    db.prepare("UPDATE collections_cases SET status = 'OPEN', next_action_type = 'COLLECT_PAYMENT', next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(at, a.actor_id, kase.id);
    db.prepare("UPDATE gps_devices SET last_command = 'IMMOBILIZE', last_command_status = 'SENT', last_command_at = ? WHERE id = ?").run(at, gps.id);
    db.prepare(
      "UPDATE gps_commands SET status = 'SENT', executed_at = ? WHERE id = (SELECT id FROM gps_commands WHERE device_id = ? AND command_type = 'IMMOBILIZE' AND status = 'APPROVED' ORDER BY created_at DESC LIMIT 1)"
    ).run(at, gps.id);
    sentCommandId = row<{ id: string }>("SELECT id FROM gps_commands WHERE device_id = ? AND command_type = 'IMMOBILIZE' AND status = 'SENT' ORDER BY executed_at DESC LIMIT 1", [gps.id])?.id ?? "";
    db.prepare("INSERT INTO collection_actions (id, case_id, type, performed_by, performed_at, note) VALUES (?, ?, ?, ?, ?, ?)").run(nextId("ACT"), kase.id, "ARM_IMMOBILIZER", a.actor_id, at, "");
    audit(a.actor_id, a.actor_role, "case", kase.id, "collections.arm_immobilizer", kase, { ...kase, status: "OPEN", next_action_type: "COLLECT_PAYMENT", next_action_date: at, assigned_agent_id: a.actor_id });
  })();
  if (sentCommandId) simulateMockGpsProvider(sentCommandId, gps, vehicle, a, req.body?.mock_provider_result === "FAILED");
  notifyTelegram("EXECUTE_IMMOBILIZER", contract.id);
  res.json({ status: "SENT", command_id: sentCommandId });
});

app.post("/collections/:id/approve-restore", (req, res) => {
  const a = actor(req);
  if (!["ADMIN", "CONTROLLER"].includes(a.actor_role)) return res.status(403).json({ error: "Forbidden" });
  reconcileGpsStatusFromCommands();
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase) return res.status(404).json({ error: "Case not found" });
  const { contract, gps } = gpsForCase(kase);
  if (!contract || !gps || gps.status !== "IMMOBILIZER_ARMED") return res.status(409).json({ error: "Vehicle is not restricted" });
  const overdueLeft = row<any>("SELECT * FROM installments WHERE contract_id = ? AND status = 'OVERDUE' LIMIT 1", [contract.id]);
  if (overdueLeft || contract.status !== "ACTIVE") return res.status(409).json({ error: "Contract is not eligible for restore" });
  const existing = row<any>(
    "SELECT * FROM gps_commands WHERE device_id = ? AND command_type = 'RELEASE' AND status IN ('APPROVED', 'SENT') ORDER BY created_at DESC LIMIT 1",
    [gps.id]
  );
  if (existing) return res.json({ status: existing.status, command_id: existing.id });
  const at = nowIso();
  const commandId = nextId("CMD");
  db.transaction(() => {
    db.prepare("INSERT INTO gps_commands (id, device_id, command_type, requested_by, approved_by, status, provider_response, created_at, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      commandId,
      gps.id,
      "RELEASE",
      a.actor_id,
      a.actor_id,
      "APPROVED",
      "",
      at,
      null
    );
    db.prepare("UPDATE gps_devices SET last_command = 'RELEASE', last_command_status = 'APPROVED', last_command_at = ? WHERE id = ?").run(at, gps.id);
    db.prepare("UPDATE collections_cases SET next_action_type = 'EXECUTE_RESTORE_ACCESS', next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(at, a.actor_id, kase.id);
    audit(a.actor_id, a.actor_role, "case", kase.id, "restore_access.approved", kase, { ...kase, next_action_type: "EXECUTE_RESTORE_ACCESS", next_action_date: at, assigned_agent_id: a.actor_id });
  })();
  res.json({ status: "APPROVED", command_id: commandId });
});

app.post("/collections/:id/restore-access", (req, res) => {
  const a = actor(req);
  if (!["ADMIN", "OPS"].includes(a.actor_role)) return res.status(403).json({ error: "Forbidden" });
  reconcileGpsStatusFromCommands();
  const kase = row<any>("SELECT * FROM collections_cases WHERE id = ?", [req.params.id]);
  if (!kase) return res.status(404).json({ error: "Case not found" });
  const { contract, vehicle, gps } = gpsForCase(kase);
  if (!contract || !vehicle || !gps || gps.status !== "IMMOBILIZER_ARMED") return res.status(409).json({ error: "Vehicle is not restricted" });
  const command = row<any>(
    "SELECT * FROM gps_commands WHERE device_id = ? AND command_type = 'RELEASE' AND status = 'APPROVED' ORDER BY created_at DESC LIMIT 1",
    [gps.id]
  );
  if (!command) return res.status(409).json({ error: "Restore approval required" });
  const at = nowIso();
  db.transaction(() => {
    db.prepare("UPDATE gps_commands SET status = 'SENT', executed_at = ? WHERE id = ?").run(at, command.id);
    db.prepare("UPDATE gps_devices SET last_command = 'RELEASE', last_command_status = 'SENT', last_command_at = ? WHERE id = ?").run(at, gps.id);
    db.prepare("UPDATE collections_cases SET next_action_type = 'COLLECT_PAYMENT', next_action_date = ?, assigned_agent_id = ? WHERE id = ?").run(at, a.actor_id, kase.id);
    audit(a.actor_id, a.actor_role, "case", kase.id, "restore_access.execute", kase, { ...kase, next_action_type: "COLLECT_PAYMENT", next_action_date: at, assigned_agent_id: a.actor_id });
  })();
  simulateMockGpsProvider(command.id, gps, vehicle, a, req.body?.mock_provider_result === "FAILED");
  res.json({ status: "SENT", command_id: command.id });
});



app.post("/telegram/link-phone", (req, res) => {
  const phoneRaw = req.body?.phone || req.body?.phone_number || req.body?.contact_phone;
  const chatId = req.body?.chat_id || req.body?.chatId;

  const phone = normalizePhoneForTelegram(phoneRaw);
  if (!phone || !chatId) {
    return res.status(400).json({ error: "phone and chat_id are required" });
  }

  const matches = rows<any>(
    `SELECT id, full_name, phone
     FROM clients
     WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, '+', ''), ' ', ''), '-', ''), '(', ''), ')', '') = ?`,
    [phone]
  );

  if (matches.length === 0) {
    return res.status(404).json({ error: "Phone not found" });
  }

  if (matches.length > 1) {
    return res.status(409).json({ error: "Multiple clients match this phone", count: matches.length });
  }

  const client = matches[0];

  db.prepare("UPDATE clients SET telegram_chat_id = ? WHERE id = ?").run(String(chatId), client.id);

  const contracts = rows<any>(
    `SELECT id, status
     FROM contracts
     WHERE client_id = ?
     ORDER BY id`,
    [client.id]
  );

  res.json({
    ok: true,
    client_id: client.id,
    full_name: client.full_name,
    phone: client.phone,
    telegram_chat_id: String(chatId),
    contracts
  });
});

app.get("/gps-live-state", (req, res) => {
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"])) return;
  const items = rows<any>(`
    SELECT
      c.id AS contract_id,
      c.status AS contract_status,
      c.vehicle_id AS vehicle_id,
      v.plate AS plate,
      gd.id AS gps_id,
      gd.status AS gps_status,
      gd.last_command AS last_command,
      gd.last_command_status AS last_command_status,
      cc.id AS case_id,
      cc.status AS case_status
    FROM contracts c
    LEFT JOIN vehicles v ON v.id = c.vehicle_id
    LEFT JOIN gps_devices gd ON gd.vehicle_id = c.vehicle_id
    LEFT JOIN collections_cases cc ON cc.contract_id = c.id
    WHERE c.status <> 'VOID'
    ORDER BY c.id
  `);

  res.json({
    contracts: items.map((x) => ({
      id: x.contract_id,
      contract_id: x.contract_id,
      status: x.contract_status,
      vehicle_id: x.vehicle_id,
      plate: x.plate
    })),
    cases: items.map((x) => ({
      id: x.case_id,
      contract_id: x.contract_id,
      status: x.case_status,
      gps_status: x.gps_status
    })),
    vehicles: items.map((x) => ({
      id: x.vehicle_id || x.gps_id || x.contract_id,
      vehicle_id: x.vehicle_id,
      contract_id: x.contract_id,
      plate: x.plate,
      gps_id: x.gps_id,
      status: x.gps_status || "ONLINE",
      gps_status: x.gps_status || "ONLINE",
      last_command: x.last_command,
      last_command_status: x.last_command_status
    }))
  });
});

app.get("/gps", (req, res) => {
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"])) return;
  refreshOverdueState();
  reconcileGpsStatusFromCommands();
  res.json({
    vehicles: rows<any>("SELECT * FROM vehicles ORDER BY id"),
    gpsDevices: rows<any>("SELECT * FROM gps_devices ORDER BY id").map(jsonGps),
    contracts: rows<any>("SELECT c.*, cl.full_name AS client FROM contracts c JOIN clients cl ON cl.id = c.client_id ORDER BY c.id"),
    
cases: rows<any>(`
  SELECT 
    cc.*,

    c.full_name AS client_name,
    c.phone AS client_phone,
    c.address AS client_address,
    c.national_id AS client_national_id,

    ctr.monthly_total,
    ctr.vehicle_price,
    ctr.down_payment,
    ctr.financed_amount,
    ctr.credit_balance,

    v.plate,
    v.vin

  FROM collections_cases cc
  LEFT JOIN clients c ON cc.client_id = c.id
  LEFT JOIN contracts ctr ON cc.contract_id = ctr.id
  LEFT JOIN vehicles v ON ctr.id = v.contract_id

  ORDER BY cc.opened_at DESC
`)
,
    alerts: syncDerivedAlerts()
  });
});

app.get("/devices", (req, res) => {
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"])) return;
  reconcileGpsStatusFromCommands();
  const devices = rows<any>(
    `SELECT
      g.*,
      c.id AS contract_id,
      c.client_id AS client_id,
      cl.full_name AS client_name,
      v.plate AS plate
    FROM gps_devices g
    JOIN vehicles v ON v.id = g.vehicle_id
    JOIN contracts c ON c.id = v.contract_id
    JOIN clients cl ON cl.id = c.client_id
    ORDER BY g.id`
  ).map(deviceManagementRow);
  res.json({ devices });
});

app.get("/devices/:id", (req, res) => {
  if (!requireOneOf(req, res, ["COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"])) return;
  reconcileGpsStatusFromCommands();
  const device = row<any>(
    `SELECT
      g.*,
      c.id AS contract_id,
      c.client_id AS client_id,
      cl.full_name AS client_name,
      v.plate AS plate
    FROM gps_devices g
    JOIN vehicles v ON v.id = g.vehicle_id
    JOIN contracts c ON c.id = v.contract_id
    JOIN clients cl ON cl.id = c.client_id
    WHERE g.id = ?`,
    [req.params.id]
  );
  if (!device) return res.status(404).json({ error: "Device not found" });
  const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [device.vehicle_id]);
  const contract = row<any>("SELECT * FROM contracts WHERE id = ?", [device.contract_id]);
  const client = row<any>("SELECT * FROM clients WHERE id = ?", [device.client_id]);
  const command_history = rows<any>("SELECT * FROM gps_commands WHERE device_id = ? ORDER BY created_at DESC", [device.id]);
  res.json({
    device: deviceManagementRow(device),
    vehicle,
    contract,
    client,
    current_computed_status: computedDeviceStatus(device),
    command_history
  });
});

app.patch("/devices/:id", (req, res) => {
  const currentUser = (req as unknown as express.Request & { user: SessionUser }).user;
  if (!["ADMIN", "OPS"].includes(currentUser.role)) return res.status(403).json({ error: "Forbidden" });
  const device = row<any>("SELECT * FROM gps_devices WHERE id = ?", [req.params.id]);
  if (!device) return res.status(404).json({ error: "Device not found" });
  const metadata = {
    provider: String(req.body.provider || "").trim(),
    provider_device_id: String(req.body.provider_device_id || "").trim(),
    imei: String(req.body.imei || "").trim(),
    sim_number: String(req.body.sim_number || "").trim()
  };
  db.prepare("UPDATE gps_devices SET provider = ?, provider_device_id = ?, imei = ?, sim_number = ? WHERE id = ?").run(
    metadata.provider,
    metadata.provider_device_id,
    metadata.imei,
    metadata.sim_number,
    device.id
  );
  res.json(jsonGps(row<any>("SELECT * FROM gps_devices WHERE id = ?", [device.id])));
});


app.post("/gps-commands/:id/retry", (req, res) => {
  if (!requireOneOf(req, res, ["OPS"])) return;
  const a = actor(req);

  const command = row<any>("SELECT * FROM gps_commands WHERE id = ?", [req.params.id]);
  if (!command) return res.status(404).json({ error: "Command not found" });
  if (command.status !== "FAILED") return res.status(409).json({ error: "Only FAILED commands can be retried" });

  const active = activeGpsCommand(command.device_id);
  if (active) {
    return res.status(409).json({ error: "Another GPS command is still in progress" });
  }

  const at = nowIso();
  const newId = nextId("CMD");

  db.transaction(() => {
    db.prepare(
      "INSERT INTO gps_commands (id, device_id, command_type, requested_by, approved_by, status, provider_response, created_at, executed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      newId,
      command.device_id,
      command.command_type,
      a.actor_id,
      null,
      "SENT",
      "",
      at,
      at
    );

    db.prepare("UPDATE gps_devices SET last_command = ?, last_command_status = 'SENT', last_command_at = ? WHERE id = ?")
      .run(command.command_type, at, command.device_id);

    audit(a.actor_id, a.actor_role, "vehicle", command.device_id, "gps.command_retry_requested", command, {
      retried_from_command_id: command.id,
      new_command_id: newId,
      command_type: command.command_type,
      status: "SENT"
    });
  })();

  
  const gps = row<any>("SELECT * FROM gps_devices WHERE id = ?", [command.device_id]);
  const vehicle = row<any>("SELECT * FROM vehicles WHERE id = ?", [gps.vehicle_id]);

  simulateMockGpsProvider(newId, gps, vehicle, a, req.body?.mock_provider_result === "FAILED");

  res.json({ status: "SENT", command_id: newId });

});

app.get("/alerts", (_req, res) => {
  refreshOverdueState();
  reconcileGpsStatusFromCommands();
  res.json(syncDerivedAlerts());
});

app.get("/reporting/summary", (req, res) => {
  if (!requireOneOf(req, res, ["FINANCE", "CONTROLLER", "VIEWER"])) return;
  refreshOverdueState();
  reconcileGpsStatusFromCommands();
  res.json(reportingSummary());
});

app.get("/reporting/aging", (req, res) => {
  if (!requireOneOf(req, res, ["FINANCE", "CONTROLLER", "VIEWER"])) return;
  refreshOverdueState();
  res.json(reportingAging());
});

app.get("/reporting/cashflow", (req, res) => {
  if (!requireOneOf(req, res, ["FINANCE", "CONTROLLER", "VIEWER"])) return;
  refreshOverdueState();
  res.json(reportingCashflow());
});

app.post("/alerts/:id/ack", (req, res) => {
  if (!requireOneOf(req, res, ["FINANCE", "COLLECTIONS_AGENT", "OPS", "CONTROLLER"])) return;
  const a = actor(req);
  refreshOverdueState();
  syncDerivedAlerts();
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


const REQUESTED_TIMEOUT_MS = 30 * 1000;
const SENT_TIMEOUT_MS = 120 * 1000;

function gpsCommandTimeoutWatcher() {
  const at = nowIso();
  const pendingCommands = rows<any>(
    "SELECT * FROM gps_commands WHERE status IN ('REQUESTED', 'SENT')"
  );

  for (const command of pendingCommands) {
    const createdAt = new Date(command.created_at).getTime();
    if (!createdAt) continue;

    const ageMs = Date.now() - createdAt;
    const timedOut =
      (command.status === "REQUESTED" && ageMs > REQUESTED_TIMEOUT_MS) ||
      (command.status === "SENT" && ageMs > SENT_TIMEOUT_MS);

    if (!timedOut) continue;

    const gps = row<any>("SELECT * FROM gps_devices WHERE id = ?", [command.device_id]);
    const vehicleId = gps?.vehicle_id ?? command.device_id;

    db.transaction(() => {
      db.prepare("UPDATE gps_commands SET status = 'FAILED', provider_response = ? WHERE id = ?")
        .run("GPS command timed out before provider acknowledgement", command.id);

      db.prepare("UPDATE gps_devices SET last_command_status = 'FAILED', last_command_at = ? WHERE id = ?")
        .run(at, command.device_id);

      db.prepare(
        "INSERT INTO alerts (id, severity, source, entity_type, entity_id, title, message, created_at, acknowledged_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        nextId("ALT"),
        "CRITICAL",
        "GPS",
        "vehicle",
        vehicleId,
        "GPS command timeout",
        `${command.command_type} command timed out for GPS device ${command.device_id}`,
        at,
        null,
        null
      );
    })();
  }
}

setInterval(gpsCommandTimeoutWatcher, 5000);


const server = app.listen(4000, "127.0.0.1", () => {
  console.log("EMC API listening on http://127.0.0.1:4000");
  console.log(`DB path: ${dbPath}`);
  console.log(`Users: ${row<{ count: number }>("SELECT COUNT(*) AS count FROM users")?.count ?? 0}`);
  console.log(`Contracts: ${row<{ count: number }>("SELECT COUNT(*) AS count FROM contracts")?.count ?? 0}`);
  console.log(`Payments: ${row<{ count: number }>("SELECT COUNT(*) AS count FROM payments")?.count ?? 0}`);
});

process.on("SIGTERM", () => server.close());
