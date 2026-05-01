import { useEffect, useState } from "react";
import type { Alert, AuditEntry, Client, CollectionAction, CollectionsCase, Contract, GPSDevice, Installment, Payment, Role, Vehicle } from "../entities/types";

const API = "http://127.0.0.1:4000";

export interface ActorPayload {
  actor_id: string;
  actor_role: Role;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error || response.statusText);
  }
  return response.json() as Promise<T>;
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
  cases: CollectionsCase[];
  audit: AuditEntry[];
  financials: { paid_to_date: number; outstanding_balance: number; overdue_amount: number };
}

export interface ClientProfileResponse {
  client: Client;
  contracts: Contract[];
  payments: Payment[];
  cases: CollectionsCase[];
  audit: AuditEntry[];
}

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
  getContracts: () => request<ContractsResponse>("/contracts"),
  getContract: (id: string) => request<ContractDetailResponse>(`/contracts/${id}`),
  getClient: (id: string) => request<ClientProfileResponse>(`/clients/${id}`),
  createContract: async (body: CreateContractPayload) => {
    const result = await request<Contract>("/contracts", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getInstallments: (contract_id?: string) => request<{ installments: Array<Installment & { client?: string }>; payments: Payment[] }>(`/installments${contract_id ? `?contract_id=${encodeURIComponent(contract_id)}` : ""}`),
  recordPayment: async (body: { installment_id: string; amount: number; method: Payment["method"]; reference: string; note: string } & ActorPayload) => {
    const result = await request<Payment>("/payments", { method: "POST", body: JSON.stringify(body) });
    refresh();
    return result;
  },
  getCollections: () => request<{ cases: Array<CollectionsCase & { client: string }>; actions: CollectionAction[] }>("/collections"),
  sendSms: async (caseId: string, actor: ActorPayload) => {
    const result = await request<CollectionsCase>(`/collections/${caseId}/sms`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  immobilize: async (caseId: string, actor: ActorPayload) => {
    const result = await request<Alert>(`/collections/${caseId}/immobilize`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  getGps: () => request<{ vehicles: Vehicle[]; gpsDevices: GPSDevice[] }>("/gps"),
  getAlerts: () => request<Alert[]>("/alerts"),
  acknowledgeAlert: async (alertId: string, actor: ActorPayload) => {
    const result = await request<Alert>(`/alerts/${alertId}/ack`, { method: "POST", body: JSON.stringify(actor) });
    refresh();
    return result;
  },
  getAudit: () => request<AuditEntry[]>("/audit")
};

export function actorFromUser(user: { id: string; role: Role } | null): ActorPayload {
  return { actor_id: user?.id ?? "USR-COL", actor_role: user?.role ?? "COLLECTIONS" };
}
