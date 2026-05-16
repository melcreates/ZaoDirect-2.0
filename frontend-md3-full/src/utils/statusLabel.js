export function toStatusLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  if (raw === "ALLOCATED") return "Waiting for pickup confirmation";
  if (raw === "READY_FOR_PICKUP") return "Ready for pickup";
  if (raw === "PICKED_UP") return "Collected";
  const normalized = raw.replace(/_/g, " ").toLowerCase();
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
