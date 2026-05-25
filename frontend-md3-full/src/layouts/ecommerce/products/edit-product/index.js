import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import MDAlert from "components/MDAlert";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import HttpService from "services/http.service";

function formatStatus(status) {
  return String(status || "")
    .toLowerCase()
    .split("_")
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
}

function EditProduct() {
  const location = useLocation();
  const navigate = useNavigate();
  const id = new URLSearchParams(location.search).get("id");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [listing, setListing] = useState(null);
  const [form, setForm] = useState({
    title: "",
    category: "",
    quantity: "",
    unit: "",
    pricePerUnit: "",
    currency: "",
    county: "",
    availableFrom: "",
    status: "",
    photoUrl: "",
  });

  const isPublished = String(form.status || "").toUpperCase() === "PUBLISHED";
  const canEditCore = !isPublished;

  const displayImage = useMemo(() => {
    if (loading) return "";
    if (form.photoUrl) return form.photoUrl;
    const photos = Array.isArray(listing?.photo_urls) ? listing.photo_urls : [];
    return photos[0] || "";
  }, [form.photoUrl, listing, loading]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        if (!id) throw new Error("Missing product id.");
        const data = await HttpService.get(`/listings/${id}`);
        setListing(data);
        const photos = Array.isArray(data?.photo_urls) ? data.photo_urls : [];
        setForm({
          title: data?.title || "",
          category: data?.category || "",
          quantity: String(data?.quantity ?? ""),
          unit: data?.unit || "kg",
          pricePerUnit: String(data?.price_per_unit ?? ""),
          currency: data?.currency || "KES",
          county: data?.county || "",
          availableFrom: data?.available_from ? String(data.available_from).slice(0, 10) : "",
          status: data?.status || "DRAFT",
          photoUrl: photos[0] || "",
        });
      } catch (e) {
        setError(e?.message || "Unable to load product.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const onPickPhoto = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (result) set("photoUrl", result);
    };
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const payload = isPublished
        ? {
            quantity: Number(form.quantity || 0),
            photoUrls: form.photoUrl ? [form.photoUrl] : [],
          }
        : {
            title: form.title,
            category: form.category || null,
            quantity: Number(form.quantity || 0),
            unit: form.unit || "kg",
            pricePerUnit: Number(form.pricePerUnit || 0),
            currency: form.currency || "KES",
            county: form.county || null,
            availableFrom: form.availableFrom || null,
            photoUrls: form.photoUrl ? [form.photoUrl] : [],
          };
      await HttpService.patch(`/listings/${id}`, payload);
      setSuccess(isPublished ? "Updated quantity and product photo." : "Product updated.");
    } catch (e) {
      setError(e?.message || "Unable to save changes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox my={3}>
        <MDBox mb={6}>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} lg={7}>
              <MDTypography variant="h4" fontWeight="medium">
                Make the changes below
              </MDTypography>
            </Grid>
            <Grid item xs={12} lg={5}>
              <MDBox display="flex" justifyContent="flex-end" gap={1}>
                <MDButton variant="outlined" color="dark" onClick={() => navigate("/ecommerce/products/product-page")}>
                  Back
                </MDButton>
                <MDButton variant="gradient" color="dark" onClick={onSave} disabled={saving || loading}>
                  {saving ? "Saving..." : "Save"}
                </MDButton>
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>

        {isPublished && (
          <MDBox
            sx={{
              mb: 2,
              px: 2,
              py: 1.5,
              borderRadius: "md",
              backgroundColor: "#f3f4f6",
              border: "1px solid #e5e7eb",
            }}
          >
            <MDTypography variant="button" color="text" textAlign="left" lineHeight={1.6}>
              Published products can only update photo and kg (quantity).
            </MDTypography>
          </MDBox>
        )}
        {error && (
          <MDAlert color="error" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">{error}</MDTypography>
          </MDAlert>
        )}
        {success && (
          <MDAlert color="success" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">{success}</MDTypography>
          </MDAlert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} lg={4} sx={{ display: "flex" }}>
            <Card sx={{ width: "100%", height: "100%" }}>
              <MDBox p={2}>
                <MDBox
                  borderRadius="lg"
                  minHeight="16rem"
                  sx={{
                    backgroundColor: displayImage ? "transparent" : "#f3f4f6",
                    backgroundImage: displayImage ? `url(${displayImage})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border: displayImage ? "none" : "1px dashed #d1d5db",
                  }}
                />
                <MDBox mt={2}>
                  <MDTypography variant="h4" textAlign="left">
                    Product Image
                  </MDTypography>
                  <MDTypography variant="button" color="text" display="block" textAlign="left" mt={1}>
                    Update product photo below.
                  </MDTypography>
                  <MDBox mt={2}>
                    <MDBox display="flex" justifyContent="flex-start">
                      <MDButton variant="outlined" color="dark" component="label">
                        Upload Photo
                        <input hidden type="file" accept="image/*" onChange={onPickPhoto} />
                      </MDButton>
                    </MDBox>
                  </MDBox>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>

          <Grid item xs={12} lg={8} sx={{ display: "flex" }}>
            <Card sx={{ width: "100%", height: "100%" }}>
              <MDBox p={3}>
                <MDTypography variant="h4" fontWeight="medium" mb={2}>
                  Product Information
                </MDTypography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MDInput label="Name" fullWidth value={form.title} disabled={!canEditCore} onChange={(e) => set("title", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput label="Weight (kg)" type="number" fullWidth value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="Category" fullWidth value={form.category} disabled={!canEditCore} onChange={(e) => set("category", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="Price" type="number" fullWidth value={form.pricePerUnit} disabled={!canEditCore} onChange={(e) => set("pricePerUnit", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="Currency" fullWidth value={form.currency} disabled={!canEditCore} onChange={(e) => set("currency", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="Unit" fullWidth value={form.unit} disabled={!canEditCore} onChange={(e) => set("unit", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="County" fullWidth value={form.county} disabled={!canEditCore} onChange={(e) => set("county", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput
                      label="Available From"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={form.availableFrom}
                      disabled={!canEditCore}
                      onChange={(e) => set("availableFrom", e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <MDTypography variant="button" color="text">
                      Status: {formatStatus(form.status)}
                    </MDTypography>
                  </Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default EditProduct;
