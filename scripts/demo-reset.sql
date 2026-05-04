
-- === RESET ONLY TEST CASES ===

-- 1. Reset collections cases
UPDATE collections_cases
SET
  status = 'OPEN',
  next_action_type = 'SEND_REMINDER',
  next_action_date = '',
  cured_at = NULL
WHERE id LIKE 'COL-TST-%';

-- 2. Reset installments (force overdue for demo)
UPDATE installments
SET
  status = 'OVERDUE',
  paid_at = NULL
WHERE contract_id LIKE 'KT-TST-%';

-- 3. Remove GPS commands for test devices
DELETE FROM gps_commands
WHERE device_id LIKE 'GPS-TST-%';

-- 4. Remove alerts for test cases
DELETE FROM alerts
WHERE entity_id LIKE 'COL-TST-%';

