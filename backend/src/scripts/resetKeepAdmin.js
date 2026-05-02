import dotenv from "dotenv";
import { pool } from "../db/pool.js";

dotenv.config();

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tableResult = await client.query(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename <> 'users'
       ORDER BY tablename`
    );

    const tables = tableResult.rows.map((row) => row.tablename);
    if (tables.length > 0) {
      const truncateSql = `TRUNCATE TABLE ${tables
        .map((t) => `"public"."${t}"`)
        .join(", ")} RESTART IDENTITY CASCADE`;
      await client.query(truncateSql);
    }

    const deletedUsers = await client.query(
      `DELETE FROM users
       WHERE role <> 'ADMIN'
       RETURNING id`
    );

    const adminCount = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role = 'ADMIN'`
    );

    await client.query("COMMIT");

    console.log(
      `Reset complete. Removed ${deletedUsers.rowCount} non-admin users. Remaining admin users: ${adminCount.rows[0].count}.`
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error("Reset failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

