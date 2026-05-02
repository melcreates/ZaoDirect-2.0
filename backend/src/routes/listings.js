import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { query } from "../db/pool.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { logAudit } from "../utils/audit.js";

const router = Router();

const listingSchema = z.object({
  title: z.string().min(2),
  category: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  pricePerUnit: z.number().nonnegative(),
  currency: z.string().default("USD"),
  county: z.string().optional(),
  availableFrom: z.string().optional(),
  photoUrls: z.array(z.string().min(1)).max(8).default([]),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

const listingUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  category: z.string().optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().min(1).optional(),
  pricePerUnit: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  county: z.string().optional(),
  availableFrom: z.string().optional(),
  photoUrls: z.array(z.string().min(1)).max(8).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

router.get("/", async (req, res, next) => {
  try {
    const status = req.query.status;
    const params = [];
    let whereClause = "";

    if (status) {
      params.push(status);
      whereClause = "WHERE l.status = $1";
    }

    const sql = `
      SELECT
        l.id,
        l.farmer_id,
        l.title,
        l.category,
        l.quantity,
        l.unit,
        l.price_per_unit,
        l.currency,
        l.county,
        l.available_from,
        l.photo_urls,
        l.export_mode,
        l.status,
        l.created_at,
        l.updated_at,
        u.name AS farmer_name,
        u.email AS farmer_email
      FROM listings l
      JOIN users u ON u.id = l.farmer_id
      ${whereClause}
      ORDER BY l.created_at DESC`;

    const result = await query(sql, params);
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", requireAuth, requireRole("FARMER", "ADMIN"), async (req, res, next) => {
  try {
    const result = await query(
      `SELECT l.*, u.name AS farmer_name, u.email AS farmer_email
       FROM listings l
       JOIN users u ON u.id = l.farmer_id
       WHERE l.id = $1`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }
    const listing = result.rows[0];
    if (req.user.role !== "ADMIN" && listing.farmer_id !== req.user.sub) {
      return res.status(403).json({ message: "You can only view your own listings" });
    }
    return res.json(listing);
  } catch (error) {
    return next(error);
  }
});

router.post("/", requireAuth, requireRole("FARMER", "ADMIN"), async (req, res, next) => {
  try {
    const data = listingSchema.parse(req.body);
    const listingId = crypto.randomUUID();

    const result = await query(
      `INSERT INTO listings
       (id, farmer_id, title, category, quantity, unit, price_per_unit, currency, county, available_from, photo_urls, export_mode, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
       RETURNING *`,
      [
        listingId,
        req.user.sub,
        data.title,
        data.category ?? null,
        data.quantity,
        data.unit,
        data.pricePerUnit,
        data.currency,
        data.county ?? null,
        data.availableFrom ? new Date(data.availableFrom) : null,
        JSON.stringify(data.photoUrls || []),
        "CONSYNAIR_MANAGED",
        data.status,
      ]
    );
    await logAudit(req.user.sub, "listing", listingId, "create", data);

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.patch("/:id/status", requireAuth, requireRole("FARMER", "ADMIN"), async (req, res, next) => {
  try {
    const status = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).parse(req.body.status);

    const listingResult = await query("SELECT id, farmer_id FROM listings WHERE id = $1", [req.params.id]);
    if (listingResult.rowCount === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const listing = listingResult.rows[0];
    if (req.user.role !== "ADMIN" && listing.farmer_id !== req.user.sub) {
      return res.status(403).json({ message: "You can only update your own listings" });
    }

    const updated = await query(
      `UPDATE listings
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );
    await logAudit(req.user.sub, "listing", req.params.id, "status_update", { status });

    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid status" });
    }
    return next(error);
  }
});

router.patch("/:id", requireAuth, requireRole("FARMER", "ADMIN"), async (req, res, next) => {
  try {
    const data = listingUpdateSchema.parse(req.body);
    const existing = await query("SELECT id, farmer_id FROM listings WHERE id = $1", [req.params.id]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const listing = existing.rows[0];
    if (req.user.role !== "ADMIN" && listing.farmer_id !== req.user.sub) {
      return res.status(403).json({ message: "You can only update your own listings" });
    }

    const updated = await query(
      `UPDATE listings
       SET title = COALESCE($1, title),
           category = COALESCE($2, category),
           quantity = COALESCE($3, quantity),
           unit = COALESCE($4, unit),
           price_per_unit = COALESCE($5, price_per_unit),
           currency = COALESCE($6, currency),
           county = COALESCE($7, county),
           available_from = COALESCE($8, available_from),
           photo_urls = COALESCE($9::jsonb, photo_urls),
           status = COALESCE($10, status),
           updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        data.title ?? null,
        data.category ?? null,
        data.quantity ?? null,
        data.unit ?? null,
        data.pricePerUnit ?? null,
        data.currency ?? null,
        data.county ?? null,
        data.availableFrom ? new Date(data.availableFrom) : null,
        data.photoUrls ? JSON.stringify(data.photoUrls) : null,
        data.status ?? null,
        req.params.id,
      ]
    );

    await logAudit(req.user.sub, "listing", req.params.id, "update", data);
    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("FARMER", "ADMIN"), async (req, res, next) => {
  try {
    const listingResult = await query(
      "SELECT id, farmer_id, status FROM listings WHERE id = $1",
      [req.params.id]
    );
    if (listingResult.rowCount === 0) {
      return res.status(404).json({ message: "Listing not found" });
    }

    const listing = listingResult.rows[0];
    if (req.user.role !== "ADMIN" && listing.farmer_id !== req.user.sub) {
      return res.status(403).json({ message: "You can only delete your own listings" });
    }
    if (!["DRAFT", "PUBLISHED"].includes(listing.status)) {
      return res.status(400).json({
        message: `Only Draft or Published listings can be deleted. Current status is ${listing.status}.`,
      });
    }

    await query("DELETE FROM listings WHERE id = $1", [req.params.id]);
    await logAudit(req.user.sub, "listing", req.params.id, "delete", { status: listing.status });
    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;
