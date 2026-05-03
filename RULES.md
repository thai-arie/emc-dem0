SYSTEM RULES (STRICT)

1. No automatic DB reset.
2. Payments must be idempotent.
3. Installments must never be mass-modified.
4. Overdue = derived from due_date only.
5. Alerts must be derived from live state, not stored truth.
6. GPS IMMOBILIZER_ARMED = CRITICAL.
7. One vehicle = one ACTIVE contract.
8. Bot is not allowed to write payments (future).
9. No duplicate payments allowed.
10. All financial fields must be computed, not stored.

Violation of any rule = bug.
