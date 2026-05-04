BEGIN TRANSACTION;

-- =========================
-- DEMO SEED: CLIENTS
-- =========================
INSERT OR REPLACE INTO clients (id, full_name, phone, address, national_id, emergency_contact_name, emergency_contact_phone) VALUES
('CL-TST-001', 'Demo Client 001', '+85510000001', 'Phnom Penh', 'NID-TST-001', 'Emergency 001', '+85590000001'),
('CL-TST-002', 'Demo Client 002', '+85510000002', 'Phnom Penh', 'NID-TST-002', 'Emergency 002', '+85590000002'),
('CL-TST-003', 'Demo Client 003', '+85510000003', 'Phnom Penh', 'NID-TST-003', 'Emergency 003', '+85590000003'),
('CL-TST-004', 'Demo Client 004', '+85510000004', 'Phnom Penh', 'NID-TST-004', 'Emergency 004', '+85590000004'),
('CL-TST-005', 'Demo Client 005', '+85510000005', 'Phnom Penh', 'NID-TST-005', 'Emergency 005', '+85590000005');

-- =========================
-- DEMO SEED: CONTRACTS
-- =========================
INSERT OR REPLACE INTO contracts (
  id, client_id, vehicle_id, status, monthly_total, start_date, term_months,
  vehicle_price, down_payment, financed_amount, credit_balance
) VALUES
('KT-TST-001', 'CL-TST-001', 'VH-TST-001', 'OVERDUE', 24000, '2026-01-01', 36, 720000, 120000, 600000, 565000),
('KT-TST-002', 'CL-TST-002', 'VH-TST-002', 'OVERDUE', 28500, '2026-01-01', 36, 850000, 150000, 700000, 655000),
('KT-TST-003', 'CL-TST-003', 'VH-TST-003', 'OVERDUE', 33000, '2026-01-01', 36, 980000, 180000, 800000, 742000),
('KT-TST-004', 'CL-TST-004', 'VH-TST-004', 'OVERDUE', 39500, '2026-01-01', 36, 1120000, 220000, 900000, 834000),
('KT-TST-005', 'CL-TST-005', 'VH-TST-005', 'OVERDUE', 45500, '2026-01-01', 36, 1250000, 250000, 1000000, 925000);

-- =========================
-- DEMO SEED: VEHICLES
-- =========================
INSERT OR REPLACE INTO vehicles (id, vin, brand, model, plate, contract_id, gps_device_id) VALUES
('VH-TST-001', 'VIN-TST-001', 'PAIDI', 'EV Mini Truck', 'PP-TST-001', 'KT-TST-001', 'GPS-TST-001'),
('VH-TST-002', 'VIN-TST-002', 'PAIDI', 'EV Mini Truck', 'PP-TST-002', 'KT-TST-002', 'GPS-TST-002'),
('VH-TST-003', 'VIN-TST-003', 'PAIDI', 'EV Mini Truck', 'PP-TST-003', 'KT-TST-003', 'GPS-TST-003'),
('VH-TST-004', 'VIN-TST-004', 'PAIDI', 'EV Mini Truck', 'PP-TST-004', 'KT-TST-004', 'GPS-TST-004'),
('VH-TST-005', 'VIN-TST-005', 'PAIDI', 'EV Mini Truck', 'PP-TST-005', 'KT-TST-005', 'GPS-TST-005');

-- =========================
-- DEMO SEED: GPS DEVICES
-- Phnom Penh coordinates, slightly spread out
-- =========================
INSERT OR REPLACE INTO gps_devices (
  id, vehicle_id, status, lat, lng, last_ping_at, provider, provider_device_id,
  imei, sim_number, ignition_status, speed, last_command, last_command_status, last_command_at
) VALUES
('GPS-TST-001', 'VH-TST-001', 'OVERDUE_WATCH', 11.5455, 104.8922, datetime('now'), 'mock', 'GPS-TST-001', 'IMEI-TST-001', 'SIM-TST-001', 'OFF', 0, '', '', NULL),
('GPS-TST-002', 'VH-TST-002', 'OVERDUE_WATCH', 11.5798, 104.9175, datetime('now'), 'mock', 'GPS-TST-002', 'IMEI-TST-002', 'SIM-TST-002', 'OFF', 0, '', '', NULL),
('GPS-TST-003', 'VH-TST-003', 'OVERDUE_WATCH', 11.5362, 104.9488, datetime('now'), 'mock', 'GPS-TST-003', 'IMEI-TST-003', 'SIM-TST-003', 'OFF', 0, '', '', NULL),
('GPS-TST-004', 'VH-TST-004', 'OVERDUE_WATCH', 11.5914, 104.9631, datetime('now'), 'mock', 'GPS-TST-004', 'IMEI-TST-004', 'SIM-TST-004', 'OFF', 0, '', '', NULL),
('GPS-TST-005', 'VH-TST-005', 'OVERDUE_WATCH', 11.5224, 104.9104, datetime('now'), 'mock', 'GPS-TST-005', 'IMEI-TST-005', 'SIM-TST-005', 'OFF', 0, '', '', NULL);

