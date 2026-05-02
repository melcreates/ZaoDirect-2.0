CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('FARMER', 'BUYER', 'ADMIN')) DEFAULT 'FARMER',
  phone TEXT,
  country TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farmer_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  farm_name TEXT NOT NULL,
  county TEXT NOT NULL,
  has_export_docs BOOLEAN NOT NULL DEFAULT FALSE,
  certifications TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  price_per_unit NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  county TEXT,
  available_from TIMESTAMPTZ,
  photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  export_mode TEXT NOT NULL CHECK (export_mode IN ('CONSYNAIR_MANAGED', 'SELF_MANAGED')) DEFAULT 'CONSYNAIR_MANAGED',
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')) DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_qty NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  offer_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  export_path TEXT NOT NULL CHECK (export_path IN ('CONSYNAIR_MANAGED', 'SELF_MANAGED')),
  service_fee NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'SHIPPED', 'COMPLETED', 'CANCELLED')) DEFAULT 'REQUESTED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_documents (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  doc_url TEXT NOT NULL,
  provided_by TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('DOCUMENT', 'PHOTO')),
  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_shipments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  airline TEXT,
  flight_number TEXT,
  awb_number TEXT,
  departure_airport TEXT,
  arrival_airport TEXT,
  eta TIMESTAMPTZ,
  tracking_status TEXT NOT NULL CHECK (tracking_status IN ('PENDING', 'BOOKED', 'IN_AIR', 'LANDED', 'DELIVERED', 'DELAYED')) DEFAULT 'PENDING',
  tracking_reference TEXT,
  tracking_last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS international_orders (
  id TEXT PRIMARY KEY,
  buyer_name TEXT NOT NULL,
  buyer_company TEXT,
  buyer_country TEXT,
  buyer_email TEXT,
  crop_type TEXT NOT NULL,
  target_grade TEXT,
  required_quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  target_price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  expected_ship_date TIMESTAMPTZ,
  incoterm TEXT,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('OPEN', 'MATCHING', 'PROCUREMENT', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED')) DEFAULT 'OPEN',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farmer_purchase_orders (
  id TEXT PRIMARY KEY,
  international_order_id TEXT NOT NULL REFERENCES international_orders(id) ON DELETE CASCADE,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id TEXT REFERENCES listings(id) ON DELETE SET NULL,
  crop_type TEXT NOT NULL,
  expected_grade TEXT,
  quantity NUMERIC NOT NULL,
  actual_picked_quantity NUMERIC,
  unit TEXT NOT NULL,
  farm_gate_price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  pickup_location TEXT,
  pickup_date TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'CONFIRMED', 'PICKED_UP', 'REJECTED', 'SETTLED')) DEFAULT 'DRAFT',
  notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  international_order_id TEXT NOT NULL REFERENCES international_orders(id) ON DELETE CASCADE,
  batch_code TEXT NOT NULL UNIQUE,
  crop_type TEXT NOT NULL,
  target_grade TEXT,
  destination_country TEXT,
  total_quantity NUMERIC,
  unit TEXT NOT NULL DEFAULT 'kg',
  status TEXT NOT NULL CHECK (status IN ('CREATED', 'COLLECTING', 'QA_PASSED', 'DISPATCHED', 'SHIPPED', 'DELIVERED')) DEFAULT 'CREATED',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batch_items (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  farmer_purchase_order_id TEXT NOT NULL REFERENCES farmer_purchase_orders(id) ON DELETE CASCADE,
  accepted_quantity NUMERIC NOT NULL,
  rejected_quantity NUMERIC NOT NULL DEFAULT 0,
  grade_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quality_checks (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('HARVEST', 'AGGREGATION', 'PRE_EXPORT', 'DISPATCH')),
  moisture_level NUMERIC,
  pesticide_passed BOOLEAN,
  size_grade TEXT,
  notes TEXT,
  photo_url TEXT,
  inspector_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  farmer_purchase_order_id TEXT NOT NULL REFERENCES farmer_purchase_orders(id) ON DELETE CASCADE,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  payout_type TEXT NOT NULL CHECK (payout_type IN ('ADVANCE', 'FINAL', 'ADJUSTMENT')),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'PAID', 'FAILED')) DEFAULT 'PENDING',
  scheduled_for TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cost_entries (
  id TEXT PRIMARY KEY,
  international_order_id TEXT NOT NULL REFERENCES international_orders(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE SET NULL,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('PICKUP', 'AGGREGATION', 'COLD_STORAGE', 'EXPORT_DOCS', 'FREIGHT', 'FINANCE', 'OTHER')),
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  vendor_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wordpress_sync_logs (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  wp_post_id TEXT,
  sync_status TEXT NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_listings_farmer_id ON listings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_farmer_id ON orders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_tracking_status ON order_shipments(tracking_status);
CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON user_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assets_type ON user_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_int_orders_status ON international_orders(status);
CREATE INDEX IF NOT EXISTS idx_fp_orders_farmer_id ON farmer_purchase_orders(farmer_id);
CREATE INDEX IF NOT EXISTS idx_fp_orders_int_order_id ON farmer_purchase_orders(international_order_id);
CREATE INDEX IF NOT EXISTS idx_batches_int_order_id ON batches(international_order_id);
CREATE INDEX IF NOT EXISTS idx_quality_checks_batch_id ON quality_checks(batch_id);
CREATE INDEX IF NOT EXISTS idx_payouts_farmer_id ON payouts(farmer_id);
CREATE INDEX IF NOT EXISTS idx_cost_entries_int_order_id ON cost_entries(international_order_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);
