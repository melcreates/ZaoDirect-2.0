import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Orders created during smoke tests.
    const targetOrders = await client.query(
      `SELECT id
       FROM international_orders
       WHERE buyer_name IN ('Smoke Buyer', 'Lot Guard Buyer', 'Missing Price Buyer', 'No Price')
          OR buyer_company = 'Smoke Imports BV'
          OR crop_type IN ('Hass Avocado', 'Mango')
            AND created_at >= NOW() - INTERVAL '7 days'`
    );
    const orderIds = targetOrders.rows.map((r) => r.id);

    // Smoke farmers created during tests.
    const targetFarmers = await client.query(
      `SELECT id
       FROM users
       WHERE email LIKE 'smoke.farmer.%@zaodirect.com'
          OR email LIKE 'lot.guard.%@zaodirect.com'`
    );
    const farmerIds = targetFarmers.rows.map((r) => r.id);

    if (orderIds.length > 0) {
      await client.query(
        `DELETE FROM shipment_events
         WHERE batch_id IN (SELECT id FROM batches WHERE international_order_id = ANY($1::text[]))`,
        [orderIds]
      );
      await client.query(
        `DELETE FROM quality_checks
         WHERE batch_id IN (SELECT id FROM batches WHERE international_order_id = ANY($1::text[]))`,
        [orderIds]
      );
      await client.query(
        `DELETE FROM batch_shipment_lots
         WHERE batch_id IN (SELECT id FROM batches WHERE international_order_id = ANY($1::text[]))`,
        [orderIds]
      );
      await client.query(
        `DELETE FROM batch_items
         WHERE batch_id IN (SELECT id FROM batches WHERE international_order_id = ANY($1::text[]))
            OR farmer_purchase_order_id IN (SELECT id FROM farmer_purchase_orders WHERE international_order_id = ANY($1::text[]))`,
        [orderIds]
      );
      await client.query("DELETE FROM batches WHERE international_order_id = ANY($1::text[])", [orderIds]);
      await client.query("DELETE FROM payouts WHERE farmer_purchase_order_id IN (SELECT id FROM farmer_purchase_orders WHERE international_order_id = ANY($1::text[]))", [orderIds]);
      await client.query("DELETE FROM cost_entries WHERE international_order_id = ANY($1::text[])", [orderIds]);
      await client.query("DELETE FROM dispute_cases WHERE international_order_id = ANY($1::text[])", [orderIds]);
      await client.query("DELETE FROM farmer_purchase_orders WHERE international_order_id = ANY($1::text[])", [orderIds]);
      await client.query("DELETE FROM international_orders WHERE id = ANY($1::text[])", [orderIds]);
    }

    if (farmerIds.length > 0) {
      await client.query("DELETE FROM user_assets WHERE user_id = ANY($1::text[])", [farmerIds]);
      await client.query("DELETE FROM farmer_profiles WHERE user_id = ANY($1::text[])", [farmerIds]);
      await client.query("DELETE FROM listings WHERE farmer_id = ANY($1::text[])", [farmerIds]);
      await client.query("DELETE FROM users WHERE id = ANY($1::text[])", [farmerIds]);
    }

    await client.query("COMMIT");
    console.log(
      `Smoke cleanup complete. Removed ${orderIds.length} international orders and ${farmerIds.length} smoke farmers.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("Smoke cleanup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
