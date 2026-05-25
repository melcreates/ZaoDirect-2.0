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
import HttpService from "services/http.service";
import { toStatusLabel } from "utils/statusLabel";

function BatchSummary() {
  const { id } = useParams();
  const [batch, setBatch] = useState(null);
  const [items, setItems] = useState([]);
  const [checks, setChecks] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [batches, batchItems, qualityChecks, shipmentEvents] = await Promise.all([
          HttpService.get("/ops/batches"),
          HttpService.get(`/ops/batch-items?batchId=${id}`),
          HttpService.get(`/ops/quality-checks?batchId=${id}`),
          HttpService.get(`/ops/shipment-events?batchId=${id}`),
        ]);
        if (!mounted) return;
        const found = (Array.isArray(batches) ? batches : []).find((b) => b.id === id) || null;
        setBatch(found);
        setItems(Array.isArray(batchItems) ? batchItems : []);
        setChecks(Array.isArray(qualityChecks) ? qualityChecks : []);
        setEvents(Array.isArray(shipmentEvents) ? shipmentEvents : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load batch summary.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  const totals = useMemo(() => ({
    accepted: items.reduce((s, i) => s + Number(i.accepted_quantity || 0), 0),
    rejected: items.reduce((s, i) => s + Number(i.rejected_quantity || 0), 0),
  }), [items]);

  const exportCsv = () => {
    if (!batch) return;
    const headers = ["Batch Code", "Crop", "Status", "Total Qty", "Unit", "Accepted Qty", "Rejected Qty", "Quality Checks", "Shipment Events"];
    const rows = [[
      batch.batch_code || "",
      batch.crop_type || "",
      batch.status || "",
      batch.total_quantity || "",
      batch.unit || "",
      totals.accepted,
      totals.rejected,
      checks.length,
      events.length,
    ]];
    const csv = [headers, ...rows].map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaodirect-batch-summary-${id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDTypography variant="h4" fontWeight="bold">Batch Summary</MDTypography>
          <MDBox display="flex" gap={1}>
            <MDButton variant="outlined" color="info" onClick={() => window.print()}>Print</MDButton>
            <MDButton variant="outlined" color="info" onClick={exportCsv}>Export CSV</MDButton>
          </MDBox>
        </MDBox>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        {!batch ? (
          <MDTypography variant="button" color="text">Loading summary...</MDTypography>
        ) : (
          <Grid container spacing={3} mt={0.5}>
            <Grid item xs={12} md={6}>
              <Card><MDBox p={3}>
                <MDTypography variant="h6">Batch Core</MDTypography>
                <MDTypography variant="button" display="block">Batch: {batch.batch_code}</MDTypography>
                <MDTypography variant="button" display="block">Crop: {batch.crop_type}</MDTypography>
                <MDTypography variant="button" display="block">Status: {toStatusLabel(batch.status)}</MDTypography>
                <MDTypography variant="button" display="block">Target Qty: {batch.total_quantity || "-"} {batch.unit || ""}</MDTypography>
              </MDBox></Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card><MDBox p={3}>
                <MDTypography variant="h6">Allocation Totals</MDTypography>
                <MDTypography variant="button" display="block">Accepted: {totals.accepted}</MDTypography>
                <MDTypography variant="button" display="block">Rejected: {totals.rejected}</MDTypography>
                <MDTypography variant="button" display="block">Quality Checks: {checks.length}</MDTypography>
                <MDTypography variant="button" display="block">Shipment Events: {events.length}</MDTypography>
              </MDBox></Card>
            </Grid>
          </Grid>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default BatchSummary;


