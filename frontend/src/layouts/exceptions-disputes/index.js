import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

const caseTypeOptions = ["PICKUP_SHORTFALL", "QUALITY_REJECTION", "SETTLEMENT_DELAY", "SHIPMENT_ISSUE", "OTHER"];
const severityOptions = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const statusOptions = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"];

function ExceptionsDisputes() {
  const [cases, setCases] = useState([]);
  const [intlOrders, setIntlOrders] = useState([]);
  const [procOrders, setProcOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [createForm, setCreateForm] = useState({
    caseType: "PICKUP_SHORTFALL",
    title: "",
    description: "",
    severity: "MEDIUM",
    internationalOrderId: "",
    farmerPurchaseOrderId: "",
    batchId: "",
    ownerUserId: "",
    dueAt: "",
  });
  const [editForm, setEditForm] = useState({
    status: "OPEN",
    ownerUserId: "",
    dueAt: "",
    resolutionNotes: "",
  });

  const uniformFieldSx = { "& .MuiInputBase-root": { minHeight: "56px" } };

  const loadAll = async () => {
    const [caseData, intData, procData, batchData, userData] = await Promise.all([
      HttpService.get("/api/ops/dispute-cases"),
      HttpService.get("/api/ops/international-orders"),
      HttpService.get("/api/ops/farmer-purchase-orders"),
      HttpService.get("/api/ops/batches"),
      HttpService.get("/api/auth/users"),
    ]);
    setCases(Array.isArray(caseData) ? caseData : []);
    setIntlOrders(Array.isArray(intData) ? intData : []);
    setProcOrders(Array.isArray(procData) ? procData : []);
    setBatches(Array.isArray(batchData) ? batchData : []);
    setAdmins(Array.isArray(userData) ? userData.filter((u) => u.role === "ADMIN") : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await loadAll();
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load dispute cases.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => ({
    open: cases.filter((c) => c.status === "OPEN").length,
    inReview: cases.filter((c) => c.status === "IN_REVIEW").length,
    resolved: cases.filter((c) => c.status === "RESOLVED").length,
    overdue: cases.filter((c) => c.due_at && new Date(c.due_at) < new Date() && !["RESOLVED", "CLOSED"].includes(c.status)).length,
  }), [cases]);

  const caseTable = useMemo(() => {
    const columns = [
      { Header: "case", accessor: "case", align: "left" },
      { Header: "severity", accessor: "severity", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "owner", accessor: "owner", align: "left" },
      { Header: "due", accessor: "due", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    const rows = cases.map((c) => ({
      case: `${toStatusLabel(c.case_type)} - ${c.title}`,
      severity: toStatusLabel(c.severity),
      status: toStatusLabel(c.status),
      owner: c.owner_name || "-",
      due: c.due_at ? new Date(c.due_at).toLocaleDateString() : "-",
      action: <MDButton size="small" variant="text" color="info" onClick={() => openEdit(c)}>Open</MDButton>,
    }));
    return { columns, rows };
  }, [cases]);

  const openEdit = (item) => {
    setSelectedCase(item);
    setEditForm({
      status: item.status || "OPEN",
      ownerUserId: item.owner_user_id || "",
      dueAt: item.due_at ? new Date(item.due_at).toISOString().slice(0, 10) : "",
      resolutionNotes: item.resolution_notes || "",
    });
    setEditOpen(true);
  };

  const submitCreate = async () => {
    setSaving(true);
    setError("");
    try {
      await HttpService.post("/api/ops/dispute-cases", {
        caseType: createForm.caseType,
        title: createForm.title,
        description: createForm.description || undefined,
        severity: createForm.severity,
        internationalOrderId: createForm.internationalOrderId || undefined,
        farmerPurchaseOrderId: createForm.farmerPurchaseOrderId || undefined,
        batchId: createForm.batchId || undefined,
        ownerUserId: createForm.ownerUserId || undefined,
        dueAt: createForm.dueAt || undefined,
      });
      setCreateOpen(false);
      setCreateForm({
        caseType: "PICKUP_SHORTFALL",
        title: "",
        description: "",
        severity: "MEDIUM",
        internationalOrderId: "",
        farmerPurchaseOrderId: "",
        batchId: "",
        ownerUserId: "",
        dueAt: "",
      });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Failed to create case.");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async () => {
    if (!selectedCase) return;
    setSaving(true);
    setError("");
    try {
      await HttpService.patch(`/api/ops/dispute-cases/${selectedCase.id}`, {
        status: editForm.status,
        ownerUserId: editForm.ownerUserId || undefined,
        dueAt: editForm.dueAt || undefined,
        resolutionNotes: editForm.resolutionNotes || undefined,
      });
      setEditOpen(false);
      setSelectedCase(null);
      await loadAll();
    } catch (e) {
      setError(e?.message || "Failed to update case.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDBox>
            <MDTypography variant="h4" fontWeight="bold">Exceptions & Disputes</MDTypography>
            <MDTypography variant="button" color="text">Track shortfalls, quality issues, settlement delays, and shipment incidents.</MDTypography>
          </MDBox>
          <MDButton variant="gradient" color="info" onClick={() => setCreateOpen(true)}>Create Case</MDButton>
        </MDBox>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}

        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard icon="report_problem" title="Open" count={stats.open} percentage={{ color: "dark", amount: "", label: "Requires action" }} /></Grid>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard icon="manage_search" title="In Review" count={stats.inReview} percentage={{ color: "dark", amount: "", label: "Under investigation" }} /></Grid>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard icon="task_alt" title="Resolved" count={stats.resolved} percentage={{ color: "dark", amount: "", label: "Completed resolution" }} /></Grid>
            <Grid item xs={12} md={6} lg={3}><ComplexStatisticsCard icon="timer_off" title="Overdue" count={stats.overdue} percentage={{ color: "dark", amount: "", label: "Past due date" }} /></Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}><MDTypography variant="h6">Case Register</MDTypography></MDBox>
            <Divider />
            <DataTable table={caseTable} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Create Exception/Dispute Case</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}><TextField fullWidth select label="Case Type" value={createForm.caseType} onChange={(e) => setCreateForm((p) => ({ ...p, caseType: e.target.value }))} sx={uniformFieldSx}>{caseTypeOptions.map((o) => <MenuItem key={o} value={o}>{toStatusLabel(o)}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth select label="Severity" value={createForm.severity} onChange={(e) => setCreateForm((p) => ({ ...p, severity: e.target.value }))} sx={uniformFieldSx}>{severityOptions.map((o) => <MenuItem key={o} value={o}>{toStatusLabel(o)}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12}><TextField fullWidth label="Title" value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} sx={uniformFieldSx} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Description" value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))} multiline minRows={2} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth select label="International Order (optional)" value={createForm.internationalOrderId} onChange={(e) => setCreateForm((p) => ({ ...p, internationalOrderId: e.target.value }))} sx={uniformFieldSx}><MenuItem value="">-</MenuItem>{intlOrders.map((o) => <MenuItem key={o.id} value={o.id}>{o.buyer_name} - {o.crop_type}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth select label="Procurement Order (optional)" value={createForm.farmerPurchaseOrderId} onChange={(e) => setCreateForm((p) => ({ ...p, farmerPurchaseOrderId: e.target.value }))} sx={uniformFieldSx}><MenuItem value="">-</MenuItem>{procOrders.map((o) => <MenuItem key={o.id} value={o.id}>{o.farmer_name} - {o.crop_type}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth select label="Batch (optional)" value={createForm.batchId} onChange={(e) => setCreateForm((p) => ({ ...p, batchId: e.target.value }))} sx={uniformFieldSx}><MenuItem value="">-</MenuItem>{batches.map((b) => <MenuItem key={b.id} value={b.id}>{b.batch_code}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth select label="Owner (optional)" value={createForm.ownerUserId} onChange={(e) => setCreateForm((p) => ({ ...p, ownerUserId: e.target.value }))} sx={uniformFieldSx}><MenuItem value="">-</MenuItem>{admins.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth type="date" label="Due Date (optional)" value={createForm.dueAt} onChange={(e) => setCreateForm((p) => ({ ...p, dueAt: e.target.value }))} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} /></Grid>
            </Grid>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setCreateOpen(false)}>Cancel</MDButton>
          <MDButton variant="gradient" color="info" onClick={submitCreate} disabled={saving || !createForm.title.trim()}>{saving ? "Saving..." : "Create Case"}</MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Update Case</DialogTitle>
        <DialogContent>
          <MDBox mt={1} display="flex" flexDirection="column" gap={2}>
            <TextField fullWidth select label="Status" value={editForm.status} onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))} sx={uniformFieldSx}>
              {statusOptions.map((o) => <MenuItem key={o} value={o}>{toStatusLabel(o)}</MenuItem>)}
            </TextField>
            <TextField fullWidth select label="Owner" value={editForm.ownerUserId} onChange={(e) => setEditForm((p) => ({ ...p, ownerUserId: e.target.value }))} sx={uniformFieldSx}>
              <MenuItem value="">-</MenuItem>
              {admins.map((u) => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
            </TextField>
            <TextField fullWidth type="date" label="Due Date" value={editForm.dueAt} onChange={(e) => setEditForm((p) => ({ ...p, dueAt: e.target.value }))} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <TextField fullWidth label="Resolution Notes" value={editForm.resolutionNotes} onChange={(e) => setEditForm((p) => ({ ...p, resolutionNotes: e.target.value }))} multiline minRows={3} />
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setEditOpen(false)}>Cancel</MDButton>
          <MDButton variant="gradient" color="info" onClick={submitEdit} disabled={saving}>{saving ? "Saving..." : "Save"}</MDButton>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default ExceptionsDisputes;

