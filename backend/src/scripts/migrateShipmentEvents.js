import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shipment_events (
      id TEXT PRIMARY KEY,
      batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
      milestone TEXT NOT NULL CHECK (
        milestone IN (
          'PICKUP_SCHEDULED',
          'PICKED_UP',
          'AT_AGGREGATION',
          'AT_PORT',
          'IN_FLIGHT',
          'CUSTOMS_CLEARANCE',
          'DELIVERED',
          'EXCEPTION'
        )
      ),
      event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      location TEXT,
      notes TEXT,
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipment_events_batch_id ON shipment_events(batch_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_shipment_events_event_time ON shipment_events(event_time DESC)`);

  console.log("Shipment events migration complete.");
}

main()
  .catch((error) => {
    console.error("Failed shipment events migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
