import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const orderStatuses = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "SHIPPED", "COMPLETED", "CANCELLED"];
const statusSchema = z.enum(orderStatuses);
const trackingStatusSchema = z.enum(["PENDING", "BOOKED", "IN_AIR", "LANDED", "DELIVERED", "DELAYED"]);

const createOrderSchema = z.object({
  listingId: z.string().min(1),
  requestedQty: z.number().positive(),
  unit: z.string().min(1),
  offerPrice: z.number().nonnegative(),
  currency: z.string().default("USD"),
});

const shipmentUpsertSchema = z
  .object({
    airline: z.string().optional(),
    flightNumber: z.string().optional(),
    awbNumber: z.string().optional(),
    departureAirport: z.string().optional(),
    arrivalAirport: z.string().optional(),
    eta: z.string().optional(),
    trackingStatus: trackingStatusSchema.default("BOOKED"),
    trackingReference: z.string().optional(),
  })
  .refine((data) => data.flightNumber || data.awbNumber || data.trackingReference, {
    message: "Provide at least flightNumber, awbNumber, or trackingReference",
  });

const trackingUpdateSchema = z.object({
  trackingStatus: trackingStatusSchema,
  eta: z.string().optional(),
  trackingReference: z.string().optional(),
});
const createDocumentSchema = z.object({
  docType: z.string().min(2),
  docUrl: z.string().min(1),
  providedBy: z.string().min(2).default("CONSYN-AIR"),
  verified: z.boolean().optional(),
});

function canTransition(currentStatus, nextStatus) {
  const transitions = {
    REQUESTED: new Set(["ACCEPTED", "CANCELLED"]),
    ACCEPTED: new Set(["IN_PROGRESS", "CANCELLED"]),
    IN_PROGRESS: new Set(["SHIPPED", "CANCELLED"]),
    SHIPPED: new Set(["COMPLETED", "CANCELLED"]),
    COMPLETED: new Set([]),
    CANCELLED: new Set([]),
  };

  if (currentStatus === nextStatus) return true;
  return transitions[currentStatus]?.has(nextStatus) || false;
}

async function loadOrderById(orderId) {
  const result = await query(
    `SELECT id, buyer_id, farmer_id, status, export_path, service_fee
     FROM orders
     WHERE id = $1`,
    [orderId]
  );
  return result.rowCount === 0 ? null : result.rows[0];
}

function ensureOrderAccess(order, user) {
  if (user.role === "ADMIN") return true;
  if (user.role === "FARMER" && order.farmer_id === user.sub) return true;
  return false;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    let whereClause = "";
    const params = [];

    if (req.user.role === "FARMER") {
      whereClause = "WHERE o.farmer_id = $1";
      params.push(req.user.sub);
    }

    const sql = `
      SELECT
        o.*,
        l.title AS listing_title,
        b.name AS buyer_name,
        b.email AS buyer_email,
        f.name AS farmer_name,
        f.email AS farmer_email,
        s.id AS shipment_id,
        s.airline AS shipment_airline,
        s.flight_number AS shipment_flight_number,
        s.awb_number AS shipment_awb_number,
        s.departure_airport AS shipment_departure_airport,
        s.arrival_airport AS shipment_arrival_airport,
        s.eta AS shipment_eta,
        s.tracking_status AS shipment_tracking_status,
        s.tracking_reference AS shipment_tracking_reference,
        s.tracking_last_updated AS shipment_tracking_last_updated
      FROM orders o
      JOIN listings l ON l.id = o.listing_id
      JOIN users b ON b.id = o.buyer_id
      JOIN users f ON f.id = o.farmer_id
      LEFT JOIN order_shipments s ON s.order_id = o.id
      ${whereClause}
      ORDER BY o.created_at DESC`;

    const orders = await query(sql, params);
    return res.json(orders.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id/shipment", requireAuth, async (req, res, next) => {
  try {
    const order = await loadOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (!ensureOrderAccess(order, req.user)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const shipment = await query("SELECT * FROM order_shipments WHERE order_id = $1", [req.params.id]);
    if (shipment.rowCount === 0) {
      return res.status(404).json({ message: "Shipment not found for this order" });
    }

    return res.json(shipment.rows[0]);
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);

    const listingResult = await query("SELECT id, farmer_id, status FROM listings WHERE id = $1", [data.listingId]);

    if (listingResult.rowCount === 0 || listingResult.rows[0].status !== "PUBLISHED") {
      return res.status(404).json({ message: "Listing not available" });
    }

    const listing = listingResult.rows[0];
    const orderId = crypto.randomUUID();

    const order = await query(
      `INSERT INTO orders
       (id, listing_id, buyer_id, farmer_id, requested_qty, unit, offer_price, currency, export_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        orderId,
        listing.id,
        req.user.sub,
        listing.farmer_id,
        data.requestedQty,
        data.unit,
        data.offerPrice,
        data.currency,
        "CONSYNAIR_MANAGED",
      ]
    );
    await logAudit(req.user.sub, "order", orderId, "create", data);

    return res.status(201).json(order.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.patch("/:id/status", requireAuth, requireRole("ADMIN", "FARMER"), async (req, res, next) => {
  try {
    const status = statusSchema.parse(req.body.status);
    const order = await loadOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role === "FARMER") {
      if (order.farmer_id !== req.user.sub) {
        return res.status(403).json({ message: "You can only update your own orders" });
      }
      if (status !== "SHIPPED") {
        return res.status(403).json({ message: "Farmers can only mark orders as SHIPPED" });
      }
    }

    if (!canTransition(order.status, status)) {
      return res.status(400).json({
        message: `Invalid status transition from ${order.status} to ${status}`,
      });
    }

    const updated = await query(
      `UPDATE orders
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );
    await logAudit(req.user.sub, "order", req.params.id, "status_update", { status });

    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid status" });
    }
    return next(error);
  }
});

