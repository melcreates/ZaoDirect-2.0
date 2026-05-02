import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

function OrderSummary() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [orders, documents] = await Promise.all([
          HttpService.get("/api/orders"),
          HttpService.get(`/api/orders/${id}/documents`),
        ]);
        if (!mounted) return;
        const found = (Array.isArray(orders) ? orders : []).find((o) => o.id === id) || null;
        setOrder(found);
        setDocs(Array.isArray(documents) ? documents : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load order summary.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const verifiedCount = useMemo(() => docs.filter((d) => d.verified).length, [docs]);

  const exportCsv = () => {
    if (!order) return;
    const headers = ["Order ID", "Listing", "Client", "Farmer", "Status", "Requested Qty", "Unit", "Offer Price", "Currency", "Flight", "AWB", "ETA", "Tracking"];
    const rows = [[
      order.id,
      order.listing_title || order.listing_id || "",
      order.buyer_name || "",
      order.farmer_name || "",
      order.status || "",
      order.requested_qty || "",
      order.unit || "",
      order.offer_price || "",
      order.currency || "",
      order.shipment_flight_number || "",
      order.shipment_awb_number || "",
      order.shipment_eta ? new Date(order.shipment_eta).toISOString() : "",
      order.shipment_tracking_status || "",
    ]];
    const csv = [headers, ...rows].map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaodirect-order-summary-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDTypography variant="h4" fontWeight="bold">Order Summary</MDTypography>
          <MDBox display="flex" gap={1}>
            <MDButton variant="outlined" color="info" onClick={() => window.print()}>Print</MDButton>
            <MDButton variant="outlined" color="info" onClick={exportCsv}>Export CSV</MDButton>
          </MDBox>
        </MDBox>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        {!order ? (
          <MDTypography variant="button" color="text">Loading summary...</MDTypography>
        ) : (
          <Grid container spacing={3} mt={0.5}>
            <Grid item xs={12} md={6}>
              <Card><MDBox p={3}>
                <MDTypography variant="h6">Commercial</MDTypography>
                <MDTypography variant="button" display="block">Client: {order.buyer_name || "-"}</MDTypography>
                <MDTypography variant="button" display="block">Farmer: {order.farmer_name || "-"}</MDTypography>
                <MDTypography variant="button" display="block">Listing: {order.listing_title || order.listing_id}</MDTypography>
                <MDTypography variant="button" display="block">Status: {toStatusLabel(order.status)}</MDTypography>
              </MDBox></Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card><MDBox p={3}>
                <MDTypography variant="h6">Shipment</MDTypography>
                <MDTypography variant="button" display="block">Flight: {order.shipment_flight_number || "-"}</MDTypography>
                <MDTypography variant="button" display="block">AWB: {order.shipment_awb_number || "-"}</MDTypography>
                <MDTypography variant="button" display="block">ETA: {order.shipment_eta ? new Date(order.shipment_eta).toLocaleString() : "-"}</MDTypography>
                <MDTypography variant="button" display="block">Tracking: {order.shipment_tracking_status ? toStatusLabel(order.shipment_tracking_status) : "-"}</MDTypography>
              </MDBox></Card>
            </Grid>
            <Grid item xs={12}>
              <Card><MDBox p={3}>
                <MDTypography variant="h6">Compliance Documents</MDTypography>
                <MDTypography variant="button" display="block">Verified: {verifiedCount}/{docs.length}</MDTypography>
                {docs.map((d) => (
                  <MDTypography key={d.id} variant="button" display="block">
                    {d.doc_type} | {d.provided_by} | {d.verified ? "Verified" : "Unverified"}
                  </MDTypography>
                ))}
              </MDBox></Card>
            </Grid>
          </Grid>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default OrderSummary;
