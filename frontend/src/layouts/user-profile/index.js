import { useContext, useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Switch from "@mui/material/Switch";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import Header from "layouts/user-profile/Header";
import AuthService from "services/auth-service";
import { AuthContext } from "context";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

const UserProfile = () => {
  const authContext = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState("");
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    country: "",
    newPassword: "",
    farmName: "",
    county: "",
    hasExportDocs: false,
    certifications: "",
  });

  const isFarmer = profile?.role === "FARMER";
  const cachedUser = authContext?.user || null;
  const displayName = profile?.name || cachedUser?.name || "My Profile";
  const rawRole = profile?.role || cachedUser?.role || "";
  const displayRole = rawRole ? `${rawRole.charAt(0)}${rawRole.slice(1).toLowerCase()}` : "";
  const displayPhoto = profile?.profilePhotoUrl || cachedUser?.profilePhotoUrl || "";
  const documents = useMemo(
    () => (Array.isArray(profile?.assets) ? profile.assets.filter((item) => item.asset_type === "DOCUMENT") : []),
    [profile?.assets]
  );
  const photos = useMemo(
    () => (Array.isArray(profile?.assets) ? profile.assets.filter((item) => item.asset_type === "PHOTO") : []),
    [profile?.assets]
  );

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await AuthService.getProfile();
      setProfile(data);
      setForm({
        name: data?.name || "",
        email: data?.email || "",
        phone: data?.phone || "",
        country: data?.country || "",
        newPassword: "",
        farmName: data?.farmerProfile?.farm_name || "",
        county: data?.farmerProfile?.county || "",
        hasExportDocs: Boolean(data?.farmerProfile?.has_export_docs),
        certifications: data?.farmerProfile?.certifications || "",
      });
    } catch (err) {
      setError(err?.message || "Unable to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (!notification) return undefined;
    const timeout = setTimeout(() => setNotification(""), 3500);
    return () => clearTimeout(timeout);
  }, [notification]);

  const changeHandler = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotification("");

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        country: form.country.trim() || undefined,
        password: form.newPassword.trim() || undefined,
      };

      if (isFarmer) {
        payload.farmName = form.farmName.trim() || undefined;
        payload.county = form.county.trim() || undefined;
        payload.hasExportDocs = Boolean(form.hasExportDocs);
        payload.certifications = form.certifications.trim() || undefined;
      }

      const updated = await AuthService.updateProfile(payload);
      setProfile(updated);
      setForm((prev) => ({ ...prev, newPassword: "" }));
      authContext.updateUser(updated);
      setNotification("Profile updated successfully.");
    } catch (err) {
      setError(err?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    setUploading(true);
    setError("");
    setNotification("");

    try {
      const imageUrl = await fileToDataUrl(file);
      const updated = await AuthService.updateAvatar(imageUrl);
      setProfile(updated);
      authContext.updateUser(updated);
      setNotification("Profile photo updated.");
    } catch (err) {
      setError(err?.message || "Unable to update profile photo.");
    } finally {
      setUploading(false);
    }
  };

  const handleAssetUpload = async (type, event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    event.target.value = "";
    setUploading(true);
    setError("");
    setNotification("");

    try {
      for (const file of files) {
        const fileUrl = await fileToDataUrl(file);
        await AuthService.uploadAsset({
          type,
          name: file.name,
          fileUrl,
        });
      }
      await loadProfile();
      setNotification(`${type === "DOCUMENT" ? "Document" : "Photo"} upload complete.`);
    } catch (err) {
      setError(err?.message || "Unable to upload file(s).");
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = async (assetId) => {
    try {
      setError("");
      await AuthService.deleteAsset(assetId);
      setProfile((prev) => ({
        ...prev,
        assets: Array.isArray(prev?.assets) ? prev.assets.filter((item) => item.id !== assetId) : [],
      }));
      setNotification("Asset removed.");
    } catch (err) {
      setError(err?.message || "Unable to remove asset.");
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox mb={2} />
      <Header
        name={displayName}
        role={displayRole}
        profilePhotoUrl={displayPhoto}
      >
        {notification && (
          <MDAlert color="info" mt="20px">
            <MDTypography variant="body2" color="white">
              {notification}
            </MDTypography>
          </MDAlert>
        )}
        {error && (
          <MDAlert color="error" mt="20px">
            <MDTypography variant="body2" color="white">
              {error}
            </MDTypography>
          </MDAlert>
        )}

        <Grid container spacing={3} mt={1}>
          <Grid item xs={12} lg={8}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" fontWeight="medium">
                  Account Details
                </MDTypography>
                <MDTypography variant="button" color="text">
                  Manage your contact details, password, and role-specific profile information.
                </MDTypography>
                <MDBox component="form" mt={3} onSubmit={submitHandler}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <MDInput name="name" label="Name" fullWidth value={form.name} onChange={changeHandler} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <MDInput
                        name="email"
                        type="email"
                        label="Email"
                        fullWidth
                        value={form.email}
                        onChange={changeHandler}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <MDInput
                        name="phone"
                        label="Phone"
                        fullWidth
                        value={form.phone}
                        onChange={changeHandler}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <MDInput
                        name="country"
                        label="Country"
                        fullWidth
                        value={form.country}
                        onChange={changeHandler}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <MDInput
                        name="newPassword"
                        type="password"
                        label="New Password (optional)"
                        fullWidth
                        value={form.newPassword}
                        onChange={changeHandler}
                      />
                    </Grid>
                    {isFarmer && (
                      <>
                        <Grid item xs={12}>
                          <Divider />
                        </Grid>
                        <Grid item xs={12}>
                          <MDTypography variant="button" color="text" fontWeight="medium">
                            Farmer Profile
                          </MDTypography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <MDInput
                            name="farmName"
                            label="Farm Name"
                            fullWidth
                            value={form.farmName}
                            onChange={changeHandler}
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <MDInput
                            name="county"
                            label="County"
                            fullWidth
                            value={form.county}
                            onChange={changeHandler}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <MDInput
                            name="certifications"
                            label="Certifications (comma separated)"
                            fullWidth
                            value={form.certifications}
                            onChange={changeHandler}
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <MDBox display="flex" alignItems="center" ml={-1}>
                            <Switch
                              checked={Boolean(form.hasExportDocs)}
                              onChange={changeHandler}
                              name="hasExportDocs"
                            />
                            <MDTypography variant="button" color="text" fontWeight="regular" ml={1}>
                              I have export documentation
                            </MDTypography>
                          </MDBox>
                        </Grid>
                      </>
                    )}
                  </Grid>
                  <MDBox mt={3} display="flex" justifyContent="flex-end">
                    <MDButton type="submit" variant="gradient" color="info" disabled={saving || loading}>
                      {saving ? "Saving..." : "Save Profile"}
                    </MDButton>
                  </MDBox>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={4}>
            <Card>
              <MDBox p={3}>
                <MDTypography variant="h6" fontWeight="medium">
                  Profile Photo
                </MDTypography>
                <MDTypography variant="button" color="text">
                  Upload a profile picture for your account identity.
                </MDTypography>
                <MDBox mt={2}>
                  <MDButton component="label" variant="outlined" color="info" fullWidth disabled={uploading}>
                    {uploading ? "Uploading..." : "Change Profile Photo"}
                    <input type="file" accept="image/*" hidden onChange={handleAvatarUpload} />
                  </MDButton>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={3} mt={0.5}>
          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <MDTypography variant="h6" fontWeight="medium">
                    Necessary Documents
                  </MDTypography>
                  <MDButton component="label" variant="outlined" color="info" size="small" disabled={uploading}>
                    Upload
                    <input type="file" hidden multiple onChange={(e) => handleAssetUpload("DOCUMENT", e)} />
                  </MDButton>
                </MDBox>
                <MDTypography variant="button" color="text">
                  Add export docs, certifications, permits, and related files.
                </MDTypography>
                <MDBox mt={2}>
                  {documents.length > 0 ? (
                    documents.map((doc) => (
                      <MDBox
                        key={doc.id}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        py={1}
                      >
                        <MDTypography
                          component="a"
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          variant="button"
                          color="info"
                        >
                          {doc.name}
                        </MDTypography>
                        <MDButton color="error" variant="text" size="small" onClick={() => removeAsset(doc.id)}>
                          Remove
                        </MDButton>
                      </MDBox>
                    ))
                  ) : (
                    <MDTypography variant="button" color="text">
                      No documents uploaded yet.
                    </MDTypography>
                  )}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={6}>
            <Card>
              <MDBox p={3}>
                <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <MDTypography variant="h6" fontWeight="medium">
                    Farm/Business Photos
                  </MDTypography>
                  <MDButton component="label" variant="outlined" color="info" size="small" disabled={uploading}>
                    Upload
                    <input type="file" accept="image/*" hidden multiple onChange={(e) => handleAssetUpload("PHOTO", e)} />
                  </MDButton>
                </MDBox>
                <MDTypography variant="button" color="text">
                  Showcase your farm, produce quality, facility, or business operation.
                </MDTypography>
                <MDBox mt={2}>
                  {photos.length > 0 ? (
                    <Grid container spacing={2}>
                      {photos.map((photo) => (
                        <Grid item xs={6} key={photo.id}>
                          <Card>
                            <MDBox p={1}>
                              <MDBox
                                component="img"
                                src={photo.file_url}
                                alt={photo.name}
                                width="100%"
                                borderRadius="lg"
                                mb={1}
                              />
                              <MDTypography variant="caption" color="text">
                                {photo.name}
                              </MDTypography>
                              <MDBox>
                                <MDButton color="error" variant="text" size="small" onClick={() => removeAsset(photo.id)}>
                                  Remove
                                </MDButton>
                              </MDBox>
                            </MDBox>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <MDTypography variant="button" color="text">
                      No photos uploaded yet.
                    </MDTypography>
                  )}
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </Header>
      <Footer />
    </DashboardLayout>
  );
};

export default UserProfile;
