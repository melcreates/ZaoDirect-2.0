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

  forgotPassword = async () => ({ success: true, message: "Not yet implemented." });

  resetPassword = async () => ({ success: true, message: "Not yet implemented." });

  getProfile = async () => HttpService.get("/api/auth/me");

  updateProfile = async (payload) => HttpService.patch("/api/auth/me", payload);

  updateAvatar = async (imageUrl) => HttpService.patch("/api/auth/me/avatar", { imageUrl });

  uploadAsset = async (payload) => HttpService.post("/api/auth/me/assets", payload);

  deleteAsset = async (assetId) => HttpService.delete(`/api/auth/me/assets/${assetId}`);
}

export default new AuthService();
