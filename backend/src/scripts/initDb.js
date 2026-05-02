import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlPath = path.resolve(__dirname, "../../sql/001_init.sql");

async function main() {
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  console.log("Database schema initialized successfully.");
}

main()
  .catch((error) => {
    console.error("Failed to initialize DB:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
