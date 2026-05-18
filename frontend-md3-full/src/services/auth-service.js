import HttpService from "services/http.service";

const AuthService = {
  login: (payload) => HttpService.post("/auth/login", payload),
  signup: (payload) => HttpService.post("/auth/signup", payload),
  googleAuth: (idToken) => HttpService.post("/auth/google", { idToken }),
  forgotPassword: (payload) => HttpService.post("/auth/forgot-password", payload),
  resetPassword: (payload) => HttpService.post("/auth/reset-password", payload),
  changePasswordWithEmail: (payload) => HttpService.post("/auth/change-password-with-email", payload),
  getProfile: () => HttpService.get("/auth/me"),
  updateProfile: (payload) => HttpService.patch("/auth/me", payload),
  getSettings: () => HttpService.get("/auth/me/settings"),
  updateNotifications: (payload) => HttpService.patch("/auth/me/settings/notifications", payload),
  getSessions: () => HttpService.get("/auth/me/sessions"),
  revokeSession: (sessionId) => HttpService.delete(`/auth/me/sessions/${sessionId}`),
  deactivateMyAccount: () => HttpService.post("/auth/me/deactivate", {}),
  deleteMyAccount: () => HttpService.delete("/auth/me"),
  updateAvatar: (imageUrl) => HttpService.patch("/auth/me/avatar", { imageUrl }),
  uploadAsset: (payload) => HttpService.post("/auth/me/assets", payload),
  deleteAsset: (assetId) => HttpService.delete(`/auth/me/assets/${assetId}`),
};

export default AuthService;
