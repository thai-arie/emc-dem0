import { useEffect, useState } from "react";
import type { Alert, AuditEntry, Client, CollectionAction, CollectionsCase, Contract, GPSCommand, GPSDevice, Installment, Payment, Role, Vehicle } from "../entities/types";

const API = "http://127.0.0.1:4000";

export interface ActorPayload {
  actor_id: string;
  actor_role: Role;
}

export type UserStatus = "ACTIVE" | "DISABLED";

export interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export type UserPayload = {
  full_name: string;
  email: string;
  role: Role;
  status: UserStatus;
  password?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("http") ? path : `${API}${path}`;

  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    if (response.status === 401) {
      window.localStorage.removeItem("emc.auth.user");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    throw new Error(body.error || response.statusText);
  }

  return response.json() as Promise<T>;
}

async function upload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    if (response.status === 401) {
      window.localStorage.removeItem("emc.auth.user");
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    throw new Error(body.error || response.statusText);
  }

  return response.json() as Promise<T>;
}

export function applicationDocumentFileUrl(id: string) {
  return `${API}/application-documents/${encodeURIComponent(id)}/file`;
}

export function useApiData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    loader()
      .then((next) => {
        if (alive) {
          setData(next);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [version, ...deps]);
  useEffect(() => {
    const listener = () => setVersion((value) => value + 1);
    window.addEventListener("emc:data", listener);
    return () => window.removeEventListener("emc:data", listener);
  }, []);
  return { data, error, reload: () => setVersion((value) => value + 1) };
}

function refresh() {
  window.dispatchEvent(new Event("emc:data"));
}

export interface ContractsResponse {
  contracts: Array<Contract & { client: string; phone: string }>;
  payments: Payment[];
  cash: { total_disbursed: number; total_collected: number; outstanding: number; overdue_amount: number; active_contracts: number; overdue_contracts: number };
}

export interface ContractDetailResponse {
  contract: Contract;
  client: Client;
  vehicle: Vehicle;
  gps: GPSDevice;
  payments: Payment[];
  cases: Array<CollectionsCase & { overdue_amount?: number; last_action?: string | null }>;
  audit: AuditEntry[];
  financials: { paid_to_date: number; outstanding_balance: number; overdue_amount: number; credit_balance: number };
}

export interface ClientProfileResponse {
  client: Client;
  contracts: Contract[];
  payments: Payment[];
  cases: CollectionsCase[];
  audit: AuditEntry[];
}

export interface ReportingSummaryResponse {
  portfolio: {
    total_contracts: number;
    active_contracts: number;
    overdue_contracts: number;
    overdue_percent: number;
    total_outstanding: number;
    total_overdue_amount: number;
  };
  payments: {
    collected_today: number;
    collected_last_7_days: number;
    collected_last_30_days: number;
    total_collected_all_time: number;
  };
  collections: {
    open_cases: number;
    cases_cured_this_month: number;
    immobilizer_armed_count: number;
    critical_alerts_count: number;
  };
}

export interface AgingRow {
  bucket: string;
  contract_count: number;
  amount_overdue: number;
}

export interface CashflowRow {
  date: string;
  amount_collected: number;
  payment_count: number;
}

export type ApplicationStageRecord = "DRAFT" | "DOCS_PENDING" | "BANK_REVIEW" | "READY_TO_SIGN" | "APPROVED" | "REJECTED" | "CANCELLED";
export type ApplicationDocumentTypeRecord = "NATIONAL_ID_OR_PASSPORT" | "DRIVER_LICENSE" | "PROOF_OF_INCOME" | "PROOF_OF_ADDRESS" | "SIGNED_APPLICATION" | "VEHICLE_DOCUMENTS" | "OTHER";
export type ApplicationDocumentStatusRecord = "REQUIRED" | "UPLOADED" | "REVIEWED" | "REJECTED" | "WAIVED";
export type FinancePartnerStatusRecord = "ACTIVE" | "INACTIVE";

export interface ApplicationRecord {
  id: string;
  client_full_name: string;
  client_phone: string;
  client_national_id: string | null;
  vehicle_catalog_id: string | null;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: number | null;
  vehicle_price_cents: number;
  vehicle_cost_cents: number | null;
  down_payment_cents: number;
  down_payment_pct: number;
  term_months: number;
  apr_pct: number;
  pricing_tier_id: string | null;
  financial_partner_id: string | null;
  insurance_partner_id: string | null;
  bank_account_id: string | null;
  bank_funded_amount_cents: number | null;
  emc_funded_amount_cents: number | null;
  settlement_mode: string;
  closure_mode: string;
  stage: ApplicationStageRecord;
  notes: string;
  created_at: string;
  updated_at: string;
  rejected_reason: string | null;
}

export type ApplicationPayload = Omit<ApplicationRecord, "id" | "created_at" | "updated_at">;

export interface ApplicationDocumentRecord {
  id: string;
  application_id: string;
  document_type: ApplicationDocumentTypeRecord;
  status: ApplicationDocumentStatusRecord;
  file_name: string | null;
  storage_key: string | null;
  uploaded_by: string | null;
  reviewed_by: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
  notes: string;
}

export type ApplicationDocumentPayload = Pick<ApplicationDocumentRecord, "document_type" | "status" | "file_name" | "storage_key" | "notes">;

export interface VehicleCatalogRecord {
  id: string;
  brand: string;
  model: string;
  variant: string | null;
  year: number | null;
  category: string | null;
  default_price_cents: number;
  default_cost_cents: number | null;
  stock_count: number;
  status: FinancePartnerStatusRecord;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type VehicleCatalogPayload = Omit<VehicleCatalogRecord, "id" | "created_at" | "updated_at">;

export interface FinancialPartnerRecord {
  id: string;
  name: string;
  funding_type: string;
  cost_rate_pct: number;
  active_contracts_count: number;
  status: FinancePartnerStatusRecord;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type FinancialPartnerPayload = Omit<FinancialPartnerRecord, "id" | "created_at" | "updated_at">;

export interface InsurancePartnerRecord {
  id: string;
  name: string;
  premium_pct: number;
  commission_pct: number;
  settlement_timing: string;
  status: FinancePartnerStatusRecord;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type InsurancePartnerPayload = Omit<InsurancePartnerRecord, "id" | "created_at" | "updated_at">;

export type CollectionsCaseRow = CollectionsCase & {
  client: string;
  client_name?: string;
  client_phone?: string;
  client_address?: string;
  client_national_id?: string;

  monthly_total?: number;
  vehicle_price?: number;
  down_payment?: number;
  financed_amount?: number;
  credit_balance?: number;

  plate?: string;
  vin?: string;

  contract_status: Contract["status"];
  dpd: number;
  overdue_amount: number;
  last_action: string;
  gps_status: GPSDevice["status"];
  workflow_next_action_type?: string;
  restore_command_status?: string;
  decision_reason: string;
  restore_decision_reason?: string;
};

export type DeviceManagementRow = {
  id: string;
  device_id: string;
  vehicle_id: string;
  contract_id: string;
  client_id: string;
  client_name: string;
  imei: string;
  sim: string;
  sim_number: string;
  provider: string;
  last_seen_at: string;
  battery: number;
  ignition: "ON" | "OFF";
  latest_acknowledged_command_type: GPSCommand["command_type"] | null;
  latest_acknowledged_command_status: GPSCommand["status"] | null;
  latest_acknowledged_command_at: string | null;
  computed_device_status: "ONLINE" | "RESTRICTED" | "WARNING";
  status: "ONLINE" | "RESTRICTED" | "WARNING";
  last_command: string;
  last_command_status: string;
  can_send_command: boolean;
  missing_identity_reason: string | null;
  device_health_alert: "FAILED_RELEASE" | null;
};

export interface DeviceDetailResponse {
  device: DeviceManagementRow;
  vehicle: Vehicle;
  contract: Contract;
  client: Client;
  current_computed_status: "ONLINE" | "RESTRICTED" | "WARNING";
  command_history: GPSCommand[];
};

export interface CreateContractPayload extends ActorPayload {
  client_name: string;
  phone: string;
  address: string;
  national_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  vehicle_brand: string;
  vehicle_model: string;
  vin: string;
  plate: string;
  vehicle_price: number;
  down_payment: number;
  financed_amount: number;
  monthly_total: number;
  term_months: number;
  start_date: string;
}

export const api = {
  login: async (email: string, password: string) => {
    const result = await request<{ user: import("../entities/types").User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    return result.user;
  },
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: async () => {
    const result = await request<{ user: import("../entities/types").User }>("/auth/me");
    return result.user;
  },
  getContracts: () => request<ContractsResponse>("/contracts"),
  getVoidedContracts: () => request<{ contracts: Array<Contract & { client: string; phone: string }> }>("/contracts/void"),
  getContract: (id: string) => request<ContractDetailResponse>(`/contracts/${id}`),
  getClient: (id: string) => request<ClientProfileResponse>(`/clients/${id}`),
  createContract: async (body: CreateContractPayload) => {
    const result = await request<Contract>("/contracts", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  voidContract: async (id: string) => {
    const result = await request<{ ok: boolean }>(`/contracts/${id}/void`, { method: "POST" });
    refresh();
    return result;
  },
  getInstallments: (contract_id?: string) => request<{ installments: Array<Installment & { client?: string }>; payments: Payment[] }>(`/installments${contract_id ? `?contract_id=${encodeURIComponent(contract_id)}` : ""}`),
  recordPayment: async (body: { installment_id: string; amount: number; method: Payment["method"]; reference: string; note: string; allocation_type?: Payment["allocation_type"]; idempotency_key?: string } & ActorPayload) => {
    const result = await request<Payment>("/payments", { method: "POST", body: JSON.stringify({ ...body, idempotency_key: body.idempotency_key ?? crypto.randomUUID() }) });
    refresh();
    return result;
  },
  getCollections: () => request<{ cases: CollectionsCaseRow[]; actions: CollectionAction[] }>("/collections"),
  getGpsCommands: (caseId: string) => request<GPSCommand[]>(`/collections/${caseId}/gps-commands`),
  retryGpsCommand: (commandId: string) =>
    request<{ status: string; command_id: string }>(`/gps-commands/${commandId}/retry`, { method: "POST" }),


  sendSms: async (caseId: string, actor: ActorPayload) => {
    const result = await request<CollectionsCase>(`/collections/${caseId}/sms`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  immobilize: async (caseId: string, actor: ActorPayload) => {
    const result = await request<{ status: "SENT"; command_id: string }>(`/collections/${caseId}/immobilize`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  approveImmobilizer: async (caseId: string, actor: ActorPayload) => {
    const result = await request<CollectionsCase>(`/collections/${caseId}/approve-immobilizer`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  approveRestoreAccess: async (caseId: string, actor: ActorPayload) => {
    const result = await request<{ status: string; command_id: string }>(`/collections/${caseId}/approve-restore`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  executeRestoreAccess: async (caseId: string, actor: ActorPayload) => {
    const result = await request<{ status: "SENT"; command_id: string }>(`/collections/${caseId}/restore-access`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  logCollectionAction: async (caseId: string, body: { type: "SEND_REMINDER" | "CALL_ATTEMPT" | "NOTE" | "REQUEST_IMMOBILIZER" | "REQUEST_RESTORE"; note?: string } & ActorPayload) => {
    const result = await request<CollectionAction>(`/collections/${caseId}/actions`, { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getGps: () => request<{ vehicles: Vehicle[]; gpsDevices: GPSDevice[]; contracts: Array<Contract & { client?: string }>; cases: CollectionsCase[]; alerts: Alert[] }>("/gps"),
  getDevices: () => request<{ devices: DeviceManagementRow[] }>("/devices"),
  getDevice: (id: string) => request<DeviceDetailResponse>(`/devices/${id}`),
  updateDevice: async (id: string, body: Pick<GPSDevice, "provider" | "provider_device_id" | "imei" | "sim_number">) => {
    const result = await request<GPSDevice>(`/devices/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getAlerts: () => request<Alert[]>("/alerts"),
  acknowledgeAlert: async (alertId: string, actor: ActorPayload) => {
    const result = await request<Alert>(`/alerts/${alertId}/ack`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  getReportingSummary: () => request<ReportingSummaryResponse>("/reporting/summary"),
  getReportingAging: () => request<AgingRow[]>("/reporting/aging"),
  getReportingCashflow: () => request<CashflowRow[]>("/reporting/cashflow"),
  getVehicleCatalog: () => request<{ vehicles: VehicleCatalogRecord[] }>("/finance/vehicle-catalog"),
  createVehicleCatalogItem: async (body: VehicleCatalogPayload) => {
    const result = await request<VehicleCatalogRecord>("/finance/vehicle-catalog", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  updateVehicleCatalogItem: async (id: string, body: VehicleCatalogPayload) => {
    const result = await request<VehicleCatalogRecord>(`/finance/vehicle-catalog/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getFinancialPartners: () => request<{ partners: FinancialPartnerRecord[] }>("/finance/financial-partners"),
  createFinancialPartner: async (body: FinancialPartnerPayload) => {
    const result = await request<FinancialPartnerRecord>("/finance/financial-partners", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  updateFinancialPartner: async (id: string, body: FinancialPartnerPayload) => {
    const result = await request<FinancialPartnerRecord>(`/finance/financial-partners/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getInsurancePartners: () => request<{ partners: InsurancePartnerRecord[] }>("/finance/insurance-partners"),
  createInsurancePartner: async (body: InsurancePartnerPayload) => {
    const result = await request<InsurancePartnerRecord>("/finance/insurance-partners", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  updateInsurancePartner: async (id: string, body: InsurancePartnerPayload) => {
    const result = await request<InsurancePartnerRecord>(`/finance/insurance-partners/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getApplications: () => request<{ applications: ApplicationRecord[] }>("/applications"),
  getApplication: (id: string) => request<ApplicationRecord>(`/applications/${id}`),
  createApplication: async (body: ApplicationPayload) => {
    const result = await request<ApplicationRecord>("/applications", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  updateApplication: async (id: string, body: ApplicationPayload) => {
    const result = await request<ApplicationRecord>(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getApplicationDocuments: (applicationId: string) => request<{ documents: ApplicationDocumentRecord[] }>(`/applications/${applicationId}/documents`),
  createApplicationDocument: async (applicationId: string, body: ApplicationDocumentPayload) => {
    const result = await request<ApplicationDocumentRecord>(`/applications/${applicationId}/documents`, { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  updateApplicationDocument: async (id: string, body: ApplicationDocumentPayload) => {
    const result = await request<ApplicationDocumentRecord>(`/application-documents/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  uploadApplicationDocument: async (id: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const result = await upload<ApplicationDocumentRecord>(`/application-documents/${id}/upload`, formData);
    refresh();
    return result;
  },
  getUsers: () => request<{ users: ManagedUser[] }>("/admin/users"),
  createUser: async (body: UserPayload) => {
    const result = await request<ManagedUser>("/admin/users", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  updateUser: async (id: string, body: UserPayload) => {
    const result = await request<ManagedUser>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  resetUserPassword: async (id: string, password: string) => {
    const result = await request<{ ok: boolean }>(`/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
    refresh();
    return result;
  },
  getAudit: () => request<AuditEntry[]>("/audit")
};

export function actorFromUser(user: { id: string; role: Role } | null): ActorPayload {
  return { actor_id: user?.id ?? "USR-COL", actor_role: user?.role ?? "COLLECTIONS_AGENT" };
}
