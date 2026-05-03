CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  national_id TEXT NOT NULL DEFAULT '',
  emergency_contact_name TEXT NOT NULL DEFAULT '',
  emergency_contact_phone TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'CEO', 'FINANCIAL_CONTROLLER', 'COLLECTIONS', 'OPS')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'OVERDUE')),
  monthly_total INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  term_months INTEGER NOT NULL,
  vehicle_price INTEGER NOT NULL DEFAULT 0,
  down_payment INTEGER NOT NULL DEFAULT 0,
  financed_amount INTEGER NOT NULL DEFAULT 0,
  credit_balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  vin TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  plate TEXT NOT NULL,
  contract_id TEXT NOT NULL,
  gps_device_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gps_devices (
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
  ignition_status TEXT NOT NULL DEFAULT 'OFF' CHECK (ignition_status IN ('ON', 'OFF')),
  speed REAL NOT NULL DEFAULT 0,
  last_command TEXT NOT NULL DEFAULT '',
  last_command_status TEXT NOT NULL DEFAULT '',
  last_command_at TEXT
);

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
);

CREATE TABLE IF NOT EXISTS installments (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL,
  seq_no INTEGER NOT NULL,
  due_date TEXT NOT NULL,
  amount_due INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'DUE', 'OVERDUE', 'PAID', 'CANCELLED_BY_PREPAYMENT')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS payments (
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

CREATE TABLE IF NOT EXISTS collections_cases (
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

CREATE TABLE IF NOT EXISTS collection_actions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('SMS', 'ARM_IMMOBILIZER', 'SEND_REMINDER', 'CALL_ATTEMPT', 'NOTE', 'REQUEST_IMMOBILIZER', 'APPROVE_IMMOBILIZER')),
  performed_by TEXT NOT NULL,
  performed_at TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'WARN', 'CRITICAL')),
  source TEXT NOT NULL CHECK (source IN ('GPS', 'PAYMENT', 'COLLECTIONS')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contract', 'case', 'vehicle')),
  entity_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('ADMIN', 'CEO', 'FINANCIAL_CONTROLLER', 'COLLECTIONS', 'OPS')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('client', 'contract', 'case', 'installment', 'payment', 'vehicle', 'alert')),
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before_json TEXT,
  after_json TEXT
);
