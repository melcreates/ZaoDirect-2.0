import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { query, withTransaction } from "../db/pool.js";
import { requireAuth, requireRole, signToken } from "../middleware/auth.js";

const router = Router();

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["FARMER", "ADMIN"]).default("FARMER"),
  phone: z.string().optional(),
  country: z.string().optional(),
  farmName: z.string().optional(),
  county: z.string().optional(),
  hasExportDocs: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  country: z.string().optional(),
  password: z.string().min(6).optional(),
  farmName: z.string().optional(),
  county: z.string().optional(),
  hasExportDocs: z.boolean().optional(),
  certifications: z.string().optional(),
});

const updateAvatarSchema = z.object({
  imageUrl: z.string().min(1),
});

const createAssetSchema = z.object({
  type: z.enum(["DOCUMENT", "PHOTO"]),
  name: z.string().min(1),
  fileUrl: z.string().min(1),
});
const adminUpdateUserSchema = z
  .object({
    role: z.enum(["FARMER", "ADMIN"]).optional(),
    isActive: z.boolean().optional(),
    verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]).optional(),
  })
  .refine((payload) => payload.role !== undefined || payload.isActive !== undefined || payload.verificationStatus !== undefined, {
    message: "Provide at least one field to update",
  });

async function getUserAssets(userId) {
  const result = await query(
    `SELECT id, user_id, asset_type, name, file_url, created_at
     FROM user_assets
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

function userResponseRow(row, farmerProfile, assets = []) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    phone: row.phone,
    country: row.country,
    profilePhotoUrl: row.profile_photo_url || null,
    isActive: row.is_active ?? true,
    verificationStatus: row.verification_status || "UNVERIFIED",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    farmerProfile,
    assets,
  };
}

router.post("/signup", async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const existing = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userId = crypto.randomUUID();

    const created = await withTransaction(async (client) => {
      const userInsert = await client.query(
        `INSERT INTO users (id, name, email, password_hash, role, phone, country, profile_photo_url, is_active, verification_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'UNVERIFIED')
         RETURNING id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at`,
        [userId, data.name, email, passwordHash, data.role, data.phone ?? null, data.country ?? null, null]
      );

      let farmerProfile = null;
      if (data.role === "FARMER") {
        const farmerProfileId = crypto.randomUUID();
        const profileInsert = await client.query(
          `INSERT INTO farmer_profiles (id, user_id, farm_name, county, has_export_docs, certifications)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at`,
          [
            farmerProfileId,
            userId,
            data.farmName || "My Farm",
            data.county || "Unknown",
            Boolean(data.hasExportDocs),
            null,
          ]
        );
        farmerProfile = profileInsert.rows[0];
      }

      return { user: userInsert.rows[0], farmerProfile };
    });

    const token = signToken(created.user);
    return res.status(201).json({
      token,
      user: userResponseRow(created.user, created.farmerProfile, []),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const userResult = await query(
      `SELECT id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, password_hash, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userResult.rowCount === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = userResult.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ message: "Account is inactive. Contact admin." });
    }
    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const profileResult = await query(
      `SELECT id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at
       FROM farmer_profiles
       WHERE user_id = $1`,
      [user.id]
    );

    const assets = await getUserAssets(user.id);
    const token = signToken(user);
    return res.json({
      token,
      user: userResponseRow(user, profileResult.rows[0] ?? null, assets),
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const userResult = await query(
      `SELECT id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.sub]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const profileResult = await query(
      `SELECT id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at
       FROM farmer_profiles
       WHERE user_id = $1`,
      [req.user.sub]
    );

    const assets = await getUserAssets(req.user.sub);
    return res.json(userResponseRow(userResult.rows[0], profileResult.rows[0] ?? null, assets));
  } catch (error) {
    return next(error);
  }
});

router.get("/users", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const result = await query(
      `SELECT id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at
       FROM users
       ORDER BY created_at DESC`
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.patch("/me", requireAuth, async (req, res, next) => {
  try {
    const data = updateProfileSchema.parse(req.body);

    const existing = await query(
      "SELECT id, email, role, password_hash FROM users WHERE id = $1",
      [req.user.sub]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (data.email) {
      const emailExists = await query(
        "SELECT id FROM users WHERE email = $1 AND id <> $2",
        [data.email.toLowerCase(), req.user.sub]
      );
      if (emailExists.rowCount > 0) {
        return res.status(409).json({ message: "Email already exists" });
      }
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : null;
    await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           country = COALESCE($4, country),
           password_hash = COALESCE($5, password_hash),
           updated_at = NOW()
       WHERE id = $6`,
      [
        data.name ?? null,
        data.email ? data.email.toLowerCase() : null,
        data.phone ?? null,
        data.country ?? null,
        passwordHash,
        req.user.sub,
      ]
    );

    if (existing.rows[0].role === "FARMER") {
      const profileExists = await query("SELECT id FROM farmer_profiles WHERE user_id = $1", [req.user.sub]);

      if (profileExists.rowCount === 0) {
        const profileId = crypto.randomUUID();
        await query(
          `INSERT INTO farmer_profiles
           (id, user_id, farm_name, county, has_export_docs, certifications)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            profileId,
            req.user.sub,
            data.farmName || "My Farm",
            data.county || "Unknown",
            Boolean(data.hasExportDocs),
            data.certifications ?? null,
          ]
        );
      } else if (
        data.farmName !== undefined ||
        data.county !== undefined ||
        data.hasExportDocs !== undefined ||
        data.certifications !== undefined
      ) {
        await query(
          `UPDATE farmer_profiles
           SET farm_name = COALESCE($1, farm_name),
               county = COALESCE($2, county),
               has_export_docs = COALESCE($3, has_export_docs),
               certifications = COALESCE($4, certifications),
               updated_at = NOW()
           WHERE user_id = $5`,
          [
            data.farmName ?? null,
            data.county ?? null,
            data.hasExportDocs ?? null,
            data.certifications ?? null,
            req.user.sub,
          ]
        );
      }
    }

    const userResult = await query(
      `SELECT id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.sub]
    );
    const profileResult = await query(
      `SELECT id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at
       FROM farmer_profiles
       WHERE user_id = $1`,
      [req.user.sub]
    );
    const assets = await getUserAssets(req.user.sub);

    return res.json(userResponseRow(userResult.rows[0], profileResult.rows[0] ?? null, assets));
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid profile update", details: error.errors });
    }
    return next(error);
  }
});

