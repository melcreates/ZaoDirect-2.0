import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
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
    )
  `);

  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_order_shipments_order_id ON order_shipments(order_id)"
  );
  await pool.query(
    "CREATE INDEX IF NOT EXISTS idx_order_shipments_tracking_status ON order_shipments(tracking_status)"
  );

  console.log("Migration complete: order_shipments table is ready.");
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
