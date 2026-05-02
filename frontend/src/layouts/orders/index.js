import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import AuthService from "services/auth-service";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function Orders() {
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [form, setForm] = useState({
    listingId: "",
    requestedQty: "",
    unit: "kg",
    offerPrice: "",
    currency: "USD",
  });
  const [statusForm, setStatusForm] = useState({ status: "REQUESTED" });
  const [shipmentForm, setShipmentForm] = useState({
    airline: "",
    flightNumber: "",
    awbNumber: "",
    departureAirport: "",
    arrivalAirport: "",
    eta: "",
    trackingStatus: "BOOKED",
    trackingReference: "",
  });
  const [trackingForm, setTrackingForm] = useState({
    trackingStatus: "BOOKED",
    eta: "",
    trackingReference: "",
  });
  const [docForm, setDocForm] = useState({
    docType: "PHYTOSANITARY_CERT",
    docUrl: "",
    providedBy: "CONSYN-AIR",
  });
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [profileData, ordersData, listingsData] = await Promise.all([
          AuthService.getProfile(),
          HttpService.get("/api/orders"),
          HttpService.get("/api/listings?status=PUBLISHED"),
        ]);

        if (!mounted) return;
        setProfile(profileData);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setListings(Array.isArray(listingsData) ? listingsData : []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load orders.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const createOrder = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.post("/api/orders", {
        listingId: form.listingId,
        requestedQty: Number(form.requestedQty),
        unit: form.unit,
        offerPrice: Number(form.offerPrice),
        currency: form.currency,
      });
      const refreshed = await HttpService.get("/api/orders");
      setOrders(Array.isArray(refreshed) ? refreshed : []);
      setNotice("Order created successfully.");
      setDialogOpen(false);
      setForm({
        listingId: "",
        requestedQty: "",
        unit: "kg",
        offerPrice: "",
        currency: "USD",
      });
    } catch (e) {
      setError(e?.message || "Failed to create order.");
    } finally {
      setSaving(false);
    }
  };

  const openOrderDetail = (order) => {
    setSelectedOrder(order);
    setStatusForm({ status: order.status || "REQUESTED" });
    setShipmentForm({
      airline: order.shipment_airline || "",
      flightNumber: order.shipment_flight_number || "",
      awbNumber: order.shipment_awb_number || "",
      departureAirport: order.shipment_departure_airport || "",
      arrivalAirport: order.shipment_arrival_airport || "",
      eta: order.shipment_eta ? new Date(order.shipment_eta).toISOString().slice(0, 16) : "",
      trackingStatus: order.shipment_tracking_status || "BOOKED",
      trackingReference: order.shipment_tracking_reference || "",
    });
    setTrackingForm({
      trackingStatus: order.shipment_tracking_status || "BOOKED",
      eta: order.shipment_eta ? new Date(order.shipment_eta).toISOString().slice(0, 16) : "",
      trackingReference: order.shipment_tracking_reference || "",
    });
    HttpService.get(`/api/orders/${order.id}/documents`)
      .then((data) => setDocuments(Array.isArray(data) ? data : []))
      .catch(() => setDocuments([]));
    setDetailOpen(true);
  };

  const refreshOrders = async () => {
    const refreshed = await HttpService.get("/api/orders");
    setOrders(Array.isArray(refreshed) ? refreshed : []);
    return Array.isArray(refreshed) ? refreshed : [];
  };

  const saveOrderStatus = async () => {
    if (!selectedOrder) return;
    setDetailSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.patch(`/api/orders/${selectedOrder.id}/status`, { status: statusForm.status });
      const refreshed = await refreshOrders();
      const updated = refreshed.find((o) => o.id === selectedOrder.id);
      if (updated) setSelectedOrder(updated);
      setNotice("Order status updated.");
    } catch (e) {
      setError(e?.message || "Failed to update order status.");
    } finally {
      setDetailSaving(false);
    }
  };

  const saveShipment = async () => {
    if (!selectedOrder) return;
    setShipmentSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.post(`/api/orders/${selectedOrder.id}/shipment`, {
        airline: shipmentForm.airline || undefined,
        flightNumber: shipmentForm.flightNumber || undefined,
        awbNumber: shipmentForm.awbNumber || undefined,
        departureAirport: shipmentForm.departureAirport || undefined,
        arrivalAirport: shipmentForm.arrivalAirport || undefined,
        eta: shipmentForm.eta || undefined,
        trackingStatus: shipmentForm.trackingStatus,
        trackingReference: shipmentForm.trackingReference || undefined,
      });
      const refreshed = await refreshOrders();
      const updated = refreshed.find((o) => o.id === selectedOrder.id);
      if (updated) setSelectedOrder(updated);
      setNotice("Shipment details saved.");
    } catch (e) {
      setError(e?.message || "Failed to save shipment.");
    } finally {
      setShipmentSaving(false);
    }
  };

  const saveTracking = async () => {
    if (!selectedOrder) return;
    setTrackingSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.patch(`/api/orders/${selectedOrder.id}/shipment/tracking`, {
        trackingStatus: trackingForm.trackingStatus,
        eta: trackingForm.eta || undefined,
        trackingReference: trackingForm.trackingReference || undefined,
      });
      const refreshed = await refreshOrders();
      const updated = refreshed.find((o) => o.id === selectedOrder.id);
      if (updated) setSelectedOrder(updated);
      setNotice("Tracking updated.");
    } catch (e) {
      setError(e?.message || "Failed to update tracking.");
    } finally {
      setTrackingSaving(false);
    }
  };

  const saveDocument = async () => {
    if (!selectedOrder) return;
    setError("");
    setNotice("");
    try {
      await HttpService.post(`/api/orders/${selectedOrder.id}/documents`, {
        docType: docForm.docType,
        docUrl: docForm.docUrl,
        providedBy: docForm.providedBy || "CONSYN-AIR",
      });
      const docs = await HttpService.get(`/api/orders/${selectedOrder.id}/documents`);
      setDocuments(Array.isArray(docs) ? docs : []);
      setDocForm({ docType: "PHYTOSANITARY_CERT", docUrl: "", providedBy: "CONSYN-AIR" });
      setNotice("Document added.");
    } catch (e) {
      setError(e?.message || "Failed to add document.");
    }
  };

  const toggleVerified = async (docId, verified) => {
    if (!selectedOrder) return;
    try {
      await HttpService.patch(`/api/orders/${selectedOrder.id}/documents/${docId}`, { verified: !verified });
      const docs = await HttpService.get(`/api/orders/${selectedOrder.id}/documents`);
      setDocuments(Array.isArray(docs) ? docs : []);
    } catch (e) {
      setError(e?.message || "Failed to update document verification.");
    }
  };

  const exportCsv = () => {
    const start = exportStartDate ? new Date(exportStartDate) : null;
    const end = exportEndDate ? new Date(exportEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const filteredOrders = orders.filter((o) => {
      const updated = o.updated_at ? new Date(o.updated_at) : null;
      if (!updated) return !start && !end;
      if (start && updated < start) return false;
      if (end && updated > end) return false;
      return true;
    });
    const headers = [
      "Order",
      "Client",
      "Farmer",
      "Requested Qty",
      "Unit",
      "Offer Price",
      "Currency",
      "Status",
      "Flight",
      "AWB",
      "ETA",
      "Tracking",
      "Updated",
    ];
    const rows = filteredOrders.map((o) => [
      o.listing_title || o.listing_id || "",
      o.buyer_name || "",
      o.farmer_name || "",
      o.requested_qty || "",
      o.unit || "",
      o.offer_price || "",
      o.currency || "",
      o.status || "",
      o.shipment_flight_number || "",
      o.shipment_awb_number || "",
      o.shipment_eta ? new Date(o.shipment_eta).toISOString() : "",
      o.shipment_tracking_status || "",
      o.updated_at ? new Date(o.updated_at).toISOString() : "",
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaodirect-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const openStatuses = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "SHIPPED"];
    const openOrders = orders.filter((item) => openStatuses.includes(item.status)).length;
    const completedOrders = orders.filter((item) => item.status === "COMPLETED").length;
    const shippedOrders = orders.filter((item) => item.status === "SHIPPED").length;

    return {
      total: orders.length,
      openOrders,
      completedOrders,
      shippedOrders,
    };
  }, [orders]);

  const orderTable = useMemo(() => {
    const columns = [
      { Header: "order", accessor: "order", align: "left" },
      { Header: "counterparty", accessor: "counterparty", align: "left" },
      { Header: "qty", accessor: "qty", align: "left" },
      { Header: "offer", accessor: "offer", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "flight", accessor: "flight", align: "left" },
      { Header: "awb", accessor: "awb", align: "left" },
      { Header: "eta", accessor: "eta", align: "left" },
      { Header: "tracking", accessor: "tracking", align: "left" },
      { Header: "updated", accessor: "updated", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];

    const rows = orders.map((item) => {
      const counterparty =
        profile?.role === "FARMER"
          ? item.buyer_name
          : `${item.buyer_name} -> ${item.farmer_name}`;

      return {
        order: item.listing_title || item.listing_id,
        counterparty: counterparty || "-",
        qty: `${item.requested_qty} ${item.unit}`,
        offer: currencyFormatter.format(Number(item.offer_price || 0)),
        status: toStatusLabel(item.status),
        flight: item.shipment_flight_number || "-",
        awb: item.shipment_awb_number || "-",
        eta: formatDate(item.shipment_eta),
        tracking: item.shipment_tracking_status ? toStatusLabel(item.shipment_tracking_status) : "-",
        updated: formatDate(item.updated_at),
        action: (
          <MDButton size="small" variant="text" color="info" onClick={() => openOrderDetail(item)}>
            Open
          </MDButton>
        ),
      };
    });

    return { columns, rows };
  }, [orders, profile?.role]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDBox>
          <MDTypography variant="h4" fontWeight="bold">
            Orders
          </MDTypography>
          <MDTypography variant="button" color="text" fontWeight="regular">
            End-to-end order tracking for farmers and operations admins.
          </MDTypography>
          </MDBox>
          <MDBox display="flex" gap={1}>
            <TextField type="date" label="From" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <TextField type="date" label="To" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <MDButton variant="outlined" color="info" onClick={exportCsv}>
              Export CSV
            </MDButton>
            {profile?.role === "ADMIN" && (
              <MDButton variant="gradient" color="info" onClick={() => setDialogOpen(true)}>
                Create Order
              </MDButton>
            )}
          </MDBox>
        </MDBox>

        {error && (
          <Card sx={{ mb: 3 }}>
            <MDBox p={2}>
              <MDTypography variant="button" color="error" fontWeight="medium">
                {error}
              </MDTypography>
            </MDBox>
          </Card>
        )}
        {notice && (
          <Card sx={{ mb: 3 }}>
            <MDBox p={2}>
              <MDTypography variant="button" color="success" fontWeight="medium">
                {notice}
              </MDTypography>
            </MDBox>
          </Card>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="info"
              icon="receipt_long"
              title="Total Orders"
              count={stats.total}
              percentage={{ color: "info", amount: "", label: loading ? "Loading..." : "Order records" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="warning"
              icon="autorenew"
              title="Open Orders"
              count={stats.openOrders}
              percentage={{ color: "warning", amount: "", label: loading ? "Loading..." : "In progress pipeline" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="primary"
              icon="flight_takeoff"
              title="Shipped"
              count={stats.shippedOrders}
              percentage={{ color: "primary", amount: "", label: loading ? "Loading..." : "Awaiting delivery" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="success"
              icon="done_all"
              title="Completed"
              count={stats.completedOrders}
              percentage={{ color: "success", amount: "", label: loading ? "Loading..." : "Delivered/closed" }}
            />
          </Grid>
        </Grid>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6" fontWeight="medium">
                Order Activity
              </MDTypography>
            </MDBox>
            <Divider />
            {orderTable.rows.length > 0 ? (
              <DataTable
                table={orderTable}
                showTotalEntries={false}
                isSorted={false}
                noEndBorder
                entriesPerPage={false}
              />
            ) : (
              <MDBox p={3}>
                <MDTypography variant="button" color="text">
                  No orders found for your account yet.
                </MDTypography>
              </MDBox>
            )}
          </Card>
        </MDBox>
      </MDBox>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Order</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <TextField
              fullWidth
              select
              label="Published Listing"
              value={form.listingId}
              onChange={(e) => setForm((prev) => ({ ...prev, listingId: e.target.value }))}
              sx={uniformFieldSx}
            >
              {listings.map((l) => (
                <MenuItem key={l.id} value={l.id}>{`${l.title} - ${l.farmer_name} (${l.quantity} ${l.unit})`}</MenuItem>
              ))}
            </TextField>
            <MDBox mt={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Requested Quantity"
                    value={form.requestedQty}
                    onChange={(e) => setForm((prev) => ({ ...prev, requestedQty: e.target.value }))}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Unit"
                    value={form.unit}
                    onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                    sx={uniformFieldSx}
                  >
                    <MenuItem value="kg">kg</MenuItem>
                    <MenuItem value="ton">ton</MenuItem>
                    <MenuItem value="crate">crate</MenuItem>
                    <MenuItem value="bag">bag</MenuItem>
                    <MenuItem value="piece">piece</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Offer Price"
                    value={form.offerPrice}
                    onChange={(e) => setForm((prev) => ({ ...prev, offerPrice: e.target.value }))}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Currency"
                    value={form.currency}
                    onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                    sx={uniformFieldSx}
                  >
                    <MenuItem value="USD">USD</MenuItem>
                    <MenuItem value="KES">KES</MenuItem>
                    <MenuItem value="EUR">EUR</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
            </MDBox>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>
            Cancel
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={createOrder}
            disabled={
              saving ||
              !form.listingId ||
              !form.requestedQty ||
              Number(form.requestedQty) <= 0 ||
              !form.offerPrice ||
              Number(form.offerPrice) < 0
            }
          >
            {saving ? "Saving..." : "Create"}
          </MDButton>
        </DialogActions>
      </Dialog>
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Order Detail</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <MDTypography variant="button" color="text">
              {selectedOrder ? `${selectedOrder.listing_title || selectedOrder.listing_id} | ${selectedOrder.buyer_name || "-"} -> ${selectedOrder.farmer_name || "-"}` : ""}
            </MDTypography>
          </MDBox>
          <MDBox mt={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <TextField fullWidth select label="Order Status" value={statusForm.status} onChange={(e) => setStatusForm({ status: e.target.value })} sx={uniformFieldSx}>
                  <MenuItem value="REQUESTED">{toStatusLabel("REQUESTED")}</MenuItem>
                  <MenuItem value="ACCEPTED">{toStatusLabel("ACCEPTED")}</MenuItem>
                  <MenuItem value="IN_PROGRESS">{toStatusLabel("IN_PROGRESS")}</MenuItem>
                  <MenuItem value="SHIPPED">{toStatusLabel("SHIPPED")}</MenuItem>
                  <MenuItem value="COMPLETED">{toStatusLabel("COMPLETED")}</MenuItem>
                  <MenuItem value="CANCELLED">{toStatusLabel("CANCELLED")}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <MDButton fullWidth variant="gradient" color="info" sx={{ height: "56px" }} onClick={saveOrderStatus} disabled={detailSaving}>
                  {detailSaving ? "Saving..." : "Update Status"}
                </MDButton>
              </Grid>
            </Grid>
          </MDBox>

          <MDBox mt={3}>
            <MDTypography variant="h6">Shipment Details</MDTypography>
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12} md={6}><TextField fullWidth label="Airline" value={shipmentForm.airline} onChange={(e) => setShipmentForm((p) => ({ ...p, airline: e.target.value }))} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="Flight Number" value={shipmentForm.flightNumber} onChange={(e) => setShipmentForm((p) => ({ ...p, flightNumber: e.target.value }))} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="AWB Number" value={shipmentForm.awbNumber} onChange={(e) => setShipmentForm((p) => ({ ...p, awbNumber: e.target.value }))} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth type="datetime-local" label="ETA" value={shipmentForm.eta} onChange={(e) => setShipmentForm((p) => ({ ...p, eta: e.target.value }))} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="Departure Airport" value={shipmentForm.departureAirport} onChange={(e) => setShipmentForm((p) => ({ ...p, departureAirport: e.target.value }))} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="Arrival Airport" value={shipmentForm.arrivalAirport} onChange={(e) => setShipmentForm((p) => ({ ...p, arrivalAirport: e.target.value }))} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth select label="Tracking Status" value={shipmentForm.trackingStatus} onChange={(e) => setShipmentForm((p) => ({ ...p, trackingStatus: e.target.value }))} sx={uniformFieldSx}>
                  <MenuItem value="PENDING">{toStatusLabel("PENDING")}</MenuItem>
                  <MenuItem value="BOOKED">{toStatusLabel("BOOKED")}</MenuItem>
                  <MenuItem value="IN_AIR">{toStatusLabel("IN_AIR")}</MenuItem>
                  <MenuItem value="LANDED">{toStatusLabel("LANDED")}</MenuItem>
                  <MenuItem value="DELIVERED">{toStatusLabel("DELIVERED")}</MenuItem>
                  <MenuItem value="DELAYED">{toStatusLabel("DELAYED")}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}><TextField fullWidth label="Tracking Reference" value={shipmentForm.trackingReference} onChange={(e) => setShipmentForm((p) => ({ ...p, trackingReference: e.target.value }))} sx={uniformFieldSx} /></Grid>
            </Grid>
            <MDBox mt={2} display="flex" justifyContent="flex-end">
              <MDButton variant="gradient" color="info" onClick={saveShipment} disabled={shipmentSaving || (!shipmentForm.flightNumber && !shipmentForm.awbNumber && !shipmentForm.trackingReference)}>
                {shipmentSaving ? "Saving..." : "Save Shipment"}
              </MDButton>
            </MDBox>
          </MDBox>

          <MDBox mt={3}>
            <MDTypography variant="h6">Tracking Update</MDTypography>
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth select label="Tracking Status" value={trackingForm.trackingStatus} onChange={(e) => setTrackingForm((p) => ({ ...p, trackingStatus: e.target.value }))} sx={uniformFieldSx}>
                  <MenuItem value="PENDING">{toStatusLabel("PENDING")}</MenuItem>
                  <MenuItem value="BOOKED">{toStatusLabel("BOOKED")}</MenuItem>
                  <MenuItem value="IN_AIR">{toStatusLabel("IN_AIR")}</MenuItem>
                  <MenuItem value="LANDED">{toStatusLabel("LANDED")}</MenuItem>
                  <MenuItem value="DELIVERED">{toStatusLabel("DELIVERED")}</MenuItem>
                  <MenuItem value="DELAYED">{toStatusLabel("DELAYED")}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}><TextField fullWidth type="datetime-local" label="ETA" value={trackingForm.eta} onChange={(e) => setTrackingForm((p) => ({ ...p, eta: e.target.value }))} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth label="Tracking Reference" value={trackingForm.trackingReference} onChange={(e) => setTrackingForm((p) => ({ ...p, trackingReference: e.target.value }))} sx={uniformFieldSx} /></Grid>
            </Grid>
            <MDBox mt={2} display="flex" justifyContent="flex-end">
              <MDButton variant="gradient" color="info" onClick={saveTracking} disabled={trackingSaving}>
                {trackingSaving ? "Saving..." : "Update Tracking"}
              </MDButton>
            </MDBox>
          </MDBox>

          <MDBox mt={3}>
            <MDTypography variant="h6">Compliance Documents</MDTypography>
            <Grid container spacing={2} mt={0.5}>
              <Grid item xs={12} md={4}>
                <TextField fullWidth select label="Document Type" value={docForm.docType} onChange={(e) => setDocForm((p) => ({ ...p, docType: e.target.value }))} sx={uniformFieldSx}>
                  <MenuItem value="PHYTOSANITARY_CERT">Phytosanitary Cert</MenuItem>
                  <MenuItem value="COMMERCIAL_INVOICE">Commercial Invoice</MenuItem>
                  <MenuItem value="PACKING_LIST">Packing List</MenuItem>
                  <MenuItem value="AIRWAY_BILL">Airway Bill</MenuItem>
                  <MenuItem value="OTHER">Other</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Document URL" value={docForm.docUrl} onChange={(e) => setDocForm((p) => ({ ...p, docUrl: e.target.value }))} sx={uniformFieldSx} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Provided By" value={docForm.providedBy} onChange={(e) => setDocForm((p) => ({ ...p, providedBy: e.target.value }))} sx={uniformFieldSx} />
              </Grid>
            </Grid>
            <MDBox mt={2} display="flex" justifyContent="flex-end">
              <MDButton variant="gradient" color="info" onClick={saveDocument} disabled={!docForm.docUrl}>
                Add Document
              </MDButton>
            </MDBox>

            <MDBox mt={2}>
              {documents.length === 0 ? (
                <MDTypography variant="button" color="text">No documents yet.</MDTypography>
              ) : (
                documents.map((doc) => (
                  <MDBox key={doc.id} display="flex" justifyContent="space-between" alignItems="center" py={0.75}>
                    <MDTypography variant="button" color="text">
                      {doc.doc_type} | {doc.provided_by} | {doc.verified ? "Verified" : "Unverified"}
                    </MDTypography>
                    <MDBox display="flex" gap={1}>
                      <MDButton size="small" variant="text" color="info" onClick={() => window.open(doc.doc_url, "_blank")}>
                        View
                      </MDButton>
                      <MDButton size="small" variant="text" color={doc.verified ? "warning" : "success"} onClick={() => toggleVerified(doc.id, doc.verified)}>
                        {doc.verified ? "Mark Unverified" : "Mark Verified"}
                      </MDButton>
                    </MDBox>
                  </MDBox>
                ))
              )}
            </MDBox>
          </MDBox>
        </DialogContent>
        <DialogActions>
          {selectedOrder && (
            <MDButton
              component={Link}
              to={`/orders/${selectedOrder.id}/summary`}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              color="info"
            >
              Order Summary
            </MDButton>
          )}
          <MDButton variant="text" color="secondary" onClick={() => setDetailOpen(false)}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <Footer />
    </DashboardLayout>
  );
}

export default Orders;
