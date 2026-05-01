export type Role = "CEO" | "COLLECTIONS" | "OPS";

export interface User {
  id: string;
  full_name: string;
  role: Role;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
}

export interface Contract {
  id: string;
  client_id: string;
  vehicle_id: string;
  status: "ACTIVE" | "OVERDUE";
  monthly_total: number;
  start_date: string;
  term_months: number;
}

export interface Vehicle {
  id: string;
  vin: string;
  brand: string;
  model: string;
  plate: string;
  contract_id: string;
  gps_device_id: string;
}

export interface GPSDevice {
  id: string;
  vehicle_id: string;
  status: "ONLINE" | "IMMOBILIZER_ARMED";
  last_position: { lat: number; lng: number };
  last_ping_at: string;
}

export interface Installment {
  id: string;
  contract_id: string;
  seq_no: number;
  due_date: string;
  amount_due: number;
  status: "SCHEDULED" | "DUE" | "OVERDUE" | "PAID";
  paid_at: string | null;
}

export interface Payment {
  id: string;
  contract_id: string;
  installment_id: string;
  amount: number;
  method: "cash" | "transfer";
  recorded_at: string;
  recorded_by: string;
}

export interface CollectionsCase {
  id: string;
  contract_id: string;
  client_id: string;
  status: "OPEN" | "SMS_SENT" | "IMMOBILIZER_ARMED" | "CURED" | "CLOSED";
  opened_at: string;
  cured_at: string | null;
}

export interface CollectionAction {
  id: string;
  case_id: string;
  type: "SMS" | "ARM_IMMOBILIZER";
  performed_by: string;
  performed_at: string;
}

export interface Alert {
  id: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  source: "GPS" | "PAYMENT" | "COLLECTIONS";
  entity_type: "contract" | "case" | "vehicle";
  entity_id: string;
  title: string;
  message: string;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}

export interface AuditEntry {
  id: string;
  ts: string;
  actor_id: string;
  actor_role: Role;
  entity_type: "contract" | "case" | "installment" | "payment" | "vehicle" | "alert";
  entity_id: string;
  action: string;
  before: unknown | null;
  after: unknown | null;
}
