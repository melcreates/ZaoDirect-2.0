import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_events (
      id UUID PRIMARY KEY,
      actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id, created_at DESC)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_user_id, created_at DESC)`);

  console.log("Audit events migration complete.");
}

main()
  .catch((error) => {
    console.error("Failed migration:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