router.patch("/me/avatar", requireAuth, async (req, res, next) => {
  try {
    const payload = updateAvatarSchema.parse(req.body);
    const updated = await query(
      `UPDATE users
       SET profile_photo_url = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at`,
      [payload.imageUrl, req.user.sub]
    );

    const profileResult = await query(
      `SELECT id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at
       FROM farmer_profiles
       WHERE user_id = $1`,
      [req.user.sub]
    );
    const assets = await getUserAssets(req.user.sub);

    return res.json(userResponseRow(updated.rows[0], profileResult.rows[0] ?? null, assets));
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid avatar payload", details: error.errors });
    }
    return next(error);
  }
});

router.post("/me/assets", requireAuth, async (req, res, next) => {
  try {
    const payload = createAssetSchema.parse(req.body);
    const assetId = crypto.randomUUID();

    const created = await query(
      `INSERT INTO user_assets (id, user_id, asset_type, name, file_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, asset_type, name, file_url, created_at`,
      [assetId, req.user.sub, payload.type, payload.name, payload.fileUrl]
    );

    return res.status(201).json(created.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid asset payload", details: error.errors });
    }
    return next(error);
  }
});

router.delete("/me/assets/:assetId", requireAuth, async (req, res, next) => {
  try {
    const deleted = await query(
      `DELETE FROM user_assets
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.assetId, req.user.sub]
    );

    if (deleted.rowCount === 0) {
      return res.status(404).json({ message: "Asset not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.patch("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const data = adminUpdateUserSchema.parse(req.body);

    const existing = await query(
      `SELECT id, role, is_active, verification_status
       FROM users
       WHERE id = $1`,
      [req.params.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    if (req.user.sub === req.params.id && data.isActive === false) {
      return res.status(400).json({ message: "You cannot deactivate your own admin account" });
    }

    const updated = await query(
      `UPDATE users
       SET role = COALESCE($1, role),
           is_active = COALESCE($2, is_active),
           verification_status = COALESCE($3, verification_status),
           updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at`,
      [data.role ?? null, data.isActive ?? null, data.verificationStatus ?? null, req.params.id]
    );

    return res.json(updated.rows[0]);
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid user update", details: error.errors });
    }
    return next(error);
  }
});

export default router;
