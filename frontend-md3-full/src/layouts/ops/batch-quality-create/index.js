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
import HttpService from "services/http.service";

function BatchQualityCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [intlOrders, setIntlOrders] = useState([]);
  const [procurementOrders, setProcurementOrders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    internationalOrderId: "",
    batchCode: "",
    cropType: "",
    targetGrade: "",
    destinationCountry: "",
    totalQuantity: "",
    unit: "kg",
    status: "CREATED",
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
        const [data, fpoData] = await Promise.all([
          HttpService.get("/ops/international-orders"),
          HttpService.get("/ops/farmer-purchase-orders"),
        ]);
        if (!mounted) return;
        const orderList = Array.isArray(data) ? data : [];
        setIntlOrders(orderList);
        setProcurementOrders(Array.isArray(fpoData) ? fpoData : []);

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
        setError(e?.message || "Failed to load international orders.");
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
      }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await HttpService.post("/ops/batches", {
        internationalOrderId: form.internationalOrderId,
        batchCode: form.batchCode,
        cropType: form.cropType,
        targetGrade: form.targetGrade || undefined,
        destinationCountry: form.destinationCountry || undefined,
        totalQuantity: form.totalQuantity ? Number(form.totalQuantity) : undefined,
        unit: form.unit,
        status: form.status,
      });
      navigate("/batch-quality");
    } catch (e) {
      setError(e?.message || "Failed to create batch.");
    } finally {
      setSaving(false);
    }
  };

  const selectedOrder = useMemo(
    () => intlOrders.find((o) => o.id === form.internationalOrderId),
    [intlOrders, form.internationalOrderId]
  );

  const confirmedProcurementQty = useMemo(() => {
    if (!selectedOrder?.id) return 0;
    return procurementOrders
      .filter((fpo) => fpo.international_order_id === selectedOrder.id && fpo.status === "CONFIRMED")
      .reduce((sum, fpo) => sum + Number(fpo.quantity || 0), 0);
  }, [procurementOrders, selectedOrder]);

  const requiredQty = Number(selectedOrder?.required_quantity || 0);
  const canCreateBatch = confirmedProcurementQty > 0;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card>
          <MDBox p={3}>
            <MDTypography variant="h4" fontWeight="bold">Create Batch</MDTypography>
            {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
            {selectedOrder && (
              <MDBox mt={1}>
                <MDTypography variant="button" color={canCreateBatch ? "success" : "warning"}>
                  Confirmed procurement: {confirmedProcurementQty} {selectedOrder.unit} / required: {requiredQty} {selectedOrder.unit}
                </MDTypography>
              </MDBox>
            )}
            <MDBox component="form" mt={2} onSubmit={onSubmit}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth select label="International Order" name="internationalOrderId" value={form.internationalOrderId} onChange={onChange} required sx={uniformFieldSx}>
                    {intlOrders.map((o) => (
                      <MenuItem key={o.id} value={o.id}>{`${o.buyer_name} - ${o.crop_type}`}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}><TextField fullWidth label="Batch Code" name="batchCode" value={form.batchCode} onChange={onChange} required sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth label="Crop Type" name="cropType" value={form.cropType} onChange={onChange} required sx={uniformFieldSx} InputProps={{ readOnly: true }} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth label="Target Grade" name="targetGrade" value={form.targetGrade} onChange={onChange} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth label="Destination Country" name="destinationCountry" value={form.destinationCountry} onChange={onChange} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}><TextField fullWidth required type="number" label="Total Quantity" name="totalQuantity" value={form.totalQuantity} onChange={onChange} sx={uniformFieldSx} /></Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth select label="Unit" name="unit" value={form.unit} onChange={onChange} sx={uniformFieldSx}>
                    <MenuItem value="kg">kg</MenuItem>
                    <MenuItem value="ton">ton</MenuItem>
                    <MenuItem value="crate">crate</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField fullWidth select label="Status" name="status" value={form.status} onChange={onChange} sx={uniformFieldSx}>
                    <MenuItem value="CREATED">CREATED</MenuItem>
                    <MenuItem value="COLLECTING">COLLECTING</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <MDBox mt={2} display="flex" justifyContent="space-between">
                <MDButton variant="outlined" color="secondary" onClick={() => navigate("/batch-quality")}>Cancel</MDButton>
                <MDButton type="submit" variant="gradient" color="info" disabled={saving || !canCreateBatch}>
                  {saving ? "Saving..." : "Create Batch"}
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

export default BatchQualityCreate;

