import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();
const internationalOrderStatusSchema = z.enum([
  "OPEN",
  "PROCUREMENT",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);
function formatStatusLabel(status) {
  return String(status || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const internationalOrderSchema = z.object({
  buyerName: z.string().min(2),
  buyerCompany: z.string().optional(),
  buyerCountry: z.string().optional(),
  buyerEmail: z.string().email().optional(),
  cropType: z.string().min(2),
  targetGrade: z.string().optional(),
  requiredQuantity: z.number().positive(),
  unit: z.string().default("kg"),
  targetPrice: z.number().positive(),
  currency: z.string().default("USD"),
  expectedShipDate: z.string().optional(),
  incoterm: z.string().optional(),
  notes: z.string().optional(),
  status: z
    .enum(["OPEN", "PROCUREMENT", "PARTIALLY_SHIPPED", "SHIPPED", "DELIVERED", "CANCELLED"])
    .default("OPEN"),
});

const farmerPurchaseOrderSchema = z.object({
  internationalOrderId: z.string().min(1),
  farmerId: z.string().min(1),
  listingId: z.string().optional(),
  cropType: z.string().min(2),
  expectedGrade: z.string().optional(),
  quantity: z.number().positive(),
  actualPickedQuantity: z.number().nonnegative().optional(),
  unit: z.string().default("kg"),
  farmGatePrice: z.number().nonnegative(),
  currency: z.string().default("KES"),
  pickupLocation: z.string().optional(),
  pickupDate: z.string().optional(),
  notes: z.string().optional(),
});

const updateFarmerPurchaseOrderSchema = z.object({
  actualPickedQuantity: z.number().nonnegative().optional(),
  pickupDate: z.string().optional(),
  pickupLocation: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["OPEN", "CONFIRMED", "ALLOCATED", "READY_FOR_PICKUP", "PICKED_UP", "SETTLED", "REJECTED"]).optional(),
});

function canTransitionProcurementStatus(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return true;

  // Strict sequence (no skipping):
  // OPEN -> CONFIRMED -> ALLOCATED -> READY_FOR_PICKUP -> PICKED_UP -> SETTLED
  if (currentStatus === "OPEN" && nextStatus === "CONFIRMED") return true;
  if (currentStatus === "CONFIRMED" && nextStatus === "ALLOCATED") return true;
  if (currentStatus === "ALLOCATED" && nextStatus === "READY_FOR_PICKUP") return true;
  if (currentStatus === "READY_FOR_PICKUP" && nextStatus === "PICKED_UP") return true;
  if (currentStatus === "PICKED_UP" && nextStatus === "SETTLED") return true;

  // Rejection is only allowed before collection
  if (["OPEN", "CONFIRMED", "ALLOCATED", "READY_FOR_PICKUP"].includes(currentStatus) && nextStatus === "REJECTED") {
    return true;
  }

  return false;
}

const farmerProcurementStatusSchema = z.enum(["CONFIRMED", "READY_FOR_PICKUP", "REJECTED"]);

function canTransitionFarmerProcurementStatus(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return true;

  // Farmer steps only, in order:
  // OPEN -> CONFIRMED, then ALLOCATED -> READY_FOR_PICKUP
  if (currentStatus === "OPEN" && (nextStatus === "CONFIRMED" || nextStatus === "REJECTED")) return true;
  if (currentStatus === "ALLOCATED" && nextStatus === "READY_FOR_PICKUP") return true;

  return false;
}

const batchSchema = z.object({
  internationalOrderId: z.string().min(1),
  batchCode: z.string().min(3),
  cropType: z.string().min(2),
  targetGrade: z.string().optional(),
  destinationCountry: z.string().optional(),
  totalQuantity: z.number().positive(),
  unit: z.string().default("kg"),
  status: z.enum(["CREATED", "COLLECTING", "QA_PASSED", "DISPATCHED", "SHIPPED", "DELIVERED"]).default("CREATED"),
});
const batchStatusSchema = z.enum(["CREATED", "COLLECTING", "QA_PASSED", "DISPATCHED", "SHIPPED", "DELIVERED"]);
function canTransitionBatchStatus(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return true;
  const flow = ["CREATED", "COLLECTING", "QA_PASSED", "DISPATCHED", "SHIPPED", "DELIVERED"];
  const currentIndex = flow.indexOf(currentStatus);
  const nextIndex = flow.indexOf(nextStatus);
  return currentIndex >= 0 && nextIndex === currentIndex + 1;
}

const batchItemSchema = z.object({
  batchId: z.string().min(1),
  farmerPurchaseOrderId: z.string().min(1),
  acceptedQuantity: z.number().positive(),
  rejectedQuantity: z.number().nonnegative().default(0),
  gradeResult: z.string().optional(),
});

const batchShipmentLotSchema = z.object({
  batchId: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1)),
  quantity: z.preprocess((v) => {
    if (typeof v === "string") {
      const normalized = v.replace(/,/g, "").trim();
      return normalized === "" ? NaN : Number(normalized);
    }
    return v;
  }, z.number().positive()),
  unit: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1).default("kg")),
  flightNumber: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  awbNumber: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  eta: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
  notes: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
});

const batchShipmentLotStatusSchema = z.enum(["CREATED", "DISPATCHED", "SHIPPED", "DELIVERED"]);
const canTransitionLotStatus = (currentStatus, nextStatus) => {
  if (currentStatus === nextStatus) return true;
  const flow = ["CREATED", "DISPATCHED", "SHIPPED", "DELIVERED"];
  const currentIndex = flow.indexOf(currentStatus);
  const nextIndex = flow.indexOf(nextStatus);
  if (currentIndex === -1 || nextIndex === -1) return false;
  return nextIndex === currentIndex + 1;
};

const qualityCheckSchema = z.object({
  batchId: z.string().min(1),
  stage: z.enum(["HARVEST", "AGGREGATION", "PRE_EXPORT", "DISPATCH"]),
  moistureLevel: z.number().optional(),
  pesticidePassed: z.boolean().optional(),
  sizeGrade: z.string().optional(),
  notes: z.string().optional(),
  photoUrl: z.string().optional(),
});

const payoutSchema = z.object({
  farmerPurchaseOrderId: z.string().min(1),
  farmerId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().default("KES"),
  payoutType: z.enum(["ADVANCE", "FINAL", "ADJUSTMENT"]),
  status: z.enum(["PENDING", "APPROVED", "PAID", "FAILED"]).default("PENDING"),
  scheduledFor: z.string().optional(),
  paidAt: z.string().optional(),
  notes: z.string().optional(),
});
const payoutStatusSchema = z.enum(["PENDING", "APPROVED", "PAID", "FAILED"]);

const costEntrySchema = z.object({
  internationalOrderId: z.string().min(1),
  batchId: z.string().optional(),
  costType: z.enum(["PICKUP", "AGGREGATION", "COLD_STORAGE", "EXPORT_DOCS", "FREIGHT", "FINANCE", "OTHER"]),
  amount: z.number().nonnegative(),
  currency: z.string().default("USD"),
  vendorName: z.string().optional(),
  notes: z.string().optional(),
});
const shipmentEventSchema = z.object({
  batchId: z.string().min(1),
  milestone: z.enum([
    "PICKUP_SCHEDULED",
    "PICKED_UP",
    "AT_AGGREGATION",
    "AT_PORT",
    "IN_FLIGHT",
    "CUSTOMS_CLEARANCE",
    "DELIVERED",
    "EXCEPTION",
  ]),
  eventTime: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
const disputeCaseSchema = z.object({
  caseType: z.enum(["PICKUP_SHORTFALL", "QUALITY_REJECTION", "SETTLEMENT_DELAY", "SHIPMENT_ISSUE", "OTHER"]),
  title: z.string().min(3),
  description: z.string().optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  internationalOrderId: z.string().min(1).optional(),
  farmerPurchaseOrderId: z.string().min(1).optional(),
  batchId: z.string().min(1).optional(),
  ownerUserId: z.string().min(1).optional(),
  dueAt: z.string().optional(),
});
const disputeCaseUpdateSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]).optional(),
  ownerUserId: z.string().min(1).optional(),
  resolutionNotes: z.string().optional(),
  dueAt: z.string().optional(),
});

function canTransitionInternationalOrderStatus(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) return true;
  const transitions = {
    OPEN: new Set(["PROCUREMENT", "CANCELLED"]),
    PROCUREMENT: new Set(["PARTIALLY_SHIPPED", "SHIPPED", "CANCELLED"]),
    PARTIALLY_SHIPPED: new Set(["SHIPPED", "DELIVERED", "CANCELLED"]),
    SHIPPED: new Set(["DELIVERED"]),
    DELIVERED: new Set([]),
    CANCELLED: new Set([]),
  };
  return transitions[currentStatus]?.has(nextStatus) || false;
}

