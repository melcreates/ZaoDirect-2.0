import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query("BEGIN");
  try {
    await pool.query(`
      ALTER TABLE international_orders
      DROP CONSTRAINT IF EXISTS international_orders_status_check
    `);

    await pool.query(`
      ALTER TABLE international_orders
      ADD CONSTRAINT international_orders_status_check
      CHECK (status IN (
        'OPEN',
        'MATCHING',
        'PROCUREMENT',
        'READY_TO_SHIP',
        'PARTIALLY_SHIPPED',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
        'CANCELLED'
      ))
    `);

    const result = await pool.query(`
      WITH agg AS (
        SELECT
          io.id,
          io.status AS previous_status,
          COALESCE(io.required_quantity, 0) AS required_quantity,
          COALESCE(SUM(CASE WHEN b.status IN ('SHIPPED','DELIVERED') THEN COALESCE(b.total_quantity, 0) ELSE 0 END), 0) AS shipped_quantity,
          COALESCE(SUM(CASE WHEN b.status = 'DELIVERED' THEN COALESCE(b.total_quantity, 0) ELSE 0 END), 0) AS delivered_quantity,
          COUNT(b.id)::int AS batch_count
        FROM international_orders io
        LEFT JOIN batches b ON b.international_order_id = io.id
        GROUP BY io.id, io.status, io.required_quantity
      ),
      updated AS (
        UPDATE international_orders io
        SET status = CASE
          WHEN io.status = 'CANCELLED' THEN 'CANCELLED'
          WHEN agg.required_quantity > 0 AND agg.delivered_quantity >= agg.required_quantity THEN 'DELIVERED'
          WHEN agg.required_quantity > 0 AND agg.shipped_quantity >= agg.required_quantity THEN 'SHIPPED'
          WHEN agg.shipped_quantity > 0 THEN 'PARTIALLY_SHIPPED'
          WHEN agg.batch_count > 0 THEN 'PROCUREMENT'
          ELSE 'OPEN'
        END,
        updated_at = NOW()
        FROM agg
        WHERE io.id = agg.id
          AND io.status IS DISTINCT FROM CASE
            WHEN io.status = 'CANCELLED' THEN 'CANCELLED'
            WHEN agg.required_quantity > 0 AND agg.delivered_quantity >= agg.required_quantity THEN 'DELIVERED'
            WHEN agg.required_quantity > 0 AND agg.shipped_quantity >= agg.required_quantity THEN 'SHIPPED'
            WHEN agg.shipped_quantity > 0 THEN 'PARTIALLY_SHIPPED'
            WHEN agg.batch_count > 0 THEN 'PROCUREMENT'
            ELSE 'OPEN'
          END
        RETURNING io.id, agg.previous_status, io.status
      )
      SELECT * FROM updated
    `);

    await pool.query(`
      ALTER TABLE international_orders
      DROP CONSTRAINT IF EXISTS international_orders_status_check
    `);

    await pool.query(`
      ALTER TABLE international_orders
      ADD CONSTRAINT international_orders_status_check
      CHECK (status IN (
        'OPEN',
        'PROCUREMENT',
        'PARTIALLY_SHIPPED',
        'SHIPPED',
        'DELIVERED',
        'CANCELLED'
      ))
    `);

    await pool.query("COMMIT");
    console.log(
      `International order status migration complete. Updated ${result.rowCount} record(s).`
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("International order status migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
