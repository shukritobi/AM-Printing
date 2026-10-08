#!/usr/bin/env python3
"""Validate the Phase 1 D1 migration with SQLite before Cloudflare deployment."""
from pathlib import Path
import sqlite3
import re

root = Path(__file__).resolve().parents[1]
sql = (root / "migrations" / "0001_initial.sql").read_text()
db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")
db.executescript(sql)
db.executescript(sql)  # Must be safe to run twice in isolated smoke check.
products = db.execute("SELECT code,base_sen,unit_sen,minimum_sen FROM products ORDER BY code").fetchall()
assert len(products) == 6, products
assert all(all(isinstance(v, int) and v >= 0 for v in row[1:]) for row in products)
for table in ("orders", "affiliates", "order_artworks", "commission_ledger", "payment_events", "audit_log"):
    assert db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
assert not db.execute("PRAGMA foreign_key_check").fetchall()
print("PASS: D1 schema parses, six products seeded, all core tables exist, and foreign keys are valid.")
