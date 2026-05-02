import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query("BEGIN");
  try {
    const payoutsFromSettled = await pool.query(
      `UPDATE payouts p
       SET status = 'PAID',
           paid_at = COALESCE(p.paid_at, NOW())
       FROM farmer_purchase_orders fpo
       WHERE p.farmer_purchase_order_id = fpo.id
         AND fpo.status = 'SETTLED'
         AND p.status <> 'PAID'
       RETURNING p.id`
    );

    const settledFromPaid = await pool.query(
      `UPDATE farmer_purchase_orders fpo
       SET status = 'SETTLED',
           updated_at = NOW()
       FROM payouts p
       WHERE p.farmer_purchase_order_id = fpo.id
         AND p.status = 'PAID'
         AND fpo.status NOT IN ('SETTLED', 'REJECTED')
       RETURNING fpo.id`
    );

    await pool.query("COMMIT");
    console.log(
      `Sync complete. payouts->PAID: ${payoutsFromSettled.rowCount}, orders->SETTLED: ${settledFromPaid.rowCount}`
    );
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("Failed settled/paid sync:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