async function syncInternationalOrderFromBatches(internationalOrderId, actorUserId) {
  const agg = await query(
    `SELECT
        io.id,
        io.status AS current_status,
        COALESCE(io.required_quantity, 0) AS required_quantity,
        (
          COALESCE(SUM(CASE WHEN b.status IN ('SHIPPED','DELIVERED') THEN COALESCE(b.total_quantity, 0) ELSE 0 END), 0)
          +
          COALESCE(
            (
              SELECT SUM(COALESCE(l.quantity, 0))
              FROM batch_shipment_lots l
              JOIN batches bb ON bb.id = l.batch_id
              WHERE bb.international_order_id = io.id
                AND bb.status NOT IN ('SHIPPED','DELIVERED')
                AND l.status IN ('DISPATCHED','SHIPPED','DELIVERED')
            ),
            0
          )
        ) AS shipped_quantity,
        (
          COALESCE(SUM(CASE WHEN b.status = 'DELIVERED' THEN COALESCE(b.total_quantity, 0) ELSE 0 END), 0)
          +
          COALESCE(
            (
              SELECT SUM(COALESCE(l.quantity, 0))
              FROM batch_shipment_lots l
              JOIN batches bb ON bb.id = l.batch_id
              WHERE bb.international_order_id = io.id
                AND bb.status <> 'DELIVERED'
                AND l.status = 'DELIVERED'
            ),
            0
          )
        ) AS delivered_quantity,
        COUNT(b.id)::int AS total_batches
     FROM international_orders io
     LEFT JOIN batches b ON b.international_order_id = io.id
     WHERE io.id = $1
     GROUP BY io.id, io.status, io.required_quantity`,
    [internationalOrderId]
  );

  if (agg.rowCount === 0) return null;

  const row = agg.rows[0];
  const requiredQuantity = Number(row.required_quantity || 0);
  const shippedQuantity = Number(row.shipped_quantity || 0);
  const deliveredQuantity = Number(row.delivered_quantity || 0);
  const remainingQuantity = Math.max(requiredQuantity - shippedQuantity, 0);
  const hasBatches = Number(row.total_batches || 0) > 0;

  let nextStatus = row.current_status;
  if (requiredQuantity > 0 && deliveredQuantity >= requiredQuantity) {
    nextStatus = "DELIVERED";
  } else if (requiredQuantity > 0 && shippedQuantity >= requiredQuantity) {
    nextStatus = "SHIPPED";
  } else if (shippedQuantity > 0) {
    nextStatus = "PARTIALLY_SHIPPED";
  } else if (hasBatches) {
    nextStatus = "PROCUREMENT";
  }

  if (nextStatus !== row.current_status) {
    await query(
      `UPDATE international_orders
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [nextStatus, internationalOrderId]
    );
    if (actorUserId) {
      await logAudit(actorUserId, "international_order", internationalOrderId, "status_auto_sync", {
        previousStatus: row.current_status,
        status: nextStatus,
        shippedQuantity,
        deliveredQuantity,
        remainingQuantity,
      });
    }
  }

  return {
    requiredQuantity,
    shippedQuantity,
    deliveredQuantity,
    remainingQuantity,
    autoStatus: nextStatus,
  };
}

async function triggerDispatchPayouts(batchId, actorUserId) {
  const allocationRows = await query(
    `SELECT
        bi.id AS batch_item_id,
        bi.accepted_quantity,
        fpo.id AS farmer_purchase_order_id,
        fpo.farmer_id,
        fpo.farm_gate_price,
        fpo.currency
     FROM batch_items bi
     JOIN farmer_purchase_orders fpo ON fpo.id = bi.farmer_purchase_order_id
     WHERE bi.batch_id = $1`,
    [batchId]
  );

  for (const row of allocationRows.rows) {
    const existing = await query(
      `SELECT id
       FROM payouts
       WHERE farmer_purchase_order_id = $1
         AND payout_type = 'FINAL'
         AND notes = $2
       LIMIT 1`,
      [row.farmer_purchase_order_id, `AUTO_FROM_BATCH_DISPATCH:${batchId}`]
    );
    if (existing.rowCount > 0) continue;

    const amount = Number(row.accepted_quantity || 0) * Number(row.farm_gate_price || 0);
    if (amount <= 0) continue;

    const payoutId = crypto.randomUUID();
    await query(
      `INSERT INTO payouts
       (id, farmer_purchase_order_id, farmer_id, amount, currency, payout_type, status, scheduled_for, paid_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        payoutId,
        row.farmer_purchase_order_id,
        row.farmer_id,
        amount,
        row.currency || "KES",
        "FINAL",
        "APPROVED",
        new Date(),
        null,
        `AUTO_FROM_BATCH_DISPATCH:${batchId}`,
      ]
    );
    await logAudit(actorUserId, "payout", payoutId, "auto_create_from_batch_dispatch", {
      batchId,
      farmerPurchaseOrderId: row.farmer_purchase_order_id,
      amount,
    });
  }
}

async function markLinkedProcurementsCollected(batchId) {
  await query(
    `UPDATE farmer_purchase_orders fpo
     SET status = 'PICKED_UP',
         updated_at = NOW()
     FROM batch_items bi
     WHERE bi.batch_id = $1
       AND bi.farmer_purchase_order_id = fpo.id
       AND fpo.status = 'READY_FOR_PICKUP'`,
    [batchId]
  );
}

