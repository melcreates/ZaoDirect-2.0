/**
=========================================================
* Material Dashboard 3 PRO React - v2.4.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-pro-react
* Copyright 2024 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDAlert from "components/MDAlert";
import MDTypography from "components/MDTypography";

// Settings page components
import BaseLayout from "layouts/pages/account/components/BaseLayout";
import Sidenav from "layouts/pages/account/settings/components/Sidenav";
import Header from "layouts/pages/account/settings/components/Header";
import BasicInfo from "layouts/pages/account/settings/components/BasicInfo";
import ChangePassword from "layouts/pages/account/settings/components/ChangePassword";
import Sessions from "layouts/pages/account/settings/components/Sessions";
import DeleteAccount from "layouts/pages/account/settings/components/DeleteAccount";
import AuthService from "services/auth-service";

function normalizeRole(role) {
  if (!role) return "";
  return `${role.charAt(0)}${role.slice(1).toLowerCase()}`;
}

function Settings() {
  const [loading, setLoading] = useState(true);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profile, setProfile] = useState(null);
  const [basicForm, setBasicForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const [me, sessionsRes] = await Promise.all([
          AuthService.getProfile(),
          AuthService.getSessions(),
        ]);
        setProfile(me);
        setBasicForm({
          name: me?.name || "",
          email: me?.email || "",
          phone: me?.phone || "",
          country: me?.country || "",
        });
        setSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
        localStorage.setItem("user", JSON.stringify(me));
      } catch (err) {
        setError(err?.message || "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const headerName = useMemo(() => profile?.name || profile?.email || "My Account", [profile]);
  const headerRole = useMemo(() => normalizeRole(profile?.role), [profile]);
  const headerPhoto = useMemo(() => profile?.profilePhotoUrl || "", [profile]);

  const handleBasicChange = (event) => {
    const { name, value } = event.target;
    setBasicForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveBasic = async () => {
    try {
      setSavingBasic(true);
      setError("");
      setSuccess("");

      const payload = {
        name: basicForm.name?.trim(),
        phone: basicForm.phone?.trim(),
        country: basicForm.country?.trim(),
      };
      const updated = await AuthService.updateProfile(payload);
      const merged = { ...profile, ...updated };
      setProfile(merged);
      localStorage.setItem("user", JSON.stringify(merged));
      setSuccess("Basic information updated successfully.");
    } catch (err) {
      setError(err?.message || "Unable to save basic information.");
    } finally {
      setSavingBasic(false);
    }
  };

  const handleSavePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill all password fields.");
      setSuccess("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      setSuccess("");
      return;
    }

    try {
      setSavingPassword(true);
      setError("");
      setSuccess("");

      await AuthService.updateProfile({
        currentPassword,
        password: newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setSuccess("Password updated successfully.");
    } catch (err) {
      setError(err?.message || "Unable to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleChangePhoto = async (file) => {
    try {
      setUploadingPhoto(true);
      setError("");
      setSuccess("");

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read image file."));
        reader.readAsDataURL(file);
      });

      const updated = await AuthService.updateAvatar(dataUrl);
      const nextProfile = { ...profile, ...updated };
      setProfile(nextProfile);
      localStorage.setItem("user", JSON.stringify(nextProfile));
      setSuccess("Profile photo updated successfully.");
    } catch (err) {
      setError(err?.message || "Unable to update profile photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      setError("");
      setSuccess("");
      await AuthService.revokeSession(sessionId);
      const refreshed = await AuthService.getSessions();
      setSessions(Array.isArray(refreshed) ? refreshed : []);
      setSuccess("Session removed.");
    } catch (err) {
      setError(err?.message || "Unable to remove session.");
    } finally {
      setRevokingId("");
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm("Are you sure you want to deactivate your account?")) return;
    try {
      setDeactivating(true);
      setError("");
      setSuccess("");
      await AuthService.deactivateMyAccount();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/authentication/sign-in";
    } catch (err) {
      setError(err?.message || "Unable to deactivate account.");
    } finally {
      setDeactivating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("This permanently deletes your account. Continue?")) return;
    try {
      setDeleting(true);
      setError("");
      setSuccess("");
      await AuthService.deleteMyAccount();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/authentication/sign-in";
    } catch (err) {
      setError(err?.message || "Unable to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BaseLayout>
      <MDBox mt={4}>
        <Grid container spacing={3}>
          <Grid item xs={12} lg={3}>
            <Sidenav />
          </Grid>
          <Grid item xs={12} lg={9}>
            <MDBox mb={3}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Header
                    name={headerName}
                    role={headerRole}
                    profilePhotoUrl={headerPhoto}
                    onChangePhoto={handleChangePhoto}
                    uploadingPhoto={uploadingPhoto}
                  />
                </Grid>
                <Grid item xs={12}>
                  {error && (
                    <MDAlert color="error">
                      <MDTypography variant="body2" color="white">
                        {error}
                      </MDTypography>
                    </MDAlert>
                  )}
                  {success && (
                    <MDAlert color="success">
                      <MDTypography variant="body2" color="white">
                        {success}
                      </MDTypography>
                    </MDAlert>
                  )}
                  {loading && (
                    <MDAlert color="info">
                      <MDTypography variant="body2" color="white">
                        Loading settings...
                      </MDTypography>
                    </MDAlert>
                  )}
                </Grid>
                <Grid item xs={12}>
                  <BasicInfo
                    form={basicForm}
                    onChange={handleBasicChange}
                    onSave={handleSaveBasic}
                    saving={savingBasic}
                  />
                </Grid>
                <Grid item xs={12}>
                  <ChangePassword
                    form={passwordForm}
                    onChange={handlePasswordChange}
                    onSubmit={handleSavePassword}
                    saving={savingPassword}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Sessions sessions={sessions} onRevoke={handleRevokeSession} revokingId={revokingId} />
                </Grid>
                <Grid item xs={12}>
                  <DeleteAccount
                    onDeactivate={handleDeactivate}
                    onDelete={handleDelete}
                    deactivating={deactivating}
                    deleting={deleting}
                    isAdmin={profile?.role === "ADMIN"}
                  />
                </Grid>
              </Grid>
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>
    </BaseLayout>
  );
}

export default Settings;

