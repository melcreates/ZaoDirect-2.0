import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED';
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_verification_status_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_verification_status_check
          CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'));
      END IF;
    END $$;
  `);

  console.log("User management migration completed.");
}

main()
  .catch((error) => {
    console.error("Failed to migrate user management:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
