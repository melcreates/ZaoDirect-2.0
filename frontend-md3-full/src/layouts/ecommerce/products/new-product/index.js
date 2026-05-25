import { useState } from "react";
import { useNavigate } from "react-router-dom";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDAlert from "components/MDAlert";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";

import HttpService from "services/http.service";

function NewProduct() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "",
    quantity: "",
    unit: "kg",
    pricePerUnit: "",
    currency: "KES",
    county: "",
    availableFrom: "",
    photoUrls: [],
  });

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const handlePhotoFiles = (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          })
      )
    )
      .then((results) => {
        const cleaned = results.filter(Boolean);
        set("photoUrls", cleaned);
      })
      .catch(() => setError("Unable to process selected photos."));
  };

  const submit = async (status = "PUBLISHED") => {
    try {
      setSaving(true);
      setError("");
      const payload = {
        title: form.title,
        category: form.category || null,
        quantity: Number(form.quantity || 0),
        unit: form.unit || "kg",
        pricePerUnit: Number(form.pricePerUnit || 0),
        currency: form.currency || "KES",
        county: form.county || null,
        availableFrom: form.availableFrom || null,
        photoUrls: Array.isArray(form.photoUrls) ? form.photoUrls : [],
        status,
      };
      await HttpService.post("/listings", payload);
      navigate(`/ecommerce/products/product-page?refresh=${Date.now()}`);
    } catch (e) {
      setError(e?.message || "Unable to create product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox mt={5} mb={9}>
        <Grid container justifyContent="center">
          <Grid item xs={12} lg={8}>
            <MDBox mt={2} mb={4} textAlign="center">
              <MDTypography variant="h3" fontWeight="bold">
                Add New Product
              </MDTypography>
              <MDTypography variant="h6" fontWeight="regular" color="secondary">
                Enter your produce details, then publish immediately or save as draft.
              </MDTypography>
            </MDBox>
            <Card>
              <MDBox p={3}>
                {error && (
                  <MDAlert color="error" sx={{ mb: 2 }}>
                    <MDTypography variant="button" color="white">
                      {error}
                    </MDTypography>
                  </MDAlert>
                )}
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <MDInput label="Product Name" fullWidth value={form.title} onChange={(e) => set("title", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput label="Category" fullWidth value={form.category} onChange={(e) => set("category", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="Quantity" type="number" fullWidth value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="Unit (kg, crate, bag)" fullWidth value={form.unit} onChange={(e) => set("unit", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <MDInput label="County" fullWidth value={form.county} onChange={(e) => set("county", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput label="Price Per Unit" type="number" fullWidth value={form.pricePerUnit} onChange={(e) => set("pricePerUnit", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      select
                      label="Currency"
                      variant="outlined"
                      fullWidth
                      value={form.currency}
                      onChange={(e) => set("currency", e.target.value)}
                      InputLabelProps={{ shrink: true }}
                      SelectProps={{ displayEmpty: true }}
                      sx={{
                        "& .MuiInputBase-root": { minHeight: "3.45rem" },
                        "& .MuiSelect-select": { display: "flex", alignItems: "center", minHeight: "3.45rem", boxSizing: "border-box" },
                      }}
                    >
                      <MenuItem value="KES">KES</MenuItem>
                      <MenuItem value="USD">USD</MenuItem>
                    </MDInput>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput label="Available From" type="date" InputLabelProps={{ shrink: true }} fullWidth value={form.availableFrom} onChange={(e) => set("availableFrom", e.target.value)} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <MDInput
                      label="Upload Photos"
                      type="file"
                      fullWidth
                      inputProps={{ accept: "image/*", multiple: true }}
                      InputLabelProps={{ shrink: true }}
                      onChange={handlePhotoFiles}
                    />
                    <MDTypography variant="button" color="text" mt={1} display="block">
                      {form.photoUrls.length ? `${form.photoUrls.length} photo(s) selected` : "No photos selected"}
                    </MDTypography>
                  </Grid>
                </Grid>
                <MDBox mt={3} display="flex" justifyContent="space-between">
                  <MDButton variant="outlined" color="dark" onClick={() => navigate("/ecommerce/products/product-page")}>
                    Cancel
                  </MDButton>
                  <MDBox display="flex" gap={1}>
                    <MDButton variant="outlined" color="info" onClick={() => submit("DRAFT")} disabled={saving}>
                      {saving ? "Saving..." : "Save Draft"}
                    </MDButton>
                    <MDButton variant="gradient" color="info" onClick={() => submit("PUBLISHED")} disabled={saving}>
                      {saving ? "Publishing..." : "Publish Product"}
                    </MDButton>
                  </MDBox>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default NewProduct;



