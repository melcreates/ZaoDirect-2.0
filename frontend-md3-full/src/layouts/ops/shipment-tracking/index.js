import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/http.service";
import { toStatusLabel } from "utils/statusLabel";

function ShipmentTracking() {
  const [batches, setBatches] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    batchId: "",
    milestone: "PICKUP_SCHEDULED",
    eventTime: "",
    location: "",
    notes: "",
  });
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");

  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  const loadEvents = async (batchId = "") => {
    const path = batchId ? `/api/ops/shipment-events?batchId=${batchId}` : "/ops/shipment-events";
    const data = await HttpService.get(path);
    setEvents(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [batchData] = await Promise.all([HttpService.get("/ops/batches"), loadEvents()]);
        if (!mounted) return;
        setBatches(Array.isArray(batchData) ? batchData : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load shipment tracking data.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const onFilterBatch = async (batchId) => {
    setSelectedBatchId(batchId);
    setForm((prev) => ({ ...prev, batchId }));
    setError("");
    try {
      await loadEvents(batchId);
    } catch (e) {
      setError(e?.message || "Failed to load shipment events.");
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.post("/ops/shipment-events", {
        batchId: form.batchId,
        milestone: form.milestone,
        eventTime: form.eventTime || undefined,
        location: form.location || undefined,
        notes: form.notes || undefined,
      });
      setNotice("Shipment milestone added.");
      await loadEvents(selectedBatchId);
      setForm((prev) => ({ ...prev, milestone: "PICKUP_SCHEDULED", eventTime: "", location: "", notes: "" }));
    } catch (err) {
      setError(err?.message || "Failed to save shipment milestone.");
    } finally {
      setSaving(false);
    }
  };

  const exportTimelineCsv = () => {
    const start = exportStartDate ? new Date(exportStartDate) : null;
    const end = exportEndDate ? new Date(exportEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const headers = ["Batch", "Client", "Milestone", "Event Time", "Location", "Notes"];
    const rows = events
      .filter((ev) => {
        const dt = ev.event_time ? new Date(ev.event_time) : null;
        if (!dt) return !start && !end;
        if (start && dt < start) return false;
        if (end && dt > end) return false;
        return true;
      })
      .map((ev) => [
      ev.batch_code || "",
      ev.buyer_name || "",
      ev.milestone || "",
      ev.event_time ? new Date(ev.event_time).toISOString() : "",
      ev.location || "",
      ev.notes || "",
      ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaodirect-shipment-timeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "batch", accessor: "batch", align: "left" },
      { Header: "buyer", accessor: "buyer", align: "left" },
      { Header: "milestone", accessor: "milestone", align: "left" },
      { Header: "event time", accessor: "eventTime", align: "left" },
      { Header: "location", accessor: "location", align: "left" },
      { Header: "notes", accessor: "notes", align: "left" },
    ];
    const rows = events.map((ev) => ({
      batch: ev.batch_code || "-",
      buyer: ev.buyer_name || "-",
      milestone: toStatusLabel(ev.milestone),
      eventTime: ev.event_time ? new Date(ev.event_time).toLocaleString() : "-",
      location: ev.location || "-",
      notes: ev.notes || "-",
    }));
    return { columns, rows };
  }, [events]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDBox>
            <MDTypography variant="h4" fontWeight="bold">Shipment Tracking</MDTypography>
            <MDTypography variant="button" color="text">
              Track every batch milestone from pickup through delivery.
            </MDTypography>
          </MDBox>
          <MDBox display="flex" gap={1}>
            <TextField type="date" label="From" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <TextField type="date" label="To" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
          <MDButton variant="outlined" color="info" onClick={exportTimelineCsv}>
            Export Timeline CSV
          </MDButton>
          </MDBox>
        </MDBox>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        {notice && <MDTypography color="success" variant="button">{notice}</MDTypography>}

        <MDBox mt={2}>
          <Card>
            <MDBox p={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    select
                    label="Filter / Select Batch"
                    value={selectedBatchId}
                    onChange={(e) => onFilterBatch(e.target.value)}
                    sx={uniformFieldSx}
                  >
                    <MenuItem value="">All Batches</MenuItem>
                    {batches.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {`${b.batch_code} - ${b.crop_type} (${b.buyer_name || "No buyer"})`}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
              </Grid>
            </MDBox>
          </Card>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3} component="form" onSubmit={onSubmit}>
              <MDTypography variant="h6">Add Milestone</MDTypography>
              <Grid container spacing={2} mt={0.5}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    required
                    label="Batch"
                    value={form.batchId}
                    onChange={(e) => setForm((prev) => ({ ...prev, batchId: e.target.value }))}
                    sx={uniformFieldSx}
                  >
                    {batches.map((b) => (
                      <MenuItem key={b.id} value={b.id}>
                        {`${b.batch_code} - ${b.crop_type}`}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    select
                    label="Milestone"
                    value={form.milestone}
                    onChange={(e) => setForm((prev) => ({ ...prev, milestone: e.target.value }))}
                    sx={uniformFieldSx}
                  >
                    <MenuItem value="PICKUP_SCHEDULED">{toStatusLabel("PICKUP_SCHEDULED")}</MenuItem>
                    <MenuItem value="PICKED_UP">{toStatusLabel("PICKED_UP")}</MenuItem>
                    <MenuItem value="AT_AGGREGATION">{toStatusLabel("AT_AGGREGATION")}</MenuItem>
                    <MenuItem value="AT_PORT">{toStatusLabel("AT_PORT")}</MenuItem>
                    <MenuItem value="IN_FLIGHT">{toStatusLabel("IN_FLIGHT")}</MenuItem>
                    <MenuItem value="CUSTOMS_CLEARANCE">{toStatusLabel("CUSTOMS_CLEARANCE")}</MenuItem>
                    <MenuItem value="DELIVERED">{toStatusLabel("DELIVERED")}</MenuItem>
                    <MenuItem value="EXCEPTION">{toStatusLabel("EXCEPTION")}</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="datetime-local"
                    label="Event Time"
                    value={form.eventTime}
                    onChange={(e) => setForm((prev) => ({ ...prev, eventTime: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Location"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Notes"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </Grid>
              </Grid>
              <MDBox mt={2} display="flex" justifyContent="flex-end">
                <MDButton type="submit" variant="gradient" color="info" disabled={saving || !form.batchId}>
                  {saving ? "Saving..." : "Save Milestone"}
                </MDButton>
              </MDBox>
            </MDBox>
          </Card>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">Shipment Timeline</MDTypography>
            </MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default ShipmentTracking;

