import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb
  `);
  console.log("Migration complete: listings.photo_urls is ready.");
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
