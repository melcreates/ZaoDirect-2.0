import HttpService from "./htttp.service";

class AuthService {
  login = async (payload) => {
    const response = await HttpService.post("/api/auth/login", payload);
    return {
      access_token: response.token,
      refresh_token: response.token,
      user: response.user,
    };
  };

  register = async (payload) => {
    const response = await HttpService.post("/api/auth/signup", payload);
    return {
      access_token: response.token,
      refresh_token: response.token,
      user: response.user,
    };
  };

  logout = async () => ({ success: true });

  forgotPassword = async (payload) => HttpService.post("/api/auth/forgot-password", payload);

  resetPassword = async (payload) => HttpService.post("/api/auth/reset-password", payload);

  googleAuth = async (idToken) => {
    const response = await HttpService.post("/api/auth/google", { idToken });
    return {
      access_token: response.token,
      refresh_token: response.token,
      user: response.user,
    };
  };

  getProfile = async () => HttpService.get("/api/auth/me");

  updateProfile = async (payload) => HttpService.patch("/api/auth/me", payload);

  updateAvatar = async (imageUrl) => HttpService.patch("/api/auth/me/avatar", { imageUrl });

  uploadAsset = async (payload) => HttpService.post("/api/auth/me/assets", payload);

  deleteAsset = async (assetId) => HttpService.delete(`/api/auth/me/assets/${assetId}`);
}

export default new AuthService();