async function syncBatchStatusFromLots(batchId, actorUserId) {
  const [batchRes, lotAgg] = await Promise.all([
    query(`SELECT id, total_quantity, status FROM batches WHERE id = $1`, [batchId]),
    query(
      `SELECT
         COALESCE(SUM(CASE WHEN status IN ('DISPATCHED','SHIPPED','DELIVERED') THEN quantity ELSE 0 END), 0) AS dispatched_qty,
         COALESCE(SUM(CASE WHEN status IN ('SHIPPED','DELIVERED') THEN quantity ELSE 0 END), 0) AS shipped_qty,
         COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN quantity ELSE 0 END), 0) AS delivered_qty
       FROM batch_shipment_lots
       WHERE batch_id = $1`,
      [batchId]
    ),
  ]);

  if (batchRes.rowCount === 0) return;
  const batch = batchRes.rows[0];
  const target = Number(batch.total_quantity || 0);
  const dispatchedQty = Number(lotAgg.rows[0]?.dispatched_qty || 0);
  const shippedQty = Number(lotAgg.rows[0]?.shipped_qty || 0);
  const deliveredQty = Number(lotAgg.rows[0]?.delivered_qty || 0);

  let nextStatus = batch.status;
  if (target > 0 && deliveredQty >= target) nextStatus = "DELIVERED";
  else if (target > 0 && shippedQty >= target) nextStatus = "SHIPPED";
  else if (target > 0 && dispatchedQty >= target) nextStatus = "DISPATCHED";

  if (nextStatus !== batch.status) {
    const wasPreDispatch = !["DISPATCHED", "SHIPPED", "DELIVERED"].includes(batch.status);
    const isAtOrPastDispatch = ["DISPATCHED", "SHIPPED", "DELIVERED"].includes(nextStatus);

    await query(
      `UPDATE batches
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [nextStatus, batchId]
    );

    // If lot movement pushed the batch into dispatch-or-later, run the same side effects
    // as manual batch dispatch (mark procurements collected + create payout records).
    if (wasPreDispatch && isAtOrPastDispatch) {
      await markLinkedProcurementsCollected(batchId);
      await triggerDispatchPayouts(batchId, actorUserId);
    }
  }
}

router.use(requireAuth);

router.get("/international-orders", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT
              io.*,
              COALESCE((SELECT COUNT(*) FROM farmer_purchase_orders fpo WHERE fpo.international_order_id = io.id), 0) AS procurement_orders_count,
              COALESCE((SELECT SUM(ce.amount) FROM cost_entries ce WHERE ce.international_order_id = io.id), 0) AS total_cost_value,
              (
                COALESCE((SELECT SUM(COALESCE(b.total_quantity, 0)) FROM batches b WHERE b.international_order_id = io.id AND b.status IN ('SHIPPED','DELIVERED')), 0)
                +
                COALESCE((
                  SELECT SUM(COALESCE(l.quantity, 0))
                  FROM batch_shipment_lots l
                  JOIN batches b2 ON b2.id = l.batch_id
                  WHERE b2.international_order_id = io.id
                    AND b2.status NOT IN ('SHIPPED','DELIVERED')
                    AND l.status IN ('DISPATCHED','SHIPPED','DELIVERED')
                ), 0)
              ) AS shipped_quantity,
              (
                COALESCE((SELECT SUM(COALESCE(b.total_quantity, 0)) FROM batches b WHERE b.international_order_id = io.id AND b.status = 'DELIVERED'), 0)
                +
                COALESCE((
                  SELECT SUM(COALESCE(l.quantity, 0))
                  FROM batch_shipment_lots l
                  JOIN batches b2 ON b2.id = l.batch_id
                  WHERE b2.international_order_id = io.id
                    AND b2.status <> 'DELIVERED'
                    AND l.status = 'DELIVERED'
                ), 0)
              ) AS delivered_quantity,
              GREATEST(
                COALESCE(io.required_quantity, 0) - (
                  COALESCE((SELECT SUM(COALESCE(b.total_quantity, 0)) FROM batches b WHERE b.international_order_id = io.id AND b.status IN ('SHIPPED','DELIVERED')), 0)
                  +
                  COALESCE((
                    SELECT SUM(COALESCE(l.quantity, 0))
                    FROM batch_shipment_lots l
                    JOIN batches b2 ON b2.id = l.batch_id
                    WHERE b2.international_order_id = io.id
                      AND b2.status NOT IN ('SHIPPED','DELIVERED')
                      AND l.status IN ('DISPATCHED','SHIPPED','DELIVERED')
                  ), 0)
                ),
                0
              ) AS remaining_quantity
       FROM international_orders io
       ORDER BY io.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/international-orders", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = internationalOrderSchema.parse(req.body);
    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO international_orders
       (id, buyer_name, buyer_company, buyer_country, buyer_email, crop_type, target_grade, required_quantity, unit, target_price, currency, expected_ship_date, incoterm, notes, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        id,
        data.buyerName,
        data.buyerCompany ?? null,
        data.buyerCountry ?? null,
        data.buyerEmail ?? null,
        data.cropType,
        data.targetGrade ?? null,
        data.requiredQuantity,
        data.unit,
        data.targetPrice ?? null,
        data.currency,
        data.expectedShipDate ? new Date(data.expectedShipDate) : null,
        data.incoterm ?? null,
        data.notes ?? null,
        data.status,
        req.user.sub,
      ]
    );
    await logAudit(req.user.sub, "international_order", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.patch("/international-orders/:id/status", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const status = internationalOrderStatusSchema.parse(req.body.status);
    if (status !== "CANCELLED") {
      return res.status(400).json({
        message: "Manual status changes are disabled. International order status is auto-driven by batch progress. Only cancellation is allowed manually.",
      });
    }
    const existing = await query("SELECT id, status FROM international_orders WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "International order not found" });
    }
    const currentStatus = existing.rows[0].status;
    if (currentStatus === "SHIPPED" || currentStatus === "DELIVERED") {
      return res.status(400).json({ message: "Shipped or delivered orders cannot be cancelled" });
    }
    if (currentStatus === "CANCELLED") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }
    if (!canTransitionInternationalOrderStatus(currentStatus, status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${currentStatus} to ${status}.`,
      });
    }

    const updated = await query(
      `UPDATE international_orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );
    await logAudit(req.user.sub, "international_order", req.params.id, "status_update", { status });
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid status" });
    return next(error);
  }
});

router.get("/farmer-purchase-orders", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT
         fpo.*,
         u.name AS farmer_name,
         io.buyer_name,
         io.crop_type AS int_crop_type,
         COALESCE(
           (
             SELECT SUM(COALESCE(bi.accepted_quantity, 0))
             FROM batch_items bi
             WHERE bi.farmer_purchase_order_id = fpo.id
           ),
           0
         ) AS allocated_weight,
         GREATEST(
           COALESCE(fpo.quantity, 0) - COALESCE(
             (
               SELECT SUM(COALESCE(bi.accepted_quantity, 0))
               FROM batch_items bi
               WHERE bi.farmer_purchase_order_id = fpo.id
             ),
             0
           ),
           0
         ) AS remaining_weight
       FROM farmer_purchase_orders fpo
       JOIN users u ON u.id = fpo.farmer_id
       JOIN international_orders io ON io.id = fpo.international_order_id
       ORDER BY fpo.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/farmer-purchase-orders/mine", requireRole("FARMER"), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         fpo.*,
         io.buyer_name,
         io.crop_type AS int_crop_type,
         cb.name AS coordinator_name,
         cb.profile_photo_url AS coordinator_profile_photo_url,
         COALESCE(
           (
             SELECT SUM(COALESCE(bi.accepted_quantity, 0))
             FROM batch_items bi
             WHERE bi.farmer_purchase_order_id = fpo.id
           ),
           0
         ) AS allocated_weight,
         GREATEST(
           COALESCE(fpo.quantity, 0) - COALESCE(
             (
               SELECT SUM(COALESCE(bi.accepted_quantity, 0))
               FROM batch_items bi
               WHERE bi.farmer_purchase_order_id = fpo.id
             ),
             0
           ),
           0
         ) AS remaining_weight
         ,
         COALESCE(
           (
             SELECT p.status
             FROM payouts p
             WHERE p.farmer_purchase_order_id = fpo.id
             ORDER BY p.created_at DESC
             LIMIT 1
           ),
           'UNPAID'
         ) AS payment_status,
         COALESCE(
           (
             SELECT SUM(
               CASE
                 WHEN b.status IN ('SHIPPED', 'DELIVERED') THEN COALESCE(bi.accepted_quantity, 0)
                 ELSE LEAST(
                   COALESCE(bi.accepted_quantity, 0),
                   COALESCE(
                     (
                       SELECT SUM(COALESCE(l.quantity, 0))
                       FROM batch_shipment_lots l
                       WHERE l.batch_id = bi.batch_id
                         AND l.status IN ('SHIPPED', 'DELIVERED')
                     ),
                     0
                   )
                 )
               END
             )
             FROM batch_items bi
             JOIN batches b ON b.id = bi.batch_id
             WHERE bi.farmer_purchase_order_id = fpo.id
           ),
           0
         ) AS shipped_weight,
         COALESCE(
           (
             SELECT SUM(
               CASE
                 WHEN b.status = 'DELIVERED' THEN COALESCE(bi.accepted_quantity, 0)
                 ELSE LEAST(
                   COALESCE(bi.accepted_quantity, 0),
                   COALESCE(
                     (
                       SELECT SUM(COALESCE(l.quantity, 0))
                       FROM batch_shipment_lots l
                       WHERE l.batch_id = bi.batch_id
                         AND l.status = 'DELIVERED'
                     ),
                     0
                   )
                 )
               END
             )
             FROM batch_items bi
             JOIN batches b ON b.id = bi.batch_id
             WHERE bi.farmer_purchase_order_id = fpo.id
           ),
           0
         ) AS delivered_weight,
         CASE
           WHEN COALESCE(
             (
               SELECT SUM(
                 CASE
                   WHEN b.status = 'DELIVERED' THEN COALESCE(bi.accepted_quantity, 0)
                   ELSE LEAST(
                     COALESCE(bi.accepted_quantity, 0),
                     COALESCE(
                       (
                         SELECT SUM(COALESCE(l.quantity, 0))
                         FROM batch_shipment_lots l
                         WHERE l.batch_id = bi.batch_id
                           AND l.status = 'DELIVERED'
                       ),
                       0
                     )
                   )
                 END
               )
               FROM batch_items bi
               JOIN batches b ON b.id = bi.batch_id
               WHERE bi.farmer_purchase_order_id = fpo.id
             ),
             0
           ) >= COALESCE(
             (
               SELECT SUM(COALESCE(bi.accepted_quantity, 0))
               FROM batch_items bi
               WHERE bi.farmer_purchase_order_id = fpo.id
             ),
             0
           ) AND COALESCE(
             (
               SELECT SUM(COALESCE(bi.accepted_quantity, 0))
               FROM batch_items bi
               WHERE bi.farmer_purchase_order_id = fpo.id
             ),
             0
           ) > 0 THEN 'DELIVERED'
            WHEN COALESCE(
              (
               SELECT SUM(
                 CASE
                   WHEN b.status IN ('SHIPPED', 'DELIVERED') THEN COALESCE(bi.accepted_quantity, 0)
                   ELSE LEAST(
                     COALESCE(bi.accepted_quantity, 0),
                     COALESCE(
                       (
                         SELECT SUM(COALESCE(l.quantity, 0))
                         FROM batch_shipment_lots l
                         WHERE l.batch_id = bi.batch_id
                           AND l.status IN ('SHIPPED', 'DELIVERED')
                       ),
                       0
                     )
                   )
                 END
               )
               FROM batch_items bi
               JOIN batches b ON b.id = bi.batch_id
               WHERE bi.farmer_purchase_order_id = fpo.id
              ),
              0
            ) >= COALESCE(
              (
                SELECT SUM(COALESCE(bi.accepted_quantity, 0))
                FROM batch_items bi
                WHERE bi.farmer_purchase_order_id = fpo.id
              ),
              0
            ) AND COALESCE(
              (
                SELECT SUM(COALESCE(bi.accepted_quantity, 0))
                FROM batch_items bi
                WHERE bi.farmer_purchase_order_id = fpo.id
              ),
              0
            ) > 0 THEN 'SHIPPED'
            WHEN COALESCE(
              (
                SELECT SUM(
                  CASE
                    WHEN b.status IN ('SHIPPED', 'DELIVERED') THEN COALESCE(bi.accepted_quantity, 0)
                    ELSE LEAST(
                      COALESCE(bi.accepted_quantity, 0),
                      COALESCE(
                        (
                          SELECT SUM(COALESCE(l.quantity, 0))
                          FROM batch_shipment_lots l
                          WHERE l.batch_id = bi.batch_id
                            AND l.status IN ('SHIPPED', 'DELIVERED')
                        ),
                        0
                      )
                    )
                  END
                )
                FROM batch_items bi
                JOIN batches b ON b.id = bi.batch_id
                WHERE bi.farmer_purchase_order_id = fpo.id
              ),
              0
            ) > 0 THEN 'PARTIALLY_SHIPPED'
           WHEN COALESCE(
             (
               SELECT SUM(
                 CASE
                   WHEN b.status = 'DISPATCHED' THEN COALESCE(bi.accepted_quantity, 0)
                   ELSE LEAST(
                     COALESCE(bi.accepted_quantity, 0),
                     COALESCE(
                       (
                         SELECT SUM(COALESCE(l.quantity, 0))
                         FROM batch_shipment_lots l
                         WHERE l.batch_id = bi.batch_id
                           AND l.status = 'DISPATCHED'
                       ),
                       0
                     )
                   )
                 END
               )
               FROM batch_items bi
               JOIN batches b ON b.id = bi.batch_id
               WHERE bi.farmer_purchase_order_id = fpo.id
             ),
             0
           ) > 0 THEN 'DISPATCHED'
           ELSE 'NOT_SHIPPED'
         END AS shipment_progress
       FROM farmer_purchase_orders fpo
       JOIN international_orders io ON io.id = fpo.international_order_id
       LEFT JOIN users cb ON cb.id = fpo.created_by
       WHERE fpo.farmer_id = $1
       ORDER BY fpo.created_at DESC`,
      [req.user.sub]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/farmer-purchase-orders", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = farmerPurchaseOrderSchema.parse(req.body);
    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO farmer_purchase_orders
       (id, international_order_id, farmer_id, listing_id, crop_type, expected_grade, quantity, actual_picked_quantity, unit, farm_gate_price, currency, pickup_location, pickup_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        id,
        data.internationalOrderId,
        data.farmerId,
        data.listingId ?? null,
        data.cropType,
        data.expectedGrade ?? null,
        data.quantity,
        data.actualPickedQuantity ?? null,
        data.unit,
        data.farmGatePrice,
        data.currency,
        data.pickupLocation ?? null,
        data.pickupDate ? new Date(data.pickupDate) : null,
        "OPEN",
        data.notes ?? null,
        req.user.sub,
      ]
    );
    await logAudit(req.user.sub, "farmer_purchase_order", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.patch("/farmer-purchase-orders/:id/farmer-status", requireRole("FARMER"), async (req, res, next) => {
  try {
    const status = farmerProcurementStatusSchema.parse(req.body.status);
    const existing = await query(
      `SELECT id, farmer_id, status
       FROM farmer_purchase_orders
       WHERE id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Farmer procurement order not found" });
    }
    const current = existing.rows[0];
    if (current.farmer_id !== req.user.sub) {
      return res.status(403).json({ message: "You can only update your own procurement orders" });
    }
    if (!canTransitionFarmerProcurementStatus(current.status, status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${current.status} to ${status}. Follow Open -> Confirmed -> Allocated -> Ready for pickup -> Picked up -> Settled`,
      });
    }

    const updated = await query(
      `UPDATE farmer_purchase_orders
       SET status = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    // Batch only starts collecting after farmer confirms produce is ready for pickup.
    if (status === "READY_FOR_PICKUP") {
      await query(
        `UPDATE batches b
         SET status = 'COLLECTING',
             updated_at = NOW()
         FROM batch_items bi
         WHERE bi.farmer_purchase_order_id = $1
           AND bi.batch_id = b.id
           AND b.status = 'CREATED'`,
        [req.params.id]
      );
    }
    await logAudit(req.user.sub, "farmer_purchase_order", req.params.id, "farmer_status_update", { status });
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid status" });
    return next(error);
  }
});

router.patch("/farmer-purchase-orders/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = updateFarmerPurchaseOrderSchema.parse(req.body);
    const existing = await query(
      `SELECT id, status, farmer_id, farm_gate_price, currency, quantity
       FROM farmer_purchase_orders
       WHERE id = $1`,
      [req.params.id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Farmer procurement order not found" });
    }

    const current = existing.rows[0];
    const nextStatus = data.status ?? current.status;
    if (!canTransitionProcurementStatus(current.status, nextStatus)) {
      return res.status(400).json({
        message: `Invalid status transition from ${current.status} to ${nextStatus}`,
      });
    }

    // Lock edits when linked batch has progressed to dispatch or beyond.
    const lockCheck = await query(
      `SELECT COUNT(*)::int AS locked_count
       FROM batch_items bi
       JOIN batches b ON b.id = bi.batch_id
       WHERE bi.farmer_purchase_order_id = $1
         AND b.status IN ('DISPATCHED', 'SHIPPED', 'DELIVERED')`,
      [req.params.id]
    );
    const isSettlingTransition = current.status === "PICKED_UP" && nextStatus === "SETTLED";
    if ((lockCheck.rows[0]?.locked_count || 0) > 0 && !isSettlingTransition) {
      return res.status(400).json({
        message: "This procurement order is locked because its batch is already dispatched/shipped/delivered",
      });
    }

    const updated = await query(
      `UPDATE farmer_purchase_orders
       SET actual_picked_quantity = COALESCE($1, actual_picked_quantity),
           pickup_date = COALESCE($2, pickup_date),
           pickup_location = COALESCE($3, pickup_location),
           notes = COALESCE($4, notes),
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        data.actualPickedQuantity ?? null,
        data.pickupDate ? new Date(data.pickupDate) : null,
        data.pickupLocation ?? null,
        data.notes ?? null,
        data.status ?? null,
        req.params.id,
      ]
    );

    if (nextStatus === "SETTLED") {
      const payoutUpdate = await query(
        `UPDATE payouts
         SET status = 'PAID',
             paid_at = COALESCE(paid_at, NOW())
         WHERE farmer_purchase_order_id = $1
         RETURNING id`,
        [req.params.id]
      );

      if (payoutUpdate.rowCount === 0) {
        const acceptedAgg = await query(
          `SELECT COALESCE(SUM(accepted_quantity), 0) AS accepted_quantity
           FROM batch_items
           WHERE farmer_purchase_order_id = $1`,
          [req.params.id]
        );
        const acceptedQuantity = Number(acceptedAgg.rows[0]?.accepted_quantity || 0);
        const fallbackQuantity = Number(current.quantity || 0);
        const quantityForPayout = acceptedQuantity > 0 ? acceptedQuantity : fallbackQuantity;
        const amount = quantityForPayout * Number(current.farm_gate_price || 0);

        if (amount > 0) {
          const payoutId = crypto.randomUUID();
          await query(
            `INSERT INTO payouts
             (id, farmer_purchase_order_id, farmer_id, amount, currency, payout_type, status, scheduled_for, paid_at, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              payoutId,
              req.params.id,
              current.farmer_id,
              amount,
              current.currency || "KES",
              "FINAL",
              "PAID",
              new Date(),
              new Date(),
              "AUTO_FROM_ADMIN_SETTLE",
            ]
          );
        }
      }
    }

    await logAudit(req.user.sub, "farmer_purchase_order", req.params.id, "update", data);
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.get("/batches", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT b.*, io.buyer_name, io.crop_type AS int_crop_type
       FROM batches b
       JOIN international_orders io ON io.id = b.international_order_id
       ORDER BY b.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/batch-items", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const params = [];
    let whereClause = "";
    if (req.query.batchId) {
      params.push(req.query.batchId);
      whereClause = "WHERE bi.batch_id = $1";
    }
    const result = await query(
      `SELECT bi.*, fpo.crop_type, fpo.actual_picked_quantity, fpo.unit, u.name AS farmer_name
       FROM batch_items bi
       JOIN farmer_purchase_orders fpo ON fpo.id = bi.farmer_purchase_order_id
       JOIN users u ON u.id = fpo.farmer_id
       ${whereClause}
       ORDER BY bi.created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/quality-checks", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const params = [];
    let whereClause = "";
    if (req.query.batchId) {
      params.push(req.query.batchId);
      whereClause = "WHERE qc.batch_id = $1";
    }
    const result = await query(
      `SELECT qc.*, u.name AS inspector_name
       FROM quality_checks qc
       LEFT JOIN users u ON u.id = qc.inspector_user_id
       ${whereClause}
       ORDER BY qc.created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/batches", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = batchSchema.parse(req.body);

    const orderAgg = await query(
      `SELECT
          io.id,
          COALESCE(io.required_quantity, 0) AS required_quantity,
          COALESCE(SUM(COALESCE(b.total_quantity, 0)), 0) AS planned_batch_quantity
       FROM international_orders io
       LEFT JOIN batches b ON b.international_order_id = io.id
       WHERE io.id = $1
       GROUP BY io.id, io.required_quantity`,
      [data.internationalOrderId]
    );

    if (orderAgg.rowCount === 0) {
      return res.status(404).json({ message: "International order not found" });
    }

    const requiredQty = Number(orderAgg.rows[0].required_quantity || 0);
    const plannedQty = Number(orderAgg.rows[0].planned_batch_quantity || 0);
    const nextPlannedQty = plannedQty + Number(data.totalQuantity || 0);

    if (requiredQty > 0 && nextPlannedQty > requiredQty) {
      return res.status(400).json({
        message: `Batch quantity exceeds order requirement. Planned would be ${nextPlannedQty} ${data.unit} but order requires ${requiredQty} ${data.unit}.`,
      });
    }

    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO batches
       (id, international_order_id, batch_code, crop_type, target_grade, destination_country, total_quantity, unit, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id,
        data.internationalOrderId,
        data.batchCode,
        data.cropType,
        data.targetGrade ?? null,
        data.destinationCountry ?? null,
        data.totalQuantity ?? null,
        data.unit,
        data.status,
        req.user.sub,
      ]
    );
    await syncInternationalOrderFromBatches(data.internationalOrderId, req.user.sub);
    await logAudit(req.user.sub, "batch", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.patch("/batches/:id/status", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const status = batchStatusSchema.parse(req.body.status);
    const existing = await query("SELECT id, status, international_order_id FROM batches WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }
    const currentStatus = existing.rows[0].status;
    if (!canTransitionBatchStatus(currentStatus, status)) {
      return res.status(400).json({
        message: `Invalid batch status transition from ${currentStatus} to ${status}. Follow CREATED -> COLLECTING -> QA_PASSED -> DISPATCHED -> SHIPPED -> DELIVERED`,
      });
    }

    const updated = await query(
      `UPDATE batches
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (status === "DISPATCHED") {
      await markLinkedProcurementsCollected(req.params.id);
      await triggerDispatchPayouts(req.params.id, req.user.sub);
    }

    const shipmentMilestoneByBatchStatus = {
      COLLECTING: "PICKED_UP",
      QA_PASSED: "AT_AGGREGATION",
      DISPATCHED: "AT_PORT",
      SHIPPED: "IN_FLIGHT",
      DELIVERED: "DELIVERED",
    };

    const autoMilestone = shipmentMilestoneByBatchStatus[status];
    if (autoMilestone) {
      const syncNote = `Synced from batch status: ${formatStatusLabel(status)}`;
      const existingAuto = await query(
        `SELECT id
         FROM shipment_events
         WHERE batch_id = $1
           AND notes LIKE 'Synced from batch status:%'
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.params.id]
      );

      if (existingAuto.rowCount > 0) {
        await query(
          `UPDATE shipment_events
           SET event_time = NOW(),
               milestone = $1,
               notes = $2
           WHERE id = $3`,
          [autoMilestone, syncNote, existingAuto.rows[0].id]
        );

        // Keep only one auto-synced row per batch.
        await query(
          `DELETE FROM shipment_events
           WHERE batch_id = $1
             AND id <> $2
             AND notes LIKE 'Synced from batch status:%'`,
          [req.params.id, existingAuto.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO shipment_events
           (id, batch_id, milestone, event_time, location, notes, created_by)
           VALUES ($1, $2, $3, NOW(), $4, $5, $6)`,
          [
            crypto.randomUUID(),
            req.params.id,
            autoMilestone,
            null,
            syncNote,
            req.user.sub,
          ]
        );
      }
    }

    await logAudit(req.user.sub, "batch", req.params.id, "status_update", { status });
    await syncInternationalOrderFromBatches(existing.rows[0].international_order_id, req.user.sub);
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid status" });
    return next(error);
  }
});

router.post("/batch-items", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = batchItemSchema.parse(req.body);
    const batchResult = await query(
      `SELECT id, total_quantity, status
       FROM batches
       WHERE id = $1`,
      [data.batchId]
    );
    if (batchResult.rowCount === 0) {
      return res.status(404).json({ message: "Batch not found" });
    }
    const batch = batchResult.rows[0];
    if (["DISPATCHED", "SHIPPED", "DELIVERED"].includes(batch.status)) {
      return res.status(400).json({ message: "Cannot allocate to a dispatched/shipped/delivered batch" });
    }

    const fpoResult = await query(
      `SELECT actual_picked_quantity, quantity, status
       FROM farmer_purchase_orders
       WHERE id = $1`,
      [data.farmerPurchaseOrderId]
    );
    if (fpoResult.rowCount === 0) {
      return res.status(404).json({ message: "Farmer procurement order not found" });
    }

    const fpo = fpoResult.rows[0];
    if (!["CONFIRMED", "ALLOCATED"].includes(fpo.status)) {
      return res.status(400).json({
        message: "Only confirmed or allocated farmer orders can be allocated to a batch",
      });
    }

    const allocatedAgg = await query(
      `SELECT COALESCE(SUM(bi.accepted_quantity), 0) AS total_allocated
       FROM batch_items bi
       WHERE bi.farmer_purchase_order_id = $1`,
      [data.farmerPurchaseOrderId]
    );
    const alreadyAllocated = Number(allocatedAgg.rows[0]?.total_allocated || 0);
    const maxAllocatable = Number(fpo.actual_picked_quantity ?? fpo.quantity ?? 0);
    const nextAllocated = alreadyAllocated + Number(data.acceptedQuantity || 0);
    if (maxAllocatable > 0 && nextAllocated > maxAllocatable) {
      return res.status(400).json({
        message: `Allocation exceeds remaining quantity. Remaining is ${Math.max(
          maxAllocatable - alreadyAllocated,
          0
        )}`,
      });
    }

    const allocationAgg = await query(
      `SELECT
         COALESCE(
           SUM(
             CASE
               WHEN fpo.actual_picked_quantity IS NOT NULL
                 THEN fpo.actual_picked_quantity
               ELSE bi.accepted_quantity
             END
           ),
           0
         ) AS used_quantity
       FROM batch_items bi
       JOIN farmer_purchase_orders fpo ON fpo.id = bi.farmer_purchase_order_id
       WHERE bi.batch_id = $1`,
      [data.batchId]
    );
    const usedQuantity = Number(allocationAgg.rows[0]?.used_quantity || 0);
    const batchCapacity = Number(batch.total_quantity || 0);
    const nextUsed = usedQuantity + Number(data.acceptedQuantity || 0);
    if (batchCapacity > 0 && nextUsed > batchCapacity) {
      return res.status(400).json({
        message: `Batch capacity exceeded. Remaining capacity is ${Math.max(batchCapacity - usedQuantity, 0)}`,
      });
    }

    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO batch_items
       (id, batch_id, farmer_purchase_order_id, accepted_quantity, rejected_quantity, grade_result)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [id, data.batchId, data.farmerPurchaseOrderId, data.acceptedQuantity, data.rejectedQuantity, data.gradeResult ?? null]
    );

    await query(
      `UPDATE farmer_purchase_orders
       SET status = 'ALLOCATED',
           updated_at = NOW()
       WHERE id = $1
         AND status = 'CONFIRMED'`,
      [data.farmerPurchaseOrderId]
    );

    await logAudit(req.user.sub, "batch_item", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.patch("/batch-items/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const schema = z.object({
      acceptedQuantity: z.number().nonnegative().optional(),
      rejectedQuantity: z.number().nonnegative().optional(),
      gradeResult: z.string().optional(),
      actualPickedQuantity: z.number().nonnegative().optional(),
    });
    const data = schema.parse(req.body);

    const existing = await query(
      `SELECT bi.id, bi.farmer_purchase_order_id
       FROM batch_items bi
       WHERE bi.id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Batch allocation not found" });
    }

    const updated = await query(
      `UPDATE batch_items
       SET accepted_quantity = COALESCE($1, accepted_quantity),
           rejected_quantity = COALESCE($2, rejected_quantity),
           grade_result = COALESCE($3, grade_result)
       WHERE id = $4
       RETURNING *`,
      [
        data.acceptedQuantity ?? null,
        data.rejectedQuantity ?? null,
        data.gradeResult ?? null,
        req.params.id,
      ]
    );

    if (data.actualPickedQuantity !== undefined) {
      await query(
        `UPDATE farmer_purchase_orders
         SET actual_picked_quantity = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [data.actualPickedQuantity, existing.rows[0].farmer_purchase_order_id]
      );
    }

    await logAudit(req.user.sub, "batch_item", req.params.id, "update", data);
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.get("/batch-shipment-lots", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const params = [];
    let whereClause = "";
    if (req.query.batchId) {
      params.push(req.query.batchId);
      whereClause = "WHERE bsl.batch_id = $1";
    }
    const result = await query(
      `SELECT bsl.*, b.batch_code, io.buyer_name
       FROM batch_shipment_lots bsl
       JOIN batches b ON b.id = bsl.batch_id
       JOIN international_orders io ON io.id = b.international_order_id
       ${whereClause}
       ORDER BY bsl.created_at DESC`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/batch-shipment-lots", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = batchShipmentLotSchema.parse(req.body);
    const batchRes = await query(
      `SELECT id, batch_code, total_quantity, unit, status
       FROM batches
       WHERE id = $1`,
      [data.batchId]
    );
    if (batchRes.rowCount === 0) return res.status(404).json({ message: "Batch not found" });
    const batch = batchRes.rows[0];
    if (!["CREATED", "COLLECTING", "QA_PASSED", "DISPATCHED", "SHIPPED"].includes(batch.status)) {
      return res.status(400).json({ message: "Batch is not ready for shipment lots yet" });
    }

    const acceptedAgg = await query(
      `SELECT COALESCE(SUM(accepted_quantity), 0) AS accepted_total
       FROM batch_items
       WHERE batch_id = $1`,
      [data.batchId]
    );
    const lotAgg = await query(
      `SELECT COALESCE(SUM(quantity), 0) AS lots_total
       FROM batch_shipment_lots
       WHERE batch_id = $1`,
      [data.batchId]
    );
    const acceptedTotal = Number(acceptedAgg.rows[0]?.accepted_total || 0);
    const existingLotsTotal = Number(lotAgg.rows[0]?.lots_total || 0);
    const nextLotsTotal = existingLotsTotal + Number(data.quantity || 0);
    if (acceptedTotal <= 0) {
      return res.status(400).json({
        message: "No accepted quantity available yet. Run allocation QA first, then create a shipment lot.",
      });
    }
    if (nextLotsTotal > acceptedTotal) {
      return res.status(400).json({
        message: `Lot quantity exceeds available accepted quantity. Available is ${Math.max(
          acceptedTotal - existingLotsTotal,
          0
        )} ${batch.unit || data.unit || "kg"}.`,
      });
    }

    const id = crypto.randomUUID();
    const lotCountRes = await query(
      `SELECT COUNT(*)::int AS lot_count
       FROM batch_shipment_lots
       WHERE batch_id = $1`,
      [data.batchId]
    );
    const nextIndex = Number(lotCountRes.rows[0]?.lot_count || 0) + 1;
    const lotCode = `${batch.batch_code}-LOT-${String(nextIndex).padStart(3, "0")}`;
    const created = await query(
      `INSERT INTO batch_shipment_lots
       (id, batch_id, lot_code, quantity, unit, flight_number, awb_number, eta, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id,
        data.batchId,
        lotCode,
        data.quantity,
        data.unit || batch.unit || "kg",
        data.flightNumber ?? null,
        data.awbNumber ?? null,
        data.eta ? new Date(data.eta) : null,
        data.notes ?? null,
        req.user.sub,
      ]
    );
    await logAudit(req.user.sub, "batch_shipment_lot", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.patch("/batch-shipment-lots/:id/status", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const status = batchShipmentLotStatusSchema.parse(req.body.status);
    const existing = await query(
      `SELECT l.id, l.batch_id, l.status, b.international_order_id
       FROM batch_shipment_lots l
       JOIN batches b ON b.id = l.batch_id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) return res.status(404).json({ message: "Shipment lot not found" });

    const current = existing.rows[0];
    if (!canTransitionLotStatus(current.status, status)) {
      return res.status(400).json({
        message: `Invalid lot status transition from ${current.status} to ${status}. Follow CREATED -> DISPATCHED -> SHIPPED -> DELIVERED`,
      });
    }
    const updated = await query(
      `UPDATE batch_shipment_lots
       SET status = $1,
           shipped_at = CASE WHEN $1 = 'SHIPPED' THEN COALESCE(shipped_at, NOW()) ELSE shipped_at END,
           delivered_at = CASE WHEN $1 = 'DELIVERED' THEN COALESCE(delivered_at, NOW()) ELSE delivered_at END,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    await syncBatchStatusFromLots(current.batch_id, req.user.sub);
    await syncInternationalOrderFromBatches(current.international_order_id, req.user.sub);
    await logAudit(req.user.sub, "batch_shipment_lot", req.params.id, "status_update", {
      previousStatus: current.status,
      status,
    });
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid lot status" });
    return next(error);
  }
});

router.post("/quality-checks", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = qualityCheckSchema.parse(req.body);
    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO quality_checks
       (id, batch_id, stage, moisture_level, pesticide_passed, size_grade, notes, photo_url, inspector_user_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        id,
        data.batchId,
        data.stage,
        data.moistureLevel ?? null,
        data.pesticidePassed ?? null,
        data.sizeGrade ?? null,
        data.notes ?? null,
        data.photoUrl ?? null,
        req.user.sub,
      ]
    );
    await logAudit(req.user.sub, "quality_check", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.post("/payouts", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = payoutSchema.parse(req.body);
    const fpoResult = await query(
      `SELECT id, farmer_id, status
       FROM farmer_purchase_orders
       WHERE id = $1`,
      [data.farmerPurchaseOrderId]
    );
    if (fpoResult.rowCount === 0) {
      return res.status(404).json({ message: "Farmer procurement order not found" });
    }
    const fpo = fpoResult.rows[0];
    if (fpo.farmer_id !== data.farmerId) {
      return res.status(400).json({
        message: "Selected farmer does not match the selected procurement order",
      });
    }
    if (fpo.status !== "PICKED_UP") {
      return res.status(400).json({
        message: `Payout can only be created for collected orders (PICKED_UP). Current status is ${fpo.status}.`,
      });
    }

    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO payouts
       (id, farmer_purchase_order_id, farmer_id, amount, currency, payout_type, status, scheduled_for, paid_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        id,
        data.farmerPurchaseOrderId,
        data.farmerId,
        data.amount,
        data.currency,
        data.payoutType,
        data.status,
        data.scheduledFor ? new Date(data.scheduledFor) : null,
        data.paidAt ? new Date(data.paidAt) : null,
        data.notes ?? null,
      ]
    );
    await logAudit(req.user.sub, "payout", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.get("/payouts", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT p.*, u.name AS farmer_name, fpo.crop_type
       FROM payouts p
       JOIN users u ON u.id = p.farmer_id
       JOIN farmer_purchase_orders fpo ON fpo.id = p.farmer_purchase_order_id
       ORDER BY p.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.patch("/payouts/:id/status", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const status = payoutStatusSchema.parse(req.body.status);
    const existing = await query(
      `SELECT p.id, p.status, p.farmer_purchase_order_id, fpo.status AS procurement_status
       FROM payouts p
       JOIN farmer_purchase_orders fpo ON fpo.id = p.farmer_purchase_order_id
       WHERE p.id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Payout not found" });
    }

    const current = existing.rows[0];
    if (status === "PAID" && !["PICKED_UP", "SETTLED"].includes(current.procurement_status)) {
      return res.status(400).json({
        message: `Only collected or settled orders (PICKED_UP/SETTLED) can be marked as paid. Current procurement status is ${current.procurement_status}.`,
      });
    }
    const updated = await query(
      `UPDATE payouts
       SET status = $1,
           paid_at = CASE WHEN $1 = 'PAID' THEN NOW() ELSE paid_at END
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );

    if (status === "PAID") {
      await query(
        `UPDATE farmer_purchase_orders
         SET status = 'SETTLED',
             updated_at = NOW()
         WHERE id = $1
           AND status <> 'SETTLED'
           AND status <> 'REJECTED'`,
        [current.farmer_purchase_order_id]
      );
    }

    await logAudit(req.user.sub, "payout", req.params.id, "status_update", {
      previousStatus: current.status,
      status,
    });
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payout status" });
    return next(error);
  }
});

router.get("/payouts/mine", requireRole("FARMER"), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT
         p.*,
         fpo.crop_type,
         fpo.status AS procurement_status,
         CASE
           WHEN fpo.status = 'SETTLED' THEN 'PAID'
           ELSE p.status
         END AS effective_status
       FROM payouts p
       JOIN farmer_purchase_orders fpo ON fpo.id = p.farmer_purchase_order_id
       WHERE p.farmer_id = $1
       ORDER BY p.created_at DESC`,
      [req.user.sub]
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/farmer-finance-overview", requireRole("FARMER"), async (req, res, next) => {
  try {
    const usdToKesRate = Number(process.env.USD_TO_KES_RATE || 129);
    const eurToKesRate = Number(process.env.EUR_TO_KES_RATE || 140);
    const convertToKes = (amount, currency) => {
      const numeric = Number(amount || 0);
      const code = String(currency || "KES").toUpperCase();
      if (code === "USD") return numeric * usdToKesRate;
      if (code === "EUR") return numeric * eurToKesRate;
      return numeric;
    };

    const [payoutsAgg] = await Promise.all([
      query(
        `SELECT
           p.currency,
           COALESCE(
             SUM(
               CASE
                 WHEN p.status = 'PAID' OR fpo.status = 'SETTLED' THEN p.amount
                 ELSE 0
               END
             ),
             0
           ) AS total_earned_value,
           COALESCE(
             SUM(
               CASE
                 WHEN p.status IN ('PENDING','APPROVED') AND fpo.status <> 'SETTLED' THEN p.amount
                 ELSE 0
               END
             ),
             0
           ) AS pending_value,
           COALESCE(SUM(CASE WHEN payout_type = 'ADJUSTMENT' THEN amount ELSE 0 END),0) AS adjustments_value
         FROM payouts p
         JOIN farmer_purchase_orders fpo ON fpo.id = p.farmer_purchase_order_id
         WHERE p.farmer_id = $1
         GROUP BY p.currency`,
        [req.user.sub]
      ),
    ]);

    const summaryKes = payoutsAgg.rows.reduce(
      (acc, row) => {
        const currency = row.currency || "KES";
        acc.totalEarnedValue += convertToKes(row.total_earned_value, currency);
        acc.pendingValue += convertToKes(row.pending_value, currency);
        acc.adjustmentsValue += convertToKes(row.adjustments_value, currency);
        return acc;
      },
      { totalEarnedValue: 0, pendingValue: 0, adjustmentsValue: 0 }
    );

    return res.json({
      totalEarnedValue: Number(summaryKes.totalEarnedValue || 0),
      pendingValue: Number(summaryKes.pendingValue || 0),
      adjustmentsValue: Number(summaryKes.adjustmentsValue || 0),
      displayCurrency: "KES",
      fxRates: {
        USD_KES: usdToKesRate,
        EUR_KES: eurToKesRate,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/cost-entries", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = costEntrySchema.parse(req.body);
    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO cost_entries
       (id, international_order_id, batch_id, cost_type, amount, currency, vendor_name, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        id,
        data.internationalOrderId,
        data.batchId ?? null,
        data.costType,
        data.amount,
        data.currency,
        data.vendorName ?? null,
        data.notes ?? null,
      ]
    );
    await logAudit(req.user.sub, "cost_entry", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.get("/cost-entries", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT ce.*, io.buyer_name, io.crop_type AS int_crop_type
       FROM cost_entries ce
       JOIN international_orders io ON io.id = ce.international_order_id
       ORDER BY ce.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/finance-overview", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const usdToKesRate = Number(process.env.USD_TO_KES_RATE || 129);
    const eurToKesRate = Number(process.env.EUR_TO_KES_RATE || 140);
    const convertToUsd = (amount, currency) => {
      const numeric = Number(amount || 0);
      const code = String(currency || "USD").toUpperCase();
      if (code === "KES") return usdToKesRate > 0 ? numeric / usdToKesRate : 0;
      if (code === "EUR") return eurToKesRate > 0 ? numeric * (usdToKesRate / eurToKesRate) : 0;
      return numeric;
    };

    const [payoutsAgg, payoutCurrencyAgg, costsAgg, openOrdersAgg] = await Promise.all([
      query(
        `SELECT
           COALESCE(SUM(amount),0) AS total_payout_value,
           COALESCE(SUM(CASE WHEN status IN ('PENDING','APPROVED') THEN amount ELSE 0 END),0) AS pending_payout_value
         FROM payouts`
      ),
      query(
        `SELECT
           currency,
           COALESCE(SUM(amount),0) AS total_value,
           COALESCE(SUM(CASE WHEN status IN ('PENDING','APPROVED') THEN amount ELSE 0 END),0) AS pending_value,
           COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END),0) AS paid_value
         FROM payouts
         GROUP BY currency`
      ),
      query(
        `SELECT
           COALESCE(SUM(amount),0) AS total_cost_value
         FROM cost_entries`
      ),
      query(
        `SELECT
           COUNT(*) AS open_international_orders
         FROM international_orders
         WHERE status IN ('OPEN','PROCUREMENT','PARTIALLY_SHIPPED')`
      ),
    ]);

    const payoutByCurrency = payoutCurrencyAgg.rows.reduce(
      (acc, row) => {
        const key = row.currency || "KES";
        acc.total[key] = Number(row.total_value || 0);
        acc.pending[key] = Number(row.pending_value || 0);
        acc.paid[key] = Number(row.paid_value || 0);
        return acc;
      },
      { total: {}, pending: {}, paid: {} }
    );

    const totalPayoutValueUsd = Object.entries(payoutByCurrency.total || {}).reduce(
      (sum, [currency, value]) => sum + convertToUsd(value, currency),
      0
    );
    const pendingPayoutValueUsd = Object.entries(payoutByCurrency.pending || {}).reduce(
      (sum, [currency, value]) => sum + convertToUsd(value, currency),
      0
    );
    const settledToFarmersKes = Object.entries(payoutByCurrency.paid || {}).reduce((sum, [currency, value]) => {
      const code = String(currency || "KES").toUpperCase();
      if (code === "KES") return sum + Number(value || 0);
      if (code === "USD") return sum + Number(value || 0) * usdToKesRate;
      if (code === "EUR") return sum + Number(value || 0) * eurToKesRate;
      return sum;
    }, 0);

    return res.json({
      totalPayoutValue: Number(payoutsAgg.rows[0].total_payout_value || 0),
      pendingPayoutValue: Number(payoutsAgg.rows[0].pending_payout_value || 0),
      totalPayoutByCurrency: payoutByCurrency.total,
      pendingPayoutByCurrency: payoutByCurrency.pending,
      paidPayoutByCurrency: payoutByCurrency.paid,
      totalPayoutValueUsd: Number(totalPayoutValueUsd || 0),
      pendingPayoutValueUsd: Number(pendingPayoutValueUsd || 0),
      settledToFarmersKes: Number(settledToFarmersKes || 0),
      exchangeRates: {
        USD_KES: usdToKesRate,
        EUR_KES: eurToKesRate,
      },
      totalCostValue: Number(costsAgg.rows[0].total_cost_value || 0),
      openInternationalOrders: Number(openOrdersAgg.rows[0].open_international_orders || 0),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/kpis", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const usdToKesRate = Number(process.env.USD_TO_KES_RATE || 129);
    const eurToKesRate = Number(process.env.EUR_TO_KES_RATE || 140);
    const convertToUsd = (amount, currency) => {
      const numeric = Number(amount || 0);
      const code = String(currency || "USD").toUpperCase();
      if (code === "KES") return usdToKesRate > 0 ? numeric / usdToKesRate : 0;
      if (code === "EUR") return eurToKesRate > 0 ? numeric * (usdToKesRate / eurToKesRate) : 0;
      return numeric;
    };

    const [todayPickups, inTransitBatches, delayedShipments, pendingPayouts, exposure] = await Promise.all([
      query(
        `SELECT COUNT(*)::int AS value
         FROM farmer_purchase_orders
         WHERE status = 'READY_FOR_PICKUP'`
      ),
      query(
        `SELECT COUNT(*)::int AS value
         FROM batches
         WHERE status IN ('DISPATCHED', 'SHIPPED')`
      ),
      query(
        `SELECT COUNT(*)::int AS value
         FROM order_shipments
         WHERE tracking_status = 'DELAYED'`
      ),
      query(
        `SELECT currency, COALESCE(SUM(amount),0) AS value
         FROM payouts
         WHERE status IN ('PENDING', 'APPROVED')
         GROUP BY currency`
      ),
      query(
        `SELECT
           COALESCE((SELECT SUM(required_quantity * COALESCE(target_price,0)) FROM international_orders WHERE status IN ('OPEN','PROCUREMENT','PARTIALLY_SHIPPED')),0)
           AS value`
      ),
    ]);

    const pendingPayoutsValueUsd = (pendingPayouts.rows || []).reduce(
      (sum, row) => sum + convertToUsd(row.value, row.currency),
      0
    );

    return res.json({
      todaysPickups: Number(todayPickups.rows[0]?.value || 0),
      inTransitBatches: Number(inTransitBatches.rows[0]?.value || 0),
      delayedShipments: Number(delayedShipments.rows[0]?.value || 0),
      pendingPayoutsValueUsd: Number(pendingPayoutsValueUsd || 0),
      outstandingExposureValue: Number(exposure.rows[0]?.value || 0),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/shipment-events", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const latestOnly = String(req.query.latestOnly ?? "true").toLowerCase() !== "false";
    const params = [];
    let whereClause = "";
    if (req.query.batchId) {
      params.push(req.query.batchId);
      whereClause = "WHERE se.batch_id = $1";
    }

    const sql = latestOnly
      ? `SELECT *
         FROM (
           SELECT se.*, b.batch_code, b.crop_type, io.buyer_name,
                  ROW_NUMBER() OVER (PARTITION BY se.batch_id ORDER BY se.event_time DESC, se.created_at DESC) AS rn
           FROM shipment_events se
           JOIN batches b ON b.id = se.batch_id
           JOIN international_orders io ON io.id = b.international_order_id
           ${whereClause}
         ) q
         WHERE q.rn = 1
         ORDER BY q.event_time DESC, q.created_at DESC`
      : `SELECT se.*, b.batch_code, b.crop_type, io.buyer_name
         FROM shipment_events se
         JOIN batches b ON b.id = se.batch_id
         JOIN international_orders io ON io.id = b.international_order_id
         ${whereClause}
         ORDER BY se.event_time DESC, se.created_at DESC`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/shipment-events", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = shipmentEventSchema.parse(req.body);
    const existing = await query(
      `SELECT id
       FROM shipment_events
       WHERE batch_id = $1
       ORDER BY event_time DESC, created_at DESC
       LIMIT 1`,
      [data.batchId]
    );

    const payload = [
      data.milestone,
      data.eventTime ? new Date(data.eventTime) : new Date(),
      data.location ?? null,
      data.notes ?? null,
      req.user.sub,
    ];

    if (existing.rowCount > 0) {
      const updated = await query(
        `UPDATE shipment_events
         SET milestone = $1,
             event_time = $2,
             location = $3,
             notes = $4,
             created_by = $5
         WHERE id = $6
         RETURNING *`,
        [...payload, existing.rows[0].id]
      );
      await logAudit(req.user.sub, "shipment_event", existing.rows[0].id, "update", data);
      return res.json(updated.rows[0]);
    }

    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO shipment_events
       (id, batch_id, milestone, event_time, location, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [id, data.batchId, ...payload]
    );
    await logAudit(req.user.sub, "shipment_event", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.get("/audit-events", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const params = [];
    const clauses = [];

    if (req.query.entityType) {
      params.push(String(req.query.entityType));
      clauses.push(`ae.entity_type = $${params.length}`);
    }

    if (req.query.entityId) {
      params.push(String(req.query.entityId));
      clauses.push(`ae.entity_id = $${params.length}`);
    }

    if (req.query.actorUserId) {
      params.push(String(req.query.actorUserId));
      clauses.push(`ae.actor_user_id = $${params.length}`);
    }

    if (req.query.from) {
      params.push(new Date(String(req.query.from)));
      clauses.push(`ae.created_at >= $${params.length}`);
    }

    if (req.query.to) {
      params.push(new Date(String(req.query.to)));
      clauses.push(`ae.created_at <= $${params.length}`);
    }

    const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limitRaw = Number(req.query.limit || 200);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 200;
    params.push(limit);

    const result = await query(
      `SELECT ae.id,
              ae.actor_user_id,
              u.name AS actor_name,
              u.email AS actor_email,
              ae.entity_type,
              ae.entity_id,
              ae.action,
              ae.payload,
              ae.created_at
       FROM audit_events ae
       LEFT JOIN users u ON u.id = ae.actor_user_id
       ${whereClause}
       ORDER BY ae.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/financier-readiness", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const [ordersAgg, payoutsAgg, batchAgg, shipmentAgg, worthAgg] = await Promise.all([
      query(
        `SELECT
           COUNT(*)::int AS total_international_orders,
           COUNT(*) FILTER (WHERE status IN ('OPEN','PROCUREMENT','PARTIALLY_SHIPPED'))::int AS open_international_orders,
           COALESCE(SUM(CASE WHEN status IN ('OPEN','PROCUREMENT','PARTIALLY_SHIPPED') THEN required_quantity * COALESCE(target_price,0) ELSE 0 END),0) AS open_order_value
         FROM international_orders`
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_payout_records,
           COUNT(*) FILTER (WHERE status IN ('PENDING','APPROVED'))::int AS pending_payout_records,
           COALESCE(SUM(CASE WHEN status IN ('PENDING','APPROVED') THEN amount ELSE 0 END),0) AS pending_payout_value
         FROM payouts`
      ),
      query(
        `SELECT
           COUNT(*)::int AS total_batches,
           COUNT(*) FILTER (WHERE status IN ('DISPATCHED','SHIPPED'))::int AS in_transit_batches,
           COUNT(*) FILTER (WHERE status = 'DELIVERED')::int AS delivered_batches
         FROM batches`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE tracking_status = 'DELAYED')::int AS delayed_shipments,
           COUNT(*)::int AS tracked_shipments
         FROM order_shipments`
      ),
      query(
        `WITH per_order AS (
           SELECT
             io.id,
             io.required_quantity,
             COALESCE(io.target_price, 0) AS target_price,
             COALESCE(io.updated_at, io.created_at) AS event_time,
             (
               COALESCE((SELECT SUM(COALESCE(b.total_quantity, 0)) FROM batches b WHERE b.international_order_id = io.id AND b.status IN ('SHIPPED','DELIVERED')), 0)
               +
               COALESCE((
                 SELECT SUM(COALESCE(l.quantity, 0))
                 FROM batch_shipment_lots l
                 JOIN batches b2 ON b2.id = l.batch_id
                 WHERE b2.international_order_id = io.id
                   AND b2.status NOT IN ('SHIPPED','DELIVERED')
                   AND l.status IN ('DISPATCHED','SHIPPED','DELIVERED')
               ), 0)
             ) AS shipped_quantity,
             (
               COALESCE((SELECT SUM(COALESCE(b.total_quantity, 0)) FROM batches b WHERE b.international_order_id = io.id AND b.status = 'DELIVERED'), 0)
               +
               COALESCE((
                 SELECT SUM(COALESCE(l.quantity, 0))
                 FROM batch_shipment_lots l
                 JOIN batches b2 ON b2.id = l.batch_id
                 WHERE b2.international_order_id = io.id
                   AND b2.status <> 'DELIVERED'
                   AND l.status = 'DELIVERED'
               ), 0)
             ) AS delivered_quantity
           FROM international_orders io
         )
         SELECT
           COALESCE(
             SUM(
               CASE
                 WHEN DATE_TRUNC('year', event_time) = DATE_TRUNC('year', CURRENT_DATE)
                 THEN LEAST(COALESCE(required_quantity, 0), shipped_quantity) * target_price
                 ELSE 0
               END
             ),
             0
           ) AS trade_worth_moved_ytd,
           COALESCE(
             SUM(
               CASE
                 WHEN DATE_TRUNC('year', event_time) = DATE_TRUNC('year', CURRENT_DATE)
                 THEN GREATEST(LEAST(COALESCE(required_quantity, 0), shipped_quantity) - LEAST(COALESCE(required_quantity, 0), delivered_quantity), 0) * target_price
                 ELSE 0
               END
             ),
             0
           ) AS in_transit_worth_ytd,
           COALESCE(
             SUM(
               CASE
                 WHEN DATE_TRUNC('year', event_time) = DATE_TRUNC('year', CURRENT_DATE)
                 THEN LEAST(COALESCE(required_quantity, 0), delivered_quantity) * target_price
                 ELSE 0
               END
             ),
             0
           ) AS delivered_worth_ytd
         FROM per_order`
      ),
    ]);

    return res.json({
      totalInternationalOrders: Number(ordersAgg.rows[0]?.total_international_orders || 0),
      openInternationalOrders: Number(ordersAgg.rows[0]?.open_international_orders || 0),
      openOrderValue: Number(ordersAgg.rows[0]?.open_order_value || 0),
      totalPayoutRecords: Number(payoutsAgg.rows[0]?.total_payout_records || 0),
      pendingPayoutRecords: Number(payoutsAgg.rows[0]?.pending_payout_records || 0),
      pendingPayoutValue: Number(payoutsAgg.rows[0]?.pending_payout_value || 0),
      totalBatches: Number(batchAgg.rows[0]?.total_batches || 0),
      inTransitBatches: Number(batchAgg.rows[0]?.in_transit_batches || 0),
      deliveredBatches: Number(batchAgg.rows[0]?.delivered_batches || 0),
      delayedShipments: Number(shipmentAgg.rows[0]?.delayed_shipments || 0),
      trackedShipments: Number(shipmentAgg.rows[0]?.tracked_shipments || 0),
      tradeWorthMovedYtd: Number(worthAgg.rows[0]?.trade_worth_moved_ytd || 0),
      inTransitWorthYtd: Number(worthAgg.rows[0]?.in_transit_worth_ytd || 0),
      deliveredWorthYtd: Number(worthAgg.rows[0]?.delivered_worth_ytd || 0),
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/dispute-cases", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT dc.*,
              io.buyer_name,
              io.crop_type AS int_crop_type,
              u.name AS owner_name
       FROM dispute_cases dc
       LEFT JOIN international_orders io ON io.id = dc.international_order_id
       LEFT JOIN users u ON u.id = dc.owner_user_id
       ORDER BY
         CASE dc.status
           WHEN 'OPEN' THEN 1
           WHEN 'IN_REVIEW' THEN 2
           WHEN 'RESOLVED' THEN 3
           ELSE 4
         END,
         dc.created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/dispute-cases", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = disputeCaseSchema.parse(req.body);
    const id = crypto.randomUUID();
    const created = await query(
      `INSERT INTO dispute_cases
       (id, case_type, title, description, severity, status, international_order_id, farmer_purchase_order_id, batch_id, owner_user_id, due_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        id,
        data.caseType,
        data.title,
        data.description ?? null,
        data.severity,
        "OPEN",
        data.internationalOrderId ?? null,
        data.farmerPurchaseOrderId ?? null,
        data.batchId ?? null,
        data.ownerUserId ?? null,
        data.dueAt ? new Date(data.dueAt) : null,
        req.user.sub,
      ]
    );
    await logAudit(req.user.sub, "dispute_case", id, "create", data);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

router.patch("/dispute-cases/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = disputeCaseUpdateSchema.parse(req.body);
    const existing = await query("SELECT id, status FROM dispute_cases WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) return res.status(404).json({ message: "Dispute case not found" });

    const resolvedAt =
      data.status === "RESOLVED" || data.status === "CLOSED"
        ? new Date()
        : null;

    const updated = await query(
      `UPDATE dispute_cases
       SET status = COALESCE($1, status),
           owner_user_id = COALESCE($2, owner_user_id),
           resolution_notes = COALESCE($3, resolution_notes),
           due_at = COALESCE($4, due_at),
           resolved_at = COALESCE($5, resolved_at),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        data.status ?? null,
        data.ownerUserId ?? null,
        data.resolutionNotes ?? null,
        data.dueAt ? new Date(data.dueAt) : null,
        resolvedAt,
        req.params.id,
      ]
    );
    await logAudit(req.user.sub, "dispute_case", req.params.id, "update", data);
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") return res.status(400).json({ message: "Invalid payload", details: error.errors });
    return next(error);
  }
});

export default router;

