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
  rememberMe: z.boolean().optional(),
});
const forgotPasswordSchema = z.object({
  email: z.string().email(),
  redirectUrl: z.string().url().optional(),
});
const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(12),
  password: z.string().min(6),
});
const changePasswordWithEmailSchema = z
  .object({
    email: z.string().email(),
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((payload) => payload.newPassword === payload.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });
const googleAuthSchema = z.object({
  idToken: z.string().min(20),
});
const notificationsSchema = z.object({
  mentionsEmail: z.boolean().optional(),
  mentionsPush: z.boolean().optional(),
  mentionsSms: z.boolean().optional(),
  commentsEmail: z.boolean().optional(),
  commentsPush: z.boolean().optional(),
  commentsSms: z.boolean().optional(),
  followsEmail: z.boolean().optional(),
  followsPush: z.boolean().optional(),
  followsSms: z.boolean().optional(),
  loginNewDeviceEmail: z.boolean().optional(),
  loginNewDevicePush: z.boolean().optional(),
  loginNewDeviceSms: z.boolean().optional(),
});

const updateProfileSchema = z
  .object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    country: z.string().optional(),
    password: z.string().min(6).optional(),
    currentPassword: z.string().min(6).optional(),
    farmName: z.string().optional(),
    county: z.string().optional(),
    hasExportDocs: z.boolean().optional(),
    certifications: z.string().optional(),
  })
  .refine((payload) => !payload.password || !!payload.currentPassword, {
    message: "Current password is required to set a new password",
    path: ["currentPassword"],
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

async function ensurePasswordResetTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_user_id ON password_reset_tokens(user_id)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_password_reset_token_hash ON password_reset_tokens(token_hash)`
  );
}

async function ensureSettingsTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS user_notification_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      mentions_email BOOLEAN NOT NULL DEFAULT TRUE,
      mentions_push BOOLEAN NOT NULL DEFAULT FALSE,
      mentions_sms BOOLEAN NOT NULL DEFAULT FALSE,
      comments_email BOOLEAN NOT NULL DEFAULT TRUE,
      comments_push BOOLEAN NOT NULL DEFAULT TRUE,
      comments_sms BOOLEAN NOT NULL DEFAULT FALSE,
      follows_email BOOLEAN NOT NULL DEFAULT FALSE,
      follows_push BOOLEAN NOT NULL DEFAULT TRUE,
      follows_sms BOOLEAN NOT NULL DEFAULT FALSE,
      login_new_device_email BOOLEAN NOT NULL DEFAULT TRUE,
      login_new_device_push BOOLEAN NOT NULL DEFAULT TRUE,
      login_new_device_sms BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_agent TEXT,
      ip_address TEXT,
      is_current BOOLEAN NOT NULL DEFAULT TRUE,
      revoked_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)`);
  await query(`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT FALSE`);
  await query(`ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL`);
}

async function ensureNotificationSettingsRow(userId) {
  await ensureSettingsTables();
  await query(
    `INSERT INTO user_notification_settings (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

async function getNotificationSettings(userId) {
  await ensureNotificationSettingsRow(userId);
  const result = await query(
    `SELECT mentions_email, mentions_push, mentions_sms,
            comments_email, comments_push, comments_sms,
            follows_email, follows_push, follows_sms,
            login_new_device_email, login_new_device_push, login_new_device_sms
     FROM user_notification_settings
     WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0] || {};
  return {
    mentionsEmail: row.mentions_email ?? true,
    mentionsPush: row.mentions_push ?? false,
    mentionsSms: row.mentions_sms ?? false,
    commentsEmail: row.comments_email ?? true,
    commentsPush: row.comments_push ?? true,
    commentsSms: row.comments_sms ?? false,
    followsEmail: row.follows_email ?? false,
    followsPush: row.follows_push ?? true,
    followsSms: row.follows_sms ?? false,
    loginNewDeviceEmail: row.login_new_device_email ?? true,
    loginNewDevicePush: row.login_new_device_push ?? true,
    loginNewDeviceSms: row.login_new_device_sms ?? false,
  };
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0].trim();
  }
  return req.ip || null;
}

async function cleanupExpiredSessions(userId = null) {
  if (userId) {
    await query(
      `UPDATE user_sessions
       SET revoked_at = NOW(), is_current = FALSE
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND expires_at IS NOT NULL
         AND expires_at <= NOW()`,
      [userId]
    );
    return;
  }

  await query(
    `UPDATE user_sessions
     SET revoked_at = NOW(), is_current = FALSE
     WHERE revoked_at IS NULL
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()`
  );
}

