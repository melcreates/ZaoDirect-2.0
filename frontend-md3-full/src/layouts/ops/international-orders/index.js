import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Alert from "@mui/material/Alert";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import HttpService from "services/http.service";
import { toStatusLabel } from "utils/statusLabel";

function InternationalOrders() {
  const [orders, setOrders] = useState([]);
  const [procurementOrders, setProcurementOrders] = useState([]);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState("");
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
        setOrders(Array.isArray(data) ? data : []);
        setProcurementOrders(Array.isArray(fpoData) ? fpoData : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load international orders.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const openOrderDialog = (order) => {
    setSelectedOrder(order);
    setStatusError("");
    setDialogOpen(true);
  };

  const cancelOrder = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    setStatusError("");
    try {
      await HttpService.patch(`/api/ops/international-orders/${selectedOrder.id}/status`, { status: "CANCELLED" });
      const [refreshed, refreshedFpo] = await Promise.all([
        HttpService.get("/ops/international-orders"),
        HttpService.get("/ops/farmer-purchase-orders"),
      ]);
      setOrders(Array.isArray(refreshed) ? refreshed : []);
      setProcurementOrders(Array.isArray(refreshedFpo) ? refreshedFpo : []);
      setDialogOpen(false);
      setSelectedOrder(null);
    } catch (e) {
      const message = e?.message || "Failed to update order status.";
      setStatusError(message);
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const open = orders.filter((o) => o.status === "OPEN").length;
    const procurement = orders.filter((o) => o.status === "PROCUREMENT").length;
    const partial = orders.filter((o) => o.status === "PARTIALLY_SHIPPED").length;
    const shipped = orders.filter((o) => ["SHIPPED", "DELIVERED"].includes(o.status)).length;
    return { open, procurement, partial, shipped };
  }, [orders]);

  const confirmedCoverageByOrder = useMemo(() => {
    const map = new Map();
    procurementOrders.forEach((fpo) => {
      if (!fpo.international_order_id || fpo.status !== "CONFIRMED") return;
      const current = Number(map.get(fpo.international_order_id) || 0);
      map.set(fpo.international_order_id, current + Number(fpo.quantity || 0));
    });
    return map;
  }, [procurementOrders]);

  const table = useMemo(() => {
    const columns = [
      { Header: "buyer", accessor: "buyer", align: "left" },
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "qty", accessor: "qty", align: "left" },
      { Header: "price", accessor: "price", align: "left" },
      { Header: "order value", accessor: "orderValue", align: "left" },
      { Header: "shipped", accessor: "shipped", align: "left" },
      { Header: "remaining", accessor: "remaining", align: "left" },
      { Header: "fulfillment", accessor: "fulfillment", align: "left" },
      { Header: "target ship", accessor: "ship", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    const rows = orders.map((o) => {
      const confirmedQty = Number(confirmedCoverageByOrder.get(o.id) || 0);
      const requiredQty = Number(o.required_quantity || 0);
      const isLockedForNewFlow = ["SHIPPED", "DELIVERED", "CANCELLED"].includes(o.status);
      const canCreateProcurement = !isLockedForNewFlow;
      const canCreateBatch = confirmedQty > 0 && !isLockedForNewFlow;
      const shippedQty = Number(o.shipped_quantity || 0);
      const fulfillmentPct = requiredQty > 0 ? Math.min(Math.round((shippedQty / requiredQty) * 100), 100) : 0;
      const fulfillmentColor =
        fulfillmentPct >= 100 ? "success" : fulfillmentPct > 0 ? "warning" : "secondary";

      return {
      buyer: o.buyer_company || o.buyer_name,
      crop: o.crop_type,
      qty: `${o.required_quantity} ${o.unit}`,
      price: `${o.currency || "USD"} ${Number(o.target_price || 0).toLocaleString()}`,
      orderValue: `${o.currency || "USD"} ${Number(requiredQty * Number(o.target_price || 0)).toLocaleString()}`,
      shipped: `${shippedQty} ${o.unit}`,
      remaining: `${Number(o.remaining_quantity || 0)} ${o.unit}`,
      fulfillment: (
        <MDBadge
          badgeContent={`${fulfillmentPct}%`}
          color={fulfillmentColor}
          variant="gradient"
          size="sm"
          container
        />
      ),
      ship: o.expected_ship_date ? new Date(o.expected_ship_date).toLocaleDateString() : "-",
      status: toStatusLabel(o.status),
      action: (
        <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
          <MDButton size="small" variant="text" color="info" onClick={() => openOrderDialog(o)}>
            Open
          </MDButton>
          <MDButton
            size="small"
            variant="text"
            color="dark"
            component={Link}
            to={`/farmer-procurement/new?orderId=${encodeURIComponent(o.id)}`}
            disabled={!canCreateProcurement}
          >
            Create Procurement
          </MDButton>
          <MDButton
            size="small"
            variant="text"
            color="success"
            component={Link}
            to={`/batch-quality/new?orderId=${encodeURIComponent(o.id)}`}
            disabled={!canCreateBatch}
          >
            Create Batch
          </MDButton>
        </MDBox>
      ),
      };
    });
    return { columns, rows };
  }, [orders, confirmedCoverageByOrder]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDTypography variant="h4" fontWeight="bold">International Orders</MDTypography>
          <MDButton component={Link} to="/international-orders/new" variant="gradient" color="info">
            Create Order
          </MDButton>
        </MDBox>
        <MDTypography variant="button" color="text">Overseas demand intake and export commitment tracking.</MDTypography>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard color="warning" icon="pending_actions" title="Open" count={stats.open} percentage={{ color: "warning", amount: "", label: "Ready for first batch" }} /></Grid>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard color="info" icon="inventory_2" title="Procurement" count={stats.procurement} percentage={{ color: "info", amount: "", label: "Batches being built" }} /></Grid>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard color="dark" icon="local_shipping" title="Partially shipped" count={stats.partial} percentage={{ color: "dark", amount: "", label: "More quantity pending" }} /></Grid>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard color="primary" icon="flight_takeoff" title="Shipped" count={stats.shipped} percentage={{ color: "primary", amount: "", label: "Required kg reached" }} /></Grid>
          </Grid>
        </MDBox>
        <MDBox mt={3}>
          <Card>
            <MDBox p={3}><MDTypography variant="h6">Order Book</MDTypography></MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>
      <Footer />
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>International Order</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <MDTypography variant="button" color="text">
              {selectedOrder ? `${selectedOrder.buyer_company || selectedOrder.buyer_name} - ${selectedOrder.crop_type}` : ""}
            </MDTypography>
            <TextField
              fullWidth
              label="Current Status"
              value={selectedOrder ? toStatusLabel(selectedOrder.status) : ""}
              InputProps={{ readOnly: true }}
              sx={{ mt: 2, ...uniformFieldSx }}
            />
            {statusError && (
              <Alert
                severity="error"
                sx={{
                  mt: 2,
                  borderRadius: 2,
                  "& .MuiAlert-message": { fontSize: "0.78rem", lineHeight: 1.4 },
                }}
              >
                {statusError}
              </Alert>
            )}
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>Cancel</MDButton>
          <MDButton
            variant="gradient"
            color="error"
            onClick={cancelOrder}
            disabled={
              saving || !selectedOrder || ["SHIPPED", "DELIVERED", "CANCELLED"].includes(selectedOrder.status)
            }
          >
            {saving ? "Cancelling..." : "Cancel Order"}
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default InternationalOrders;

