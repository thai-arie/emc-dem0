#!/bin/bash
set -e

echo "Resetting demo data..."

sqlite3 server/emc.sqlite < scripts/demo-reset.sql

python3 << 'PY'
import sqlite3

db = sqlite3.connect("server/emc.sqlite")
cur = db.cursor()

cur.execute("PRAGMA table_info(gps_devices)")
cols = {row[1] for row in cur.fetchall()}

updates = []

if "status" in cols:
    updates.append("status = 'ACTIVE'")

if "immobilizer_state" in cols:
    updates.append("immobilizer_state = 'DISARMED'")

if "gps_status" in cols:
    updates.append("gps_status = 'ACTIVE'")

if "last_event" in cols:
    updates.append("last_event = ''")

if updates:
    sql = f"""
    UPDATE gps_devices
    SET {', '.join(updates)}
    WHERE id LIKE 'GPS-TST-%'
       OR device_id LIKE 'GPS-TST-%'
    """
    cur.execute(sql)

db.commit()
db.close()

print("GPS demo devices reset to active/unlocked state.")
PY

sqlite3 server/emc.sqlite "PRAGMA integrity_check;"

echo "Done."
