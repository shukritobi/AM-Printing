PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  base_sen INTEGER NOT NULL CHECK(base_sen>=0),
  unit_sen INTEGER NOT NULL CHECK(unit_sen>=0),
  minimum_sen INTEGER NOT NULL CHECK(minimum_sen>=0),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO products (code,name,base_sen,unit_sen,minimum_sen) VALUES
 ('sampul-raya','Sampul Duit Raya',400,42,400),
 ('stickers','Sticker & Label',690,18,690),
 ('photo-4r','4R Photo Printing',500,115,500),
 ('polaroid','Polaroid & Mini Prints',800,85,800),
 ('cards','Custom Cards',1000,32,1000),
 ('bulk','Bulk / Corporate Order',2500,25,2500);
CREATE TABLE IF NOT EXISTS affiliates (
 id TEXT PRIMARY KEY,
 code TEXT NOT NULL UNIQUE COLLATE NOCASE,
 name TEXT NOT NULL,
 email TEXT,
 phone TEXT,
 commission_bps INTEGER NOT NULL DEFAULT 0 CHECK(commission_bps BETWEEN 0 AND 10000),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY,
 public_code TEXT NOT NULL UNIQUE,
 access_token_hash TEXT NOT NULL,
 customer_name TEXT NOT NULL,
 phone TEXT NOT NULL,
 email TEXT,
 due_date TEXT,
 product_code TEXT NOT NULL REFERENCES products(code),
 quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 size TEXT NOT NULL,
 material TEXT NOT NULL,
 artwork_type TEXT NOT NULL,
 urgency TEXT NOT NULL,
 notes TEXT,
 estimate_sen INTEGER NOT NULL CHECK(estimate_sen >= 0),
 final_sen INTEGER,
 production_status TEXT NOT NULL DEFAULT 'quote_requested',
 payment_status TEXT NOT NULL DEFAULT 'unpaid',
 affiliate_id TEXT REFERENCES affiliates(id),
 affiliate_code_snapshot TEXT,
 affiliate_bps_snapshot INTEGER,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_affiliate ON orders(affiliate_id);
CREATE TABLE IF NOT EXISTS order_artworks (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 r2_key TEXT NOT NULL,
 filename TEXT NOT NULL,
 content_type TEXT NOT NULL,
 bytes INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS waitlist (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 phone TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS payment_events (
 id TEXT PRIMARY KEY,
 order_id TEXT REFERENCES orders(id),
 provider TEXT NOT NULL,
 provider_event_id TEXT NOT NULL UNIQUE,
 payload_hash TEXT NOT NULL,
 status TEXT NOT NULL,
 received_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS commission_ledger (
 id TEXT PRIMARY KEY,
 order_id TEXT NOT NULL REFERENCES orders(id),
 beneficiary_type TEXT NOT NULL CHECK(beneficiary_type IN ('developer','affiliate')),
 affiliate_id TEXT REFERENCES affiliates(id),
 amount_sen INTEGER NOT NULL,
 entry_type TEXT NOT NULL CHECK(entry_type IN ('accrual','reversal','payout')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 UNIQUE(order_id,beneficiary_type,entry_type)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY,
 action TEXT NOT NULL,
 entity_type TEXT NOT NULL,
 entity_id TEXT NOT NULL,
 metadata TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
