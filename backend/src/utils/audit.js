import crypto from "crypto";
import { query } from "../db/pool.js";

export async function logAudit(actorUserId, entityType, entityId, action, payload = {}) {
  await query(
    `INSERT INTO audit_events (id, actor_user_id, entity_type, entity_id, action, payload)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [crypto.randomUUID(), actorUserId ?? null, entityType, entityId, action, JSON.stringify(payload ?? {})]
  );
}