async function createUserSession(req, userId, rememberMe = false) {
  await ensureSettingsTables();
  await cleanupExpiredSessions(userId);
  await query(`UPDATE user_sessions SET is_current = FALSE WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);

  const expiresAt = rememberMe ? null : new Date(Date.now() + 2 * 60 * 60 * 1000);
  await query(
    `INSERT INTO user_sessions (id, user_id, user_agent, ip_address, is_current, last_active_at, remember_me, expires_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), $5, $6)`,
    [crypto.randomUUID(), userId, req.headers["user-agent"] || null, getClientIp(req), rememberMe, expiresAt]
  );
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

    const token = signToken(created.user, { rememberMe: false });
    await ensureNotificationSettingsRow(created.user.id);
    await createUserSession(req, created.user.id, false);
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
    const token = signToken(user, { rememberMe: Boolean(data.rememberMe) });
    await ensureNotificationSettingsRow(user.id);
    await createUserSession(req, user.id, Boolean(data.rememberMe));
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

router.post("/forgot-password", async (req, res, next) => {
  try {
    const data = forgotPasswordSchema.parse(req.body);
    await ensurePasswordResetTable();

    const email = data.email.toLowerCase();
    const userResult = await query(
      `SELECT id, email, is_active
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userResult.rowCount > 0 && userResult.rows[0].is_active !== false) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const resetId = crypto.randomUUID();

      await query(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
        [resetId, userResult.rows[0].id, tokenHash]
      );

      const baseUrl = data.redirectUrl || process.env.FRONTEND_URL?.split(",")[0]?.trim() || "";
      const resetUrl = baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/auth/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`
        : null;

      if (resetUrl) {
        console.log(`Password reset URL for ${email}: ${resetUrl}`);
      }
    }

    return res.json({
      success: true,
      message: "If an account exists, a reset link has been generated.",
    });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const data = resetPasswordSchema.parse(req.body);
    await ensurePasswordResetTable();

    const email = data.email.toLowerCase();
    const tokenHash = crypto.createHash("sha256").update(data.token).digest("hex");

    const result = await query(
      `SELECT prt.id AS reset_id, u.id AS user_id
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE u.email = $1
         AND prt.token_hash = $2
         AND prt.used_at IS NULL
         AND prt.expires_at > NOW()
       ORDER BY prt.created_at DESC
       LIMIT 1`,
      [email, tokenHash]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    const userId = result.rows[0].user_id;
    const resetId = result.rows[0].reset_id;
    const passwordHash = await bcrypt.hash(data.password, 10);

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE users
         SET password_hash = $1, updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, userId]
      );
      await client.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE id = $1`,
        [resetId]
      );
    });

    return res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid request", details: error.errors });
    }
    return next(error);
  }
});

