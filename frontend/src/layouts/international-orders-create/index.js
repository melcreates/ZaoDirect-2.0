import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";
import { CROP_OPTIONS } from "constants/cropOptions";

function InternationalOrdersCreate() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    buyerName: "",
    buyerCompany: "",
    buyerCountry: "",
    buyerEmail: "",
    cropType: "",
    targetGrade: "",
    requiredQuantity: "",
    unit: "kg",
    targetPrice: "",
    currency: "USD",
    expectedShipDate: "",
  });

  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  const changeHandler = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const submitHandler = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await HttpService.post("/api/ops/international-orders", {
        buyerName: form.buyerName.trim(),
        buyerCompany: form.buyerCompany.trim() || undefined,
        buyerCountry: form.buyerCountry.trim() || undefined,
        buyerEmail: form.buyerEmail.trim() || undefined,
        cropType: form.cropType.trim(),
        targetGrade: form.targetGrade.trim() || undefined,
        requiredQuantity: Number(form.requiredQuantity),
        unit: form.unit,
        targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
        currency: form.currency,
        expectedShipDate: form.expectedShipDate || undefined,
        status: "OPEN",
      });
      navigate("/international-orders");
    } catch (e) {
      setError(e?.message || "Failed to create international order.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card>
          <MDBox p={3}>
            <MDTypography variant="h4" fontWeight="bold">Create International Order</MDTypography>
            <MDTypography variant="button" color="text">
              Account manager captures overseas buyer demand. Status starts as OPEN.
            </MDTypography>
            {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
            <MDBox component="form" mt={2} onSubmit={submitHandler}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}><TextField fullWidth name="buyerName" label="Buyer Name" value={form.buyerName} onChange={changeHandler} required sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth name="buyerCompany" label="Company" value={form.buyerCompany} onChange={changeHandler} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth name="buyerCountry" label="Country" value={form.buyerCountry} onChange={changeHandler} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth type="email" name="buyerEmail" label="Buyer Email" value={form.buyerEmail} onChange={changeHandler} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}>
                  <Autocomplete
                    freeSolo
                    options={CROP_OPTIONS}
                    value={form.cropType}
                    onChange={(_event, value) =>
                      setForm((prev) => ({ ...prev, cropType: typeof value === "string" ? value : value || "" }))
                    }
                    onInputChange={(_event, value) =>
                      setForm((prev) => ({ ...prev, cropType: value || "" }))
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        name="cropType"
                        label="Crop Type"
                        placeholder="Search or type crop"
                        required
                        sx={uniformFieldSx}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={4}><TextField fullWidth name="targetGrade" label="Target Grade" value={form.targetGrade} onChange={changeHandler} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={3}><TextField fullWidth type="number" name="requiredQuantity" label="Required Quantity" value={form.requiredQuantity} onChange={changeHandler} required sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth select name="unit" label="Unit" value={form.unit} onChange={changeHandler} sx={uniformFieldSx}>
                    <MenuItem value="kg">kg</MenuItem>
                    <MenuItem value="ton">ton</MenuItem>
                    <MenuItem value="crate">crate</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    type="number"
                    name="targetPrice"
                    label="Target Price"
                    value={form.targetPrice}
                    onChange={changeHandler}
                    required
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField fullWidth select name="currency" label="Currency" value={form.currency} onChange={changeHandler} sx={uniformFieldSx}>
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                    <MenuItem value="KES">KES</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth type="date" name="expectedShipDate" label="Expected Ship Date" value={form.expectedShipDate} onChange={changeHandler} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
                </Grid>
              </Grid>
              <MDBox mt={2} display="flex" justifyContent="space-between">
                <MDButton variant="outlined" color="secondary" onClick={() => navigate("/international-orders")}>Cancel</MDButton>
                <MDButton type="submit" variant="gradient" color="info" disabled={saving}>
                  {saving ? "Saving..." : "Create Order"}
                </MDButton>
              </MDBox>
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default InternationalOrdersCreate;