router.patch("/:id/fee", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const serviceFee = z.number().min(0).parse(req.body.serviceFee);

    const existing = await query("SELECT id FROM orders WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Order not found" });
    }

    const updated = await query(
      `UPDATE orders
       SET service_fee = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [serviceFee, req.params.id]
    );
    await logAudit(req.user.sub, "order", req.params.id, "fee_update", { serviceFee });

    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid service fee" });
    }
    return next(error);
  }
});

router.post("/:id/shipment", requireAuth, requireRole("ADMIN", "FARMER"), async (req, res, next) => {
  try {
    const payload = shipmentUpsertSchema.parse(req.body);
    const order = await loadOrderById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role === "FARMER" && order.farmer_id !== req.user.sub) {
      return res.status(403).json({ message: "You can only add shipment details to your own orders" });
    }

    if (order.status !== "SHIPPED") {
      return res.status(400).json({ message: "Order must be SHIPPED before shipment details are added" });
    }

    const shipmentId = crypto.randomUUID();
    const shipment = await query(
      `INSERT INTO order_shipments
       (id, order_id, airline, flight_number, awb_number, departure_airport, arrival_airport, eta, tracking_status, tracking_reference, tracking_last_updated)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (order_id) DO UPDATE SET
         airline = EXCLUDED.airline,
         flight_number = EXCLUDED.flight_number,
         awb_number = EXCLUDED.awb_number,
         departure_airport = EXCLUDED.departure_airport,
         arrival_airport = EXCLUDED.arrival_airport,
         eta = EXCLUDED.eta,
         tracking_status = EXCLUDED.tracking_status,
         tracking_reference = EXCLUDED.tracking_reference,
         tracking_last_updated = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [
        shipmentId,
        req.params.id,
        payload.airline ?? null,
        payload.flightNumber ?? null,
        payload.awbNumber ?? null,
        payload.departureAirport ?? null,
        payload.arrivalAirport ?? null,
        payload.eta ? new Date(payload.eta) : null,
        payload.trackingStatus,
        payload.trackingReference ?? null,
      ]
    );

    // Auto-workflow: shipment creation/upsert moves order to SHIPPED.
    await query(
      `UPDATE orders
       SET status = 'SHIPPED', updated_at = NOW()
       WHERE id = $1 AND status IN ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS')`,
      [req.params.id]
    );
    await logAudit(req.user.sub, "order_shipment", req.params.id, "upsert", payload);

    return res.status(201).json(shipment.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid shipment details", details: error.errors });
    }
    return next(error);
  }
});

router.patch("/:id/shipment/tracking", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const payload = trackingUpdateSchema.parse(req.body);
    const existing = await query("SELECT id FROM order_shipments WHERE order_id = $1", [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Shipment not found for this order" });
    }

    const updated = await query(
      `UPDATE order_shipments
       SET tracking_status = $1,
           eta = COALESCE($2, eta),
           tracking_reference = COALESCE($3, tracking_reference),
           tracking_last_updated = NOW(),
           updated_at = NOW()
       WHERE order_id = $4
       RETURNING *`,
      [
        payload.trackingStatus,
        payload.eta ? new Date(payload.eta) : null,
        payload.trackingReference ?? null,
        req.params.id,
      ]
    );

    // Auto-workflow: delivered tracking closes order.
    if (payload.trackingStatus === "DELIVERED") {
      await query(
        `UPDATE orders
         SET status = 'COMPLETED', updated_at = NOW()
         WHERE id = $1 AND status IN ('SHIPPED', 'IN_PROGRESS', 'ACCEPTED')`,
        [req.params.id]
      );
    }
    await logAudit(req.user.sub, "order_shipment", req.params.id, "tracking_update", payload);

    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid tracking update", details: error.errors });
    }
    return next(error);
  }
});

router.get("/:id/documents", requireAuth, async (req, res, next) => {
  try {
    const order = await loadOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (!ensureOrderAccess(order, req.user)) return res.status(403).json({ message: "Forbidden" });

    const docs = await query(
      `SELECT id, order_id, doc_type, doc_url, provided_by, verified, created_at
       FROM order_documents
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );
    return res.json(docs.rows);
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/documents", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const payload = createDocumentSchema.parse(req.body);
    const order = await loadOrderById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    const created = await query(
      `INSERT INTO order_documents (id, order_id, doc_type, doc_url, provided_by, verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, order_id, doc_type, doc_url, provided_by, verified, created_at`,
      [crypto.randomUUID(), req.params.id, payload.docType, payload.docUrl, payload.providedBy, Boolean(payload.verified)]
    );
    await logAudit(req.user.sub, "order_document", created.rows[0].id, "create", payload);
    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid document payload", details: error.errors });
    }
    return next(error);
  }
});

router.patch("/:id/documents/:docId", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const verified = z.boolean().parse(req.body.verified);
    const updated = await query(
      `UPDATE order_documents
       SET verified = $1
       WHERE id = $2 AND order_id = $3
       RETURNING id, order_id, doc_type, doc_url, provided_by, verified, created_at`,
      [verified, req.params.docId, req.params.id]
    );
    if (updated.rowCount === 0) return res.status(404).json({ message: "Document not found" });
    await logAudit(req.user.sub, "order_document", req.params.docId, "verify_update", { verified });
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid verified flag" });
    }
    return next(error);
  }
});

export default router;
