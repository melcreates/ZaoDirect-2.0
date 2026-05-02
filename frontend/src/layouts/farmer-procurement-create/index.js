import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";

function FarmerProcurementCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [intlOrders, setIntlOrders] = useState([]);
  const [publishedListings, setPublishedListings] = useState([]);
  const [procurementOrders, setProcurementOrders] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    internationalOrderId: "",
    farmerId: "",
    cropType: "",
    expectedGrade: "",
    quantity: "",
    unit: "kg",
    farmGatePrice: "",
    currency: "KES",
    pickupLocation: "",
    pickupDate: "",
    notes: "",
  });

  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [intData, userData, procurementData] = await Promise.all([
          HttpService.get("/api/ops/international-orders"),
          HttpService.get("/api/listings?status=PUBLISHED"),
          HttpService.get("/api/ops/farmer-purchase-orders"),
        ]);
        if (!mounted) return;
        const orderList = Array.isArray(intData) ? intData : [];
        setIntlOrders(orderList);
        setPublishedListings(Array.isArray(userData) ? userData : []);
        setProcurementOrders(Array.isArray(procurementData) ? procurementData : []);

        const prefillOrderId = searchParams.get("orderId");
        if (prefillOrderId) {
          const selectedOrder = orderList.find((o) => o.id === prefillOrderId);
          if (selectedOrder) {
            setForm((prev) => ({
              ...prev,
              internationalOrderId: selectedOrder.id,
              cropType: selectedOrder.crop_type || "",
              unit: selectedOrder.unit || prev.unit,
            }));
          }
        }
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load create procurement form data.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [searchParams]);

  const onChange = (event) => {
    const { name, value } = event.target;
    if (name === "internationalOrderId") {
      const selectedOrder = intlOrders.find((o) => o.id === value);
      setForm((prev) => ({
        ...prev,
        internationalOrderId: value,
        cropType: selectedOrder?.crop_type || "",
        unit: selectedOrder?.unit || prev.unit,
        farmerId: "",
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const matchingFarmers = useMemo(() => {
    if (!form.cropType) return [];
    const crop = form.cropType.trim().toLowerCase();
    const cropTokens = crop.split(/\s+/).filter(Boolean);
    const isListingBlocked = (listingId) =>
      procurementOrders.some((o) => {
        if (o.listing_id !== listingId || o.status === "REJECTED") return false;
        const remaining = Number(o.remaining_weight ?? 0);
        const isTerminal = ["READY_FOR_PICKUP", "PICKED_UP", "SETTLED"].includes(String(o.status || ""));
        return isTerminal || remaining <= 0;
      });
    const filtered = publishedListings.filter(
      (l) => {
        if (isListingBlocked(l.id)) return false;
        const listingCrop = String(l?.crop_type || l?.title || "").trim().toLowerCase();
        if (!listingCrop) return false;
        if (listingCrop.includes(crop) || crop.includes(listingCrop)) return true;
        return cropTokens.every((token) => listingCrop.includes(token));
      }
    );
    const byFarmer = new Map();
    filtered.forEach((l) => {
      if (!l.farmer_id || byFarmer.has(l.farmer_id)) return;
      byFarmer.set(l.farmer_id, {
        farmerId: l.farmer_id,
        farmerName: l.farmer_name || "Farmer",
      });
    });
    return Array.from(byFarmer.values());
  }, [publishedListings, procurementOrders, form.cropType]);

  const matchingListingId = useMemo(() => {
    if (!form.farmerId || !form.cropType) return undefined;
    const crop = form.cropType.trim().toLowerCase();
    const cropTokens = crop.split(/\s+/).filter(Boolean);
    const listing = publishedListings.find(
      (l) =>
        l.farmer_id === form.farmerId &&
        !procurementOrders.some((o) => {
          if (o.listing_id !== l.id || o.status === "REJECTED") return false;
          const remaining = Number(o.remaining_weight ?? 0);
          const isTerminal = ["READY_FOR_PICKUP", "PICKED_UP", "SETTLED"].includes(String(o.status || ""));
          return isTerminal || remaining <= 0;
        }) &&
        (() => {
          const listingCrop = String(l?.crop_type || l?.title || "").trim().toLowerCase();
          if (!listingCrop) return false;
          if (listingCrop.includes(crop) || crop.includes(listingCrop)) return true;
          return cropTokens.every((token) => listingCrop.includes(token));
        })()
    );
    return listing?.id;
  }, [publishedListings, procurementOrders, form.farmerId, form.cropType]);

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await HttpService.post("/api/ops/farmer-purchase-orders", {
        internationalOrderId: form.internationalOrderId,
        farmerId: form.farmerId,
        listingId: matchingListingId,
        cropType: form.cropType,
        expectedGrade: form.expectedGrade || undefined,
        quantity: Number(form.quantity),
        unit: form.unit,
        farmGatePrice: Number(form.farmGatePrice),
        currency: form.currency,
        pickupLocation: form.pickupLocation || undefined,
        pickupDate: form.pickupDate || undefined,
        notes: form.notes || undefined,
      });
      navigate("/farmer-procurement");
    } catch (e) {
      setError(e?.message || "Failed to create procurement order.");
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
            <MDTypography variant="h4" fontWeight="bold">Create Procurement Order</MDTypography>
            <MDTypography variant="button" color="text">
              Starts as open on create. Farmer confirms and marks ready for pickup.
            </MDTypography>
            {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
            <MDBox component="form" mt={2} onSubmit={onSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth select name="internationalOrderId" label="International Order" value={form.internationalOrderId} onChange={onChange} required sx={uniformFieldSx}>
                    {intlOrders.map((o) => (
                      <MenuItem key={o.id} value={o.id}>{`${o.buyer_company || o.buyer_name} - ${o.crop_type}`}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth select name="farmerId" label="Farmer" value={form.farmerId} onChange={onChange} required sx={uniformFieldSx}>
                    {matchingFarmers.map((f) => (
                      <MenuItem key={f.farmerId} value={f.farmerId}>{f.farmerName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}><TextField fullWidth name="cropType" label="Crop Type" value={form.cropType} onChange={onChange} required sx={uniformFieldSx} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth name="expectedGrade" label="Expected Grade" value={form.expectedGrade} onChange={onChange} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth type="number" name="quantity" label="Order Weight (kg)" value={form.quantity} onChange={onChange} required sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth type="number" name="farmGatePrice" label="Farm-Gate Price" value={form.farmGatePrice} onChange={onChange} required sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth select name="currency" label="Currency" value={form.currency} onChange={onChange} sx={uniformFieldSx}>
                    <MenuItem value="KES">KES</MenuItem>
                    <MenuItem value="USD">USD</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}><TextField fullWidth type="date" name="pickupDate" label="Pickup Date" value={form.pickupDate} onChange={onChange} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth name="pickupLocation" label="Pickup Location" value={form.pickupLocation} onChange={onChange} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={6}><TextField fullWidth name="notes" label="Notes" value={form.notes} onChange={onChange} sx={uniformFieldSx} /></Grid>
              </Grid>
              <MDBox mt={2} display="flex" justifyContent="space-between">
                <MDButton variant="outlined" color="secondary" onClick={() => navigate("/farmer-procurement")}>Cancel</MDButton>
                <MDButton type="submit" variant="gradient" color="info" disabled={saving}>
                  {saving ? "Saving..." : "Create Procurement Order"}
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

export default FarmerProcurementCreate;
