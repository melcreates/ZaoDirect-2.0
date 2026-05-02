import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  const result = await pool.query(`
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY batch_id
          ORDER BY event_time DESC, created_at DESC
        ) AS rn
      FROM shipment_events
    )
    DELETE FROM shipment_events se
    USING ranked r
    WHERE se.id = r.id
      AND r.rn > 1
    RETURNING se.id
  `);

  console.log(`Shipment timeline cleanup complete. Removed ${result.rowCount} duplicate rows.`);
}

main()
  .catch((error) => {
    console.error("Shipment timeline cleanup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
