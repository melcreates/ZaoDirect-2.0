import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS profile_photo_url TEXT
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      asset_type TEXT NOT NULL CHECK (asset_type IN ('DOCUMENT', 'PHOTO')),
      name TEXT NOT NULL,
      file_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_assets_user_id ON user_assets(user_id)");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_user_assets_type ON user_assets(asset_type)");

  console.log("Migration complete: user profile assets schema is ready.");
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
