export type Role = "ADMIN" | "CEO" | "FINANCIAL_CONTROLLER" | "COLLECTIONS" | "OPS";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active?: boolean;
}

export interface Client {
  id: string;
  full_name: string;
  phone: string;
  address: string;
  national_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export interface Contract {
  id: string;
  client_id: string;
  vehicle_id: string;
  status: "ACTIVE" | "OVERDUE" | "VOID";
  monthly_total: number;
  start_date: string;
  term_months: number;
  vehicle_price: number;
  down_payment: number;
  financed_amount: number;
  credit_balance: number;
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
  status: "ONLINE" | "OVERDUE_WATCH" | "IMMOBILIZER_ARMED";
  last_position: { lat: number; lng: number };
  last_ping_at: string;
  provider: string;
  provider_device_id: string;
  imei: string;
  sim_number: string;
  ignition_status: "ON" | "OFF";
  speed: number;
  last_command: string;
  last_command_status: string;
  last_command_at: string | null;
}

export interface GPSCommand {
  id: string;
  device_id: string;
  command_type: "IMMOBILIZE" | "RELEASE";
  requested_by: string;
  approved_by: string | null;
  status: "REQUESTED" | "APPROVED" | "SENT" | "ACKNOWLEDGED" | "FAILED";
  provider_response: string;
  created_at: string;
  executed_at: string | null;
}

export interface Installment {
  id: string;
  contract_id: string;
  seq_no: number;
  due_date: string;
  amount_due: number;
  status: "SCHEDULED" | "DUE" | "OVERDUE" | "PAID" | "CANCELLED_BY_PREPAYMENT";
  paid_at: string | null;
}

export interface Payment {
  id: string;
  contract_id: string;
  installment_id: string;
  amount: number;
  method: "cash" | "transfer" | "aba" | "wing";
  reference: string;
  note: string;
  allocation_type: "REGULAR" | "PAY_AHEAD" | "PRINCIPAL_PREPAYMENT";
  principal_extra_amount: number;
  applied_amount: number;
  unapplied_amount: number;
  credit_balance_after: number;
  idempotency_key?: string | null;
  recorded_at: string;
  recorded_by: string;
}

export interface CollectionsCase {
  id: string;
  contract_id: string;
  client_id: string;
  status: "OPEN" | "APPROVED" | "CURED" | "CLOSED";
  opened_at: string;
  cured_at: string | null;
  next_action_type: string;
  next_action_date: string;
  assigned_agent_id: string;
}

export interface CollectionAction {
  id: string;
  case_id: string;
  type: "SMS" | "ARM_IMMOBILIZER" | "SEND_REMINDER" | "CALL_ATTEMPT" | "NOTE" | "REQUEST_IMMOBILIZER" | "APPROVE_IMMOBILIZER";
  performed_by: string;
  performed_at: string;
  note: string;
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
  entity_type: "client" | "contract" | "case" | "installment" | "payment" | "vehicle" | "alert";
  entity_id: string;
  action: string;
  before: unknown | null;
  after: unknown | null;
}
