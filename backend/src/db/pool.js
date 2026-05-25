import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const hasSslMode = /[?&]sslmode=/i.test(process.env.DATABASE_URL);

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

// RDS commonly uses certificate chains that fail strict local validation unless CA bundles are managed explicitly.
// Keep transport encrypted but skip strict CA verification for now to keep production connectivity stable.
if (isProduction || hasSslMode) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(poolConfig);

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
