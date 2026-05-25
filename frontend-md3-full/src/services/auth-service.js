import HttpService from "services/http.service";

let profileCache = null;
let profileCacheAt = 0;
let profilePromise = null;
const PROFILE_TTL_MS = 15_000;

function clearProfileCache() {
  profileCache = null;
  profileCacheAt = 0;
  profilePromise = null;
}

async function getProfileCached() {
  const now = Date.now();
  if (profileCache && now - profileCacheAt < PROFILE_TTL_MS) return profileCache;
  if (profilePromise) return profilePromise;

  profilePromise = HttpService.get("/auth/me", { cache: "no-store" })
    .then((data) => {
      profileCache = data;
      profileCacheAt = Date.now();
      return data;
    })
    .finally(() => {
      profilePromise = null;
    });
  return profilePromise;
}

const AuthService = {
  login: async (payload) => {
    clearProfileCache();
    HttpService.clearCache();
    return HttpService.post("/auth/login", payload);
  },
  signup: async (payload) => {
    clearProfileCache();
    HttpService.clearCache();
    return HttpService.post("/auth/signup", payload);
  },
  googleAuth: async (idToken) => {
    clearProfileCache();
    HttpService.clearCache();
    return HttpService.post("/auth/google", { idToken });
  },
  forgotPassword: (payload) => HttpService.post("/auth/forgot-password", payload),
  resetPassword: (payload) => HttpService.post("/auth/reset-password", payload),
  changePasswordWithEmail: (payload) => HttpService.post("/auth/change-password-with-email", payload),
  getProfile: () => getProfileCached(),
  updateProfile: async (payload) => {
    const updated = await HttpService.patch("/auth/me", payload);
    profileCache = updated;
    profileCacheAt = Date.now();
    return updated;
  },
  getSettings: () => HttpService.get("/auth/me/settings"),
  updateNotifications: (payload) => HttpService.patch("/auth/me/settings/notifications", payload),
  getSessions: () => HttpService.get("/auth/me/sessions"),
  revokeSession: (sessionId) => HttpService.delete(`/auth/me/sessions/${sessionId}`),
  deactivateMyAccount: () => HttpService.post("/auth/me/deactivate", {}),
  deleteMyAccount: () => HttpService.delete("/auth/me"),
  updateAvatar: async (imageUrl) => {
    const updated = await HttpService.patch("/auth/me/avatar", { imageUrl });
    profileCache = updated;
    profileCacheAt = Date.now();
    return updated;
  },
  uploadAsset: (payload) => HttpService.post("/auth/me/assets", payload),
  deleteAsset: (assetId) => HttpService.delete(`/auth/me/assets/${assetId}`),
  clearProfileCache,
};

export default AuthService;