-- =========================
-- DEMO RESET: COLLECTION CASES
-- =========================
INSERT OR REPLACE INTO collections_cases (
  id, contract_id, client_id, status, opened_at, cured_at,
  next_action_type, next_action_date, assigned_agent_id
) VALUES
('COL-TST-001', 'KT-TST-001', 'CL-TST-001', 'OPEN', datetime('now', '-4 days'), NULL, 'SEND_REMINDER', '', ''),
('COL-TST-002', 'KT-TST-002', 'CL-TST-002', 'APPROVED', datetime('now', '-5 days'), NULL, 'APPROVE_IMMOBILIZER', '', ''),
('COL-TST-003', 'KT-TST-003', 'CL-TST-003', 'OPEN', datetime('now', '-6 days'), NULL, 'SEND_REMINDER', '', ''),
('COL-TST-004', 'KT-TST-004', 'CL-TST-004', 'OPEN', datetime('now', '-7 days'), NULL, 'SEND_REMINDER', '', ''),
('COL-TST-005', 'KT-TST-005', 'CL-TST-005', 'OPEN', datetime('now', '-8 days'), NULL, 'SEND_REMINDER', '', '');

-- =========================
-- DEMO RESET: INSTALLMENTS
-- =========================
DELETE FROM installments WHERE contract_id LIKE 'KT-TST-%';

INSERT INTO installments (id, contract_id, seq_no, due_date, amount_due, status, paid_at) VALUES
('INS-TST-001', 'KT-TST-001', 1, date('now', '-8 days'), 28500, 'OVERDUE', NULL),
('INS-TST-002', 'KT-TST-002', 1, date('now', '-9 days'), 33000, 'OVERDUE', NULL),
('INS-TST-003', 'KT-TST-003', 1, date('now', '-10 days'), 39500, 'OVERDUE', NULL),
('INS-TST-004', 'KT-TST-004', 1, date('now', '-11 days'), 45500, 'OVERDUE', NULL),
('INS-TST-005', 'KT-TST-005', 1, date('now', '-12 days'), 52000, 'OVERDUE', NULL);

-- =========================
-- DEMO RESET: COMMANDS / ALERTS
-- =========================
DELETE FROM gps_commands WHERE device_id LIKE 'GPS-TST-%';
DELETE FROM alerts WHERE entity_id LIKE 'COL-TST-%' OR entity_id LIKE 'KT-TST-%' OR entity_id LIKE 'VH-TST-%';

-- CASE 3: SENT / pending demo
INSERT INTO gps_commands (
  id, device_id, command_type, requested_by, approved_by,
  status, provider_response, created_at, executed_at
) VALUES (
  'CMD-TST-003',
  'GPS-TST-003',
  'IMMOBILIZE',
  'system',
  'admin',
  'SENT',
  '',
  datetime('now', '-10 seconds'),
  datetime('now', '-10 seconds')
);

-- CASE 4: FAILED / retry demo
INSERT INTO gps_commands (
  id, device_id, command_type, requested_by, approved_by,
  status, provider_response, created_at, executed_at
) VALUES (
  'CMD-TST-004',
  'GPS-TST-004',
  'IMMOBILIZE',
  'system',
  'admin',
  'FAILED',
  'Mock GPS provider timeout',
  datetime('now', '-60 seconds'),
  datetime('now', '-60 seconds')
);

COMMIT;
