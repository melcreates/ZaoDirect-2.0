import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dispute_cases (
      id TEXT PRIMARY KEY,
      case_type TEXT NOT NULL CHECK (case_type IN ('PICKUP_SHORTFALL', 'QUALITY_REJECTION', 'SETTLEMENT_DELAY', 'SHIPMENT_ISSUE', 'OTHER')),
      title TEXT NOT NULL,
      description TEXT NULL,
      severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) DEFAULT 'MEDIUM',
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED')) DEFAULT 'OPEN',
      international_order_id TEXT NULL REFERENCES international_orders(id) ON DELETE SET NULL,
      farmer_purchase_order_id TEXT NULL REFERENCES farmer_purchase_orders(id) ON DELETE SET NULL,
      batch_id TEXT NULL REFERENCES batches(id) ON DELETE SET NULL,
      owner_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      resolution_notes TEXT NULL,
      due_at TIMESTAMPTZ NULL,
      resolved_at TIMESTAMPTZ NULL,
      created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispute_cases_status ON dispute_cases(status, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispute_cases_owner ON dispute_cases(owner_user_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_dispute_cases_due_at ON dispute_cases(due_at)`);

  console.log("Dispute cases migration complete.");
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
