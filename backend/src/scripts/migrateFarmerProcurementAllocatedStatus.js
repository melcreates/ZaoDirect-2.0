import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query("BEGIN");
  try {
    await pool.query(`
      ALTER TABLE farmer_purchase_orders
      DROP CONSTRAINT IF EXISTS farmer_purchase_orders_status_check
    `);

    await pool.query(`
      ALTER TABLE farmer_purchase_orders
      ADD CONSTRAINT farmer_purchase_orders_status_check
      CHECK (status IN ('OPEN', 'CONFIRMED', 'ALLOCATED', 'READY_FOR_PICKUP', 'PICKED_UP', 'REJECTED', 'SETTLED'))
    `);

    await pool.query("COMMIT");
    console.log("Farmer procurement allocated-status migration complete.");
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

