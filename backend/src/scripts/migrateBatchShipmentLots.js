import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query("BEGIN");
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS batch_shipment_lots (
        id TEXT PRIMARY KEY,
        batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
        lot_code TEXT NOT NULL,
        quantity NUMERIC NOT NULL CHECK (quantity > 0),
        unit TEXT NOT NULL DEFAULT 'kg',
        status TEXT NOT NULL DEFAULT 'CREATED'
          CHECK (status IN ('CREATED','DISPATCHED','SHIPPED','DELIVERED')),
        flight_number TEXT,
        awb_number TEXT,
        eta TIMESTAMPTZ,
        shipped_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        notes TEXT,
        created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(batch_id, lot_code)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_batch_shipment_lots_batch_id
      ON batch_shipment_lots(batch_id);
    `);

    await pool.query("COMMIT");
    console.log("Batch shipment lots migration complete.");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

