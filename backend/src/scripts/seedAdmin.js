import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  const email = "admin@zaodirect.com";
  const password = "admin123";
  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  if (existing.rowCount > 0) {
    console.log("Admin user already exists.");
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, 'ADMIN')`,
    [id, "ZaoDirect Admin", email, passwordHash]
  );

  console.log("Admin seeded: admin@zaodirect.com / admin123");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
