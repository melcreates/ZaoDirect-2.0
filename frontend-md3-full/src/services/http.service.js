const API_BASE = (process.env.REACT_APP_API_URL || "http://localhost:4001/api").replace(/\/$/, "");
const GET_CACHE_TTL_MS = 30_000;
const getCache = new Map();
const inflightGets = new Map();

function shouldBypassCache(path, options = {}) {
  if (options?.cache === "no-store") return true;
  if (path.includes("ts=")) return true;
  return false;
}

async function request(path, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const cacheKey = `${method}:${path}`;
  const canUseGetCache = method === "GET" && !shouldBypassCache(path, options);

  if (canUseGetCache) {
    const cached = getCache.get(cacheKey);
    if (cached && Date.now() - cached.at < GET_CACHE_TTL_MS) {
      return cached.data;
    }
    const inflight = inflightGets.get(cacheKey);
    if (inflight) return inflight;
  }

  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const run = async () => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const contentType = response.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message =
        (typeof data === "object" && data?.message) || `Request failed (${response.status})`;
      throw new Error(message);
    }

    if (canUseGetCache) {
      getCache.set(cacheKey, { at: Date.now(), data });
    } else if (method !== "GET") {
      // Any write invalidates GET cache to avoid stale UI.
      getCache.clear();
    }
    return data;
  };

  if (!canUseGetCache) return run();

  const promise = run().finally(() => inflightGets.delete(cacheKey));
  inflightGets.set(cacheKey, promise);
  return promise;
}

const HttpService = {
  get: (path, options = {}) => request(path, { method: "GET", ...options }),
  post: (path, body) => request(path, { method: "POST", body: JSON.stringify(body || {}) }),
  patch: (path, body) => request(path, { method: "PATCH", body: JSON.stringify(body || {}) }),
  delete: (path) => request(path, { method: "DELETE" }),
  clearCache: () => {
    getCache.clear();
    inflightGets.clear();
  },
};

export default HttpService;