router.post("/change-password-with-email", async (req, res, next) => {
  try {
    const data = changePasswordWithEmailSchema.parse(req.body);
    const email = data.email.toLowerCase();

    const userResult = await query(
      `SELECT id, password_hash, is_active
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (!userResult.rowCount) {
      return res.status(404).json({ message: "Account not found for this email" });
    }

    const user = userResult.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ message: "Account is deactivated" });
    }

    const isValidCurrent = await bcrypt.compare(data.currentPassword, user.password_hash || "");
    if (!isValidCurrent) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);
    await query(`UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`, [
      newPasswordHash,
      user.id,
    ]);

    res.json({ message: "Password changed successfully. You can now sign in." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message || "Invalid request payload" });
    }
    next(error);
  }
});

router.post("/google", async (req, res, next) => {
  try {
    const data = googleAuthSchema.parse(req.body);
    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      return res.status(500).json({ message: "Google auth is not configured on the server." });
    }

    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(data.idToken)}`
    );

    if (!response.ok) {
      return res.status(401).json({ message: "Invalid Google token." });
    }

    const tokenInfo = await response.json();
    if (tokenInfo.aud !== googleClientId) {
      return res.status(401).json({ message: "Google token audience mismatch." });
    }
    if (tokenInfo.email_verified !== "true") {
      return res.status(401).json({ message: "Google account email is not verified." });
    }

    const email = String(tokenInfo.email || "").toLowerCase();
    if (!email) {
      return res.status(400).json({ message: "Google account email is missing." });
    }

    let userResult = await query(
      `SELECT id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    );

    if (userResult.rowCount === 0) {
      const userId = crypto.randomUUID();
      const randomPasswordHash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10);
      const displayName = tokenInfo.name || email.split("@")[0];

      const created = await withTransaction(async (client) => {
        const userInsert = await client.query(
          `INSERT INTO users (id, name, email, password_hash, role, profile_photo_url, is_active, verification_status)
           VALUES ($1, $2, $3, $4, 'FARMER', $5, TRUE, 'UNVERIFIED')
           RETURNING id, name, email, role, phone, country, profile_photo_url, is_active, verification_status, created_at, updated_at`,
          [userId, displayName, email, randomPasswordHash, tokenInfo.picture || null]
        );

        const farmerProfileId = crypto.randomUUID();
        const profileInsert = await client.query(
          `INSERT INTO farmer_profiles (id, user_id, farm_name, county, has_export_docs, certifications)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at`,
          [farmerProfileId, userId, "My Farm", "Unknown", false, null]
        );
        return { user: userInsert.rows[0], farmerProfile: profileInsert.rows[0] };
      });

      const assets = await getUserAssets(created.user.id);
      const token = signToken(created.user, { rememberMe: false });
      await ensureNotificationSettingsRow(created.user.id);
      await createUserSession(req, created.user.id, false);
      return res.json({
        token,
        user: userResponseRow(created.user, created.farmerProfile, assets),
      });
    }

    const user = userResult.rows[0];
    if (user.is_active === false) {
      return res.status(403).json({ message: "Account is inactive. Contact admin." });
    }

    const profileResult = await query(
      `SELECT id, user_id, farm_name, county, has_export_docs, certifications, created_at, updated_at
       FROM farmer_profiles
       WHERE user_id = $1`,
      [user.id]
    );
    const assets = await getUserAssets(user.id);
    const token = signToken(user, { rememberMe: false });
    await ensureNotificationSettingsRow(user.id);
    await createUserSession(req, user.id, false);
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

    let passwordHash = null;
    if (data.password) {
      const currentMatches = await bcrypt.compare(
        data.currentPassword || "",
        existing.rows[0].password_hash || ""
      );
      if (!currentMatches) {
        return res.status(400).json({ message: "Current password is incorrect." });
      }
      passwordHash = await bcrypt.hash(data.password, 10);
    }
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

router.get("/me/settings", requireAuth, async (req, res, next) => {
  try {
    const notifications = await getNotificationSettings(req.user.sub);
    return res.json({ notifications });
  } catch (error) {
    return next(error);
  }
});

router.patch("/me/settings/notifications", requireAuth, async (req, res, next) => {
  try {
    const data = notificationsSchema.parse(req.body);
    await ensureNotificationSettingsRow(req.user.sub);
    await query(
      `UPDATE user_notification_settings
       SET mentions_email = COALESCE($1, mentions_email),
           mentions_push = COALESCE($2, mentions_push),
           mentions_sms = COALESCE($3, mentions_sms),
           comments_email = COALESCE($4, comments_email),
           comments_push = COALESCE($5, comments_push),
           comments_sms = COALESCE($6, comments_sms),
           follows_email = COALESCE($7, follows_email),
           follows_push = COALESCE($8, follows_push),
           follows_sms = COALESCE($9, follows_sms),
           login_new_device_email = COALESCE($10, login_new_device_email),
           login_new_device_push = COALESCE($11, login_new_device_push),
           login_new_device_sms = COALESCE($12, login_new_device_sms),
           updated_at = NOW()
       WHERE user_id = $13`,
      [
        data.mentionsEmail ?? null,
        data.mentionsPush ?? null,
        data.mentionsSms ?? null,
        data.commentsEmail ?? null,
        data.commentsPush ?? null,
        data.commentsSms ?? null,
        data.followsEmail ?? null,
        data.followsPush ?? null,
        data.followsSms ?? null,
        data.loginNewDeviceEmail ?? null,
        data.loginNewDevicePush ?? null,
        data.loginNewDeviceSms ?? null,
        req.user.sub,
      ]
    );

    const notifications = await getNotificationSettings(req.user.sub);
    return res.json({ notifications });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ message: "Invalid notification settings", details: error.errors });
    }
    return next(error);
  }
});

router.get("/me/sessions", requireAuth, async (req, res, next) => {
  try {
    await ensureSettingsTables();
    await cleanupExpiredSessions(req.user.sub);
    let result = await query(
      `SELECT id, user_agent, ip_address, is_current, created_at, last_active_at, remember_me, expires_at
       FROM user_sessions
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY is_current DESC, last_active_at DESC`,
      [req.user.sub]
    );

    // Backfill for accounts that existed before session tracking was introduced.
    if (result.rowCount === 0) {
      await createUserSession(req, req.user.sub);
      result = await query(
        `SELECT id, user_agent, ip_address, is_current, created_at, last_active_at, remember_me, expires_at
         FROM user_sessions
         WHERE user_id = $1 AND revoked_at IS NULL
         ORDER BY is_current DESC, last_active_at DESC`,
        [req.user.sub]
      );
    }

    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
});

router.delete("/me/sessions/:sessionId", requireAuth, async (req, res, next) => {
  try {
    await ensureSettingsTables();
    const existing = await query(
      `SELECT id, is_current
       FROM user_sessions
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [req.params.sessionId, req.user.sub]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (existing.rows[0].is_current) {
      return res.status(400).json({ message: "You cannot remove your current session." });
    }

    await query(
      `UPDATE user_sessions
       SET revoked_at = NOW(), is_current = FALSE
       WHERE id = $1 AND user_id = $2`,
      [req.params.sessionId, req.user.sub]
    );

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

router.post("/me/deactivate", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "ADMIN") {
      return res.status(400).json({ message: "Admin accounts cannot self-deactivate here." });
    }

    await query(
      `UPDATE users
       SET is_active = FALSE, updated_at = NOW()
       WHERE id = $1`,
      [req.user.sub]
    );

    await query(
      `UPDATE user_sessions
       SET revoked_at = NOW(), is_current = FALSE
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [req.user.sub]
    );

    return res.json({ success: true, message: "Account deactivated." });
  } catch (error) {
    return next(error);
  }
});

router.delete("/me", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "ADMIN") {
      return res.status(400).json({ message: "Admin accounts cannot be deleted here." });
    }

    await query(`DELETE FROM users WHERE id = $1`, [req.user.sub]);
    return res.json({ success: true, message: "Account deleted." });
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
