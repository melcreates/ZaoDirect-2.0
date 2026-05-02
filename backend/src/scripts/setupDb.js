import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scripts = [
  "initDb.js",
  "migrateListingPhotos.js",
  "migrateOrderShipments.js",
  "migrateUserProfileAssets.js",
  "migrateMvpOperations.js",
  "migrateUserManagement.js",
  "migrateShipmentEvents.js",
  "migrateAuditEvents.js",
  "migrateFarmerProcurementStatusFlow.js",
  "migrateDisputeCases.js",
  "seedAdmin.js",
];

for (const script of scripts) {
  const fullPath = path.resolve(__dirname, script);
  const result = spawnSync(process.execPath, [fullPath], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error(`Setup failed while running ${script}`);
    process.exit(result.status || 1);
  }
}

console.log("DB setup complete.");
