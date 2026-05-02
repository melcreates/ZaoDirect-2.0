import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function ensureUser({ name, email, role, phone, country }) {
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (existing.rowCount > 0) return existing.rows[0].id;

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash("demo1234", 10);
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role, phone, country, is_active, verification_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,'VERIFIED')`,
    [id, name, email, passwordHash, role, phone ?? null, country ?? null]
  );
  return id;
}

async function ensureFarmerProfile(userId, farmName, county) {
  const existing = await pool.query("SELECT id FROM farmer_profiles WHERE user_id = $1", [userId]);
  if (existing.rowCount > 0) return existing.rows[0].id;
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO farmer_profiles (id, user_id, farm_name, county, has_export_docs, certifications)
     VALUES ($1,$2,$3,$4,FALSE,'GlobalG.A.P (pending full audit)')`,
    [id, userId, farmName, county]
  );
  return id;
}

async function main() {
  const alreadySeeded = await pool.query(
    "SELECT id FROM users WHERE email IN ('demo.farmer1@zaodirect.com','demo.farmer2@zaodirect.com') LIMIT 1"
  );
  if (alreadySeeded.rowCount > 0) {
    console.log("Demo data already exists. Skipping.");
    return;
  }

  const adminRow = await pool.query("SELECT id FROM users WHERE role = 'ADMIN' ORDER BY created_at ASC LIMIT 1");
  if (adminRow.rowCount === 0) throw new Error("Admin user missing. Run db:setup or db:seed first.");
  const adminId = adminRow.rows[0].id;

  const farmerDefs = [
    { name: "Jane Wanjiku", email: "demo.farmer1@zaodirect.com", farm: "Nyeri Avocado Co-op", county: "Nyeri" },
    { name: "Peter Kiptoo", email: "demo.farmer2@zaodirect.com", farm: "Eldoret Greens", county: "Uasin Gishu" },
    { name: "Mercy Atieno", email: "demo.farmer3@zaodirect.com", farm: "Kisumu Fresh Farms", county: "Kisumu" },
    { name: "Samuel Mwangi", email: "demo.farmer4@zaodirect.com", farm: "Murang'a Export Produce", county: "Murang'a" },
    { name: "Asha Hassan", email: "demo.farmer5@zaodirect.com", farm: "Taita Highlands Produce", county: "Taita Taveta" },
  ];

  const farmerIds = [];
  for (const f of farmerDefs) {
    const id = await ensureUser({
      name: f.name,
      email: f.email,
      role: "FARMER",
      phone: "+254700000000",
      country: "Kenya",
    });
    await ensureFarmerProfile(id, f.farm, f.county);
    farmerIds.push({ ...f, id });
  }

  const listings = [];
  const listingDefs = [
    ["Hass Avocado", "Fruits", 4800, "kg", 1.8, "USD", "Murang'a"],
    ["French Beans", "Vegetables", 2200, "kg", 1.2, "USD", "Uasin Gishu"],
    ["Mango (Apple)", "Fruits", 3600, "kg", 1.1, "USD", "Kisumu"],
    ["Sugar Snap Peas", "Vegetables", 1400, "kg", 2.6, "USD", "Nyeri"],
    ["Passion Fruit", "Fruits", 1800, "kg", 1.9, "USD", "Taita Taveta"],
    ["Chili (Bird Eye)", "Spices", 900, "kg", 3.2, "USD", "Kisumu"],
    ["Baby Corn", "Vegetables", 1300, "kg", 1.7, "USD", "Murang'a"],
    ["Herbs Mix", "Herbs", 700, "kg", 2.1, "USD", "Nyeri"],
  ];

  for (let i = 0; i < listingDefs.length; i += 1) {
    const farmer = farmerIds[i % farmerIds.length];
    const [title, category, quantity, unit, price, currency, county] = listingDefs[i];
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO listings
       (id, farmer_id, title, category, quantity, unit, price_per_unit, currency, county, available_from, photo_urls, export_mode, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),'[]'::jsonb,'CONSYNAIR_MANAGED','PUBLISHED')`,
      [id, farmer.id, title, category, quantity, unit, price, currency, county]
    );
    listings.push({ id, farmerId: farmer.id, title, unit, price });
  }

  const intlOrders = [];
  const intlDefs = [
    ["FreshBridge BV", "Netherlands", "Hass Avocado", 12000, "kg", 2.5, "OPEN"],
    ["GreenMart GmbH", "Germany", "French Beans", 8000, "kg", 2.1, "PROCUREMENT"],
    ["Cedar Foods LLC", "UAE", "Mango (Apple)", 10000, "kg", 1.9, "READY_TO_SHIP"],
    ["Nordic Fresh AB", "Sweden", "Sugar Snap Peas", 3500, "kg", 3.0, "SHIPPED"],
    ["Mediterraneo SRL", "Italy", "Passion Fruit", 4000, "kg", 2.4, "MATCHING"],
    ["Al Noor Traders", "Qatar", "Chili (Bird Eye)", 1500, "kg", 3.8, "OPEN"],
  ];

  for (const [buyerName, buyerCountry, cropType, qty, unit, targetPrice, status] of intlDefs) {
    const id = crypto.randomUUID();
    await pool.query(
      `INSERT INTO international_orders
       (id, buyer_name, buyer_country, crop_type, required_quantity, unit, target_price, currency, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'USD',$8,$9)`,
      [id, buyerName, buyerCountry, cropType, qty, unit, targetPrice, status, adminId]
    );
    intlOrders.push({ id, buyerName, cropType, unit });
  }

  const fpos = [];
  for (let i = 0; i < 8; i += 1) {
    const srcListing = listings[i % listings.length];
    const intOrder = intlOrders[i % intlOrders.length];
    const id = crypto.randomUUID();
    const qty = 500 + i * 100;
    const picked = i % 3 === 0 ? qty - 40 : qty;
    const status = i % 4 === 0 ? "SETTLED" : i % 2 === 0 ? "PICKED_UP" : "CONFIRMED";
    await pool.query(
      `INSERT INTO farmer_purchase_orders
       (id, international_order_id, farmer_id, listing_id, crop_type, quantity, actual_picked_quantity, unit, farm_gate_price, currency, pickup_location, pickup_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'KES',$10,NOW() - ($11 || ' days')::interval,$12,$13,$14)`,
      [
        id,
        intOrder.id,
        srcListing.farmerId,
        srcListing.id,
        intOrder.cropType,
        qty,
        picked,
        intOrder.unit,
        110 + i * 3,
        "Collection Point A",
        String(i),
        status,
        "DEMO_SEED",
        adminId,
      ]
    );
    fpos.push({ id, picked, cropType: intOrder.cropType, intlOrderId: intOrder.id });
  }

  const batches = [];
  const batchStatuses = ["COLLECTING", "QA_PASSED", "DISPATCHED", "SHIPPED"];
  for (let i = 0; i < 4; i += 1) {
    const id = crypto.randomUUID();
    const intOrder = intlOrders[i];
    await pool.query(
      `INSERT INTO batches
       (id, international_order_id, batch_code, crop_type, destination_country, total_quantity, unit, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,'kg',$7,$8)`,
      [id, intOrder.id, `ZAO-DEMO-2026-00${i + 1}`, intOrder.cropType, "Netherlands", 2200 + i * 350, batchStatuses[i], adminId]
    );
    batches.push({ id, status: batchStatuses[i], crop: intOrder.cropType });
  }

  for (let i = 0; i < 6; i += 1) {
    const batch = batches[i % batches.length];
    const fpo = fpos[i];
    await pool.query(
      `INSERT INTO batch_items
       (id, batch_id, farmer_purchase_order_id, accepted_quantity, rejected_quantity, grade_result)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [crypto.randomUUID(), batch.id, fpo.id, Math.max(0, fpo.picked - 20), 20, "A"]
    );
  }

  for (const batch of batches) {
    await pool.query(
      `INSERT INTO quality_checks
       (id, batch_id, stage, moisture_level, pesticide_passed, size_grade, notes, inspector_user_id)
       VALUES ($1,$2,'AGGREGATION',11.2,TRUE,'A','DEMO_SEED quality pass',$3)`,
      [crypto.randomUUID(), batch.id, adminId]
    );
  }

  const milestoneMap = [
    "PICKED_UP",
    "AT_AGGREGATION",
    "AT_PORT",
    "IN_FLIGHT",
    "DELIVERED",
  ];
  for (let i = 0; i < batches.length; i += 1) {
    await pool.query(
      `INSERT INTO shipment_events
       (id, batch_id, milestone, event_time, location, notes, created_by)
       VALUES ($1,$2,$3,NOW() - ($4 || ' days')::interval,$5,'DEMO_SEED',$6)`,
      [crypto.randomUUID(), batches[i].id, milestoneMap[i + 1] || "AT_AGGREGATION", String(3 - i), "Nairobi", adminId]
    );
  }

  for (let i = 0; i < 5; i += 1) {
    const fpo = fpos[i];
    await pool.query(
      `INSERT INTO payouts
       (id, farmer_purchase_order_id, farmer_id, amount, currency, payout_type, status, scheduled_for, notes)
       VALUES ($1,$2,(SELECT farmer_id FROM farmer_purchase_orders WHERE id=$2),$3,'KES',$4,$5,NOW() + ($6 || ' days')::interval,'DEMO_SEED')`,
      [
        crypto.randomUUID(),
        fpo.id,
        65000 + i * 4000,
        i % 2 === 0 ? "ADVANCE" : "FINAL",
        i % 3 === 0 ? "PAID" : "PENDING",
        String(i + 1),
      ]
    );
  }

  for (let i = 0; i < 6; i += 1) {
    await pool.query(
      `INSERT INTO cost_entries
       (id, international_order_id, cost_type, amount, currency, vendor_name, notes)
       VALUES ($1,$2,$3,$4,'USD',$5,'DEMO_SEED')`,
      [
        crypto.randomUUID(),
        intlOrders[i % intlOrders.length].id,
        ["PICKUP", "AGGREGATION", "COLD_STORAGE", "EXPORT_DOCS", "FREIGHT", "FINANCE"][i % 6],
        180 + i * 70,
        "Ops Vendor Ltd",
      ]
    );
  }

  const orderStatuses = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "SHIPPED", "COMPLETED", "CANCELLED"];
  for (let i = 0; i < 8; i += 1) {
    const srcListing = listings[i % listings.length];
    const orderId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO orders
       (id, listing_id, buyer_id, farmer_id, requested_qty, unit, offer_price, currency, export_path, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'USD','CONSYNAIR_MANAGED',$8)`,
      [orderId, srcListing.id, adminId, srcListing.farmerId, 120 + i * 10, srcListing.unit, srcListing.price, orderStatuses[i % orderStatuses.length]]
    );

    if (["SHIPPED", "COMPLETED"].includes(orderStatuses[i % orderStatuses.length])) {
      await pool.query(
        `INSERT INTO order_shipments
         (id, order_id, airline, flight_number, awb_number, departure_airport, arrival_airport, eta, tracking_status, tracking_reference, tracking_last_updated)
         VALUES ($1,$2,'Kenya Airways',$3,$4,'NBO','AMS',NOW() + ($5 || ' days')::interval,$6,$7,NOW())`,
        [
          crypto.randomUUID(),
          orderId,
          `KQ${730 + i}`,
          `176-ZAO-00${i}`,
          String(2 + i),
          orderStatuses[i % orderStatuses.length] === "COMPLETED" ? "DELIVERED" : "IN_AIR",
          `TRK-ZAO-${i}`,
        ]
      );
    }

    if (i < 5) {
      await pool.query(
        `INSERT INTO order_documents
         (id, order_id, doc_type, doc_url, provided_by, verified)
         VALUES ($1,$2,$3,$4,'CONSYN-AIR',$5)`,
        [
          crypto.randomUUID(),
          orderId,
          i % 2 === 0 ? "PHYTOSANITARY_CERT" : "COMMERCIAL_INVOICE",
          `https://example.com/zaodirect/demo-doc-${i + 1}.pdf`,
          i % 2 === 0,
        ]
      );
    }
  }

  console.log("Demo data seeded. Demo farmers use password: demo1234");
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
