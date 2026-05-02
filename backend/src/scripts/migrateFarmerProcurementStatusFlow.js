import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    ALTER TABLE farmer_purchase_orders
    DROP CONSTRAINT IF EXISTS farmer_purchase_orders_status_check
  `);

  await pool.query(`
    ALTER TABLE farmer_purchase_orders
    ADD CONSTRAINT farmer_purchase_orders_status_check
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'READY_FOR_PICKUP', 'PICKED_UP', 'REJECTED', 'SETTLED'))
  `);

  console.log("Farmer procurement status flow migration complete.");
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

