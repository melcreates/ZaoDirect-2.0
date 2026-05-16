import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/http.service";
import { toStatusLabel } from "utils/statusLabel";

function FinanceTracker() {
  const [overview, setOverview] = useState({
    totalPayoutValue: 0,
    pendingPayoutValue: 0,
    totalCostValue: 0,
    openInternationalOrders: 0,
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [intlOrders, setIntlOrders] = useState([]);
  const [procurementOrders, setProcurementOrders] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [costs, setCosts] = useState([]);
  const [payoutForm, setPayoutForm] = useState({
    farmerPurchaseOrderId: "",
    farmerId: "",
    amount: "",
    currency: "KES",
    payoutType: "ADVANCE",
    status: "PENDING",
    scheduledFor: "",
    notes: "",
  });
  const [costForm, setCostForm] = useState({
    internationalOrderId: "",
    costType: "PICKUP",
    amount: "",
    currency: "USD",
    vendorName: "",
    notes: "",
  });
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  const loadAll = async () => {
    const [overviewData, intData, fpoData, userData, payoutData, costData] = await Promise.all([
      HttpService.get("/ops/finance-overview"),
      HttpService.get("/ops/international-orders"),
      HttpService.get("/ops/farmer-purchase-orders"),
      HttpService.get("/auth/users"),
      HttpService.get("/ops/payouts"),
      HttpService.get("/ops/cost-entries"),
    ]);
    setOverview(overviewData || {});
    setIntlOrders(Array.isArray(intData) ? intData : []);
    setProcurementOrders(Array.isArray(fpoData) ? fpoData : []);
    setFarmers(Array.isArray(userData) ? userData.filter((u) => u.role === "FARMER") : []);
    setPayouts(Array.isArray(payoutData) ? payoutData : []);
    setCosts(Array.isArray(costData) ? costData : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        await loadAll();
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load finance overview.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const submitPayout = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.post("/ops/payouts", {
        farmerPurchaseOrderId: payoutForm.farmerPurchaseOrderId,
        farmerId: payoutForm.farmerId,
        amount: Number(payoutForm.amount),
        currency: payoutForm.currency,
        payoutType: payoutForm.payoutType,
        status: payoutForm.status,
        scheduledFor: payoutForm.scheduledFor || undefined,
        notes: payoutForm.notes || undefined,
      });
      setNotice("Payout record added.");
      setPayoutForm({
        farmerPurchaseOrderId: "",
        farmerId: "",
        amount: "",
        currency: "KES",
        payoutType: "ADVANCE",
        status: "PENDING",
        scheduledFor: "",
        notes: "",
      });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Failed to create payout record.");
    } finally {
      setSaving(false);
    }
  };

  const submitCost = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.post("/ops/cost-entries", {
        internationalOrderId: costForm.internationalOrderId,
        costType: costForm.costType,
        amount: Number(costForm.amount),
        currency: costForm.currency,
        vendorName: costForm.vendorName || undefined,
        notes: costForm.notes || undefined,
      });
      setNotice("Cost entry added.");
      setCostForm({
        internationalOrderId: "",
        costType: "PICKUP",
        amount: "",
        currency: "USD",
        vendorName: "",
        notes: "",
      });
      await loadAll();
    } catch (e) {
      setError(e?.message || "Failed to create cost entry.");
    } finally {
      setSaving(false);
    }
  };

  const markPayoutPaid = async (payoutId) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.patch(`/api/ops/payouts/${payoutId}/status`, { status: "PAID" });
      setNotice("Payout marked as paid and farmer order settled.");
      await loadAll();
    } catch (e) {
      setError(e?.message || "Failed to mark payout as paid.");
    } finally {
      setSaving(false);
    }
  };

  const downloadCsv = (filename, headers, rows) => {
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPayoutsCsv = () => {
    const start = exportStartDate ? new Date(exportStartDate) : null;
    const end = exportEndDate ? new Date(exportEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const headers = ["Farmer", "Crop", "Amount", "Currency", "Type", "Status", "Scheduled For", "Created At"];
    const rows = payouts
      .filter((p) => {
        const dt = p.created_at ? new Date(p.created_at) : null;
        if (!dt) return !start && !end;
        if (start && dt < start) return false;
        if (end && dt > end) return false;
        return true;
      })
      .map((p) => [
      p.farmer_name,
      p.crop_type,
      p.amount,
      p.currency,
      p.payout_type,
      p.status,
      p.scheduled_for ? new Date(p.scheduled_for).toISOString() : "",
      p.created_at ? new Date(p.created_at).toISOString() : "",
      ]);
    downloadCsv(`zaodirect-payouts-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const exportCostsCsv = () => {
    const start = exportStartDate ? new Date(exportStartDate) : null;
    const end = exportEndDate ? new Date(exportEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const headers = ["Client", "Crop", "Cost Type", "Amount", "Currency", "Vendor", "Notes", "Created At"];
    const rows = costs
      .filter((c) => {
        const dt = c.created_at ? new Date(c.created_at) : null;
        if (!dt) return !start && !end;
        if (start && dt < start) return false;
        if (end && dt > end) return false;
        return true;
      })
      .map((c) => [
      c.buyer_name,
      c.int_crop_type,
      c.cost_type,
      c.amount,
      c.currency,
      c.vendor_name || "",
      c.notes || "",
      c.created_at ? new Date(c.created_at).toISOString() : "",
      ]);
    downloadCsv(`zaodirect-cost-entries-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  };

  const payoutTable = useMemo(() => {
    const columns = [
      { Header: "farmer", accessor: "farmer", align: "left" },
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "amount", accessor: "amount", align: "left" },
      { Header: "type", accessor: "type", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    const rows = payouts.slice(0, 10).map((p) => ({
      farmer: p.farmer_name,
      crop: p.crop_type,
      amount: `${p.currency} ${p.amount}`,
      type: toStatusLabel(p.payout_type),
      status: toStatusLabel(p.status),
      action: (
        <MDButton
          size="small"
          variant="text"
          color="success"
          disabled={saving || p.status === "PAID"}
          onClick={() => markPayoutPaid(p.id)}
        >
          {p.status === "PAID" ? "Paid" : "Mark Paid"}
        </MDButton>
      ),
    }));
    return { columns, rows };
  }, [payouts, saving]);

  const collectedProcurementOrders = useMemo(
    () => procurementOrders.filter((po) => po.status === "PICKED_UP"),
    [procurementOrders]
  );

  const costTable = useMemo(() => {
    const columns = [
      { Header: "buyer", accessor: "buyer", align: "left" },
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "cost type", accessor: "type", align: "left" },
      { Header: "amount", accessor: "amount", align: "left" },
      { Header: "vendor", accessor: "vendor", align: "left" },
    ];
    const rows = costs.slice(0, 10).map((c) => ({
      buyer: c.buyer_name,
      crop: c.int_crop_type,
      type: toStatusLabel(c.cost_type),
      amount: `${c.currency} ${c.amount}`,
      vendor: c.vendor_name || "-",
    }));
    return { columns, rows };
  }, [costs]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDBox>
            <MDTypography variant="h4" fontWeight="bold">Finance Tracker</MDTypography>
            <MDTypography variant="button" color="text">
              Exposure, payout pipeline, and cost-stack visibility for financier readiness.
            </MDTypography>
          </MDBox>
          <MDBox display="flex" gap={1}>
            <TextField type="date" label="From" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <TextField type="date" label="To" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <MDButton variant="outlined" color="info" onClick={exportPayoutsCsv}>Export Payouts CSV</MDButton>
            <MDButton variant="outlined" color="info" onClick={exportCostsCsv}>Export Costs CSV</MDButton>
          </MDBox>
        </MDBox>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        {notice && <MDTypography color="success" variant="button">{notice}</MDTypography>}
        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="dark"
                icon="account_balance_wallet"
                title="Total Payouts"
                count={`USD ${Number(overview.totalPayoutValueUsd || 0).toLocaleString()}`}
                percentage={{ color: "dark", amount: "", label: "All farmer payout records" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="warning"
                icon="schedule"
                title="Pending Payouts"
                count={`USD ${Number(overview.pendingPayoutValueUsd || 0).toLocaleString()}`}
                percentage={{ color: "warning", amount: "", label: "Cash needed soon" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard color="info" icon="payments" title="Total Costs" count={`USD ${Number(overview.totalCostValue || 0).toLocaleString()}`} percentage={{ color: "info", amount: "", label: "Logistics + export cost stack" }} />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard color="primary" icon="public" title="Open Intl Orders" count={overview.openInternationalOrders || 0} percentage={{ color: "primary", amount: "", label: "Current financing exposure" }} />
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}>
                  <MDTypography variant="h6">Add Payout Record</MDTypography>
                  <MDTypography variant="caption" color="text">
                    Only collected farmer orders can be paid.
                  </MDTypography>
                  <Grid container spacing={2} mt={0.5}>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        select
                        label="Procurement Order"
                        value={payoutForm.farmerPurchaseOrderId}
                        onChange={(e) => {
                          const nextOrderId = e.target.value;
                          const selected = collectedProcurementOrders.find((po) => po.id === nextOrderId);
                          setPayoutForm((p) => ({
                            ...p,
                            farmerPurchaseOrderId: nextOrderId,
                            farmerId: selected?.farmer_id || p.farmerId,
                          }));
                        }}
                        sx={uniformFieldSx}
                      >
                        {collectedProcurementOrders.map((po) => (
                          <MenuItem key={po.id} value={po.id}>
                            {`${po.farmer_name} - ${po.crop_type}`}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12}><TextField fullWidth select label="Farmer" value={payoutForm.farmerId} onChange={(e) => setPayoutForm((p) => ({ ...p, farmerId: e.target.value }))} sx={uniformFieldSx}>{farmers.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}</TextField></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Amount" value={payoutForm.amount} onChange={(e) => setPayoutForm((p) => ({ ...p, amount: e.target.value }))} sx={uniformFieldSx} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth select label="Type" value={payoutForm.payoutType} onChange={(e) => setPayoutForm((p) => ({ ...p, payoutType: e.target.value }))} sx={uniformFieldSx}><MenuItem value="ADVANCE">{toStatusLabel("ADVANCE")}</MenuItem><MenuItem value="FINAL">{toStatusLabel("FINAL")}</MenuItem><MenuItem value="ADJUSTMENT">{toStatusLabel("ADJUSTMENT")}</MenuItem></TextField></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth select label="Status" value={payoutForm.status} onChange={(e) => setPayoutForm((p) => ({ ...p, status: e.target.value }))} sx={uniformFieldSx}><MenuItem value="PENDING">{toStatusLabel("PENDING")}</MenuItem><MenuItem value="APPROVED">{toStatusLabel("APPROVED")}</MenuItem><MenuItem value="PAID">{toStatusLabel("PAID")}</MenuItem><MenuItem value="FAILED">{toStatusLabel("FAILED")}</MenuItem></TextField></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth type="date" label="Scheduled For" value={payoutForm.scheduledFor} onChange={(e) => setPayoutForm((p) => ({ ...p, scheduledFor: e.target.value }))} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} /></Grid>
                  </Grid>
                  <MDBox mt={2}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={submitPayout}
                      disabled={saving || !payoutForm.farmerPurchaseOrderId}
                    >
                      Save Payout
                    </MDButton>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}>
                  <MDTypography variant="h6">Add Cost Entry</MDTypography>
                  <Grid container spacing={2} mt={0.5}>
                    <Grid item xs={12}><TextField fullWidth select label="International Order" value={costForm.internationalOrderId} onChange={(e) => setCostForm((p) => ({ ...p, internationalOrderId: e.target.value }))} sx={uniformFieldSx}>{intlOrders.map((o) => <MenuItem key={o.id} value={o.id}>{`${o.buyer_name} - ${o.crop_type}`}</MenuItem>)}</TextField></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth select label="Cost Type" value={costForm.costType} onChange={(e) => setCostForm((p) => ({ ...p, costType: e.target.value }))} sx={uniformFieldSx}><MenuItem value="PICKUP">{toStatusLabel("PICKUP")}</MenuItem><MenuItem value="AGGREGATION">{toStatusLabel("AGGREGATION")}</MenuItem><MenuItem value="COLD_STORAGE">{toStatusLabel("COLD_STORAGE")}</MenuItem><MenuItem value="EXPORT_DOCS">{toStatusLabel("EXPORT_DOCS")}</MenuItem><MenuItem value="FREIGHT">{toStatusLabel("FREIGHT")}</MenuItem><MenuItem value="FINANCE">{toStatusLabel("FINANCE")}</MenuItem><MenuItem value="OTHER">{toStatusLabel("OTHER")}</MenuItem></TextField></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth type="number" label="Amount" value={costForm.amount} onChange={(e) => setCostForm((p) => ({ ...p, amount: e.target.value }))} sx={uniformFieldSx} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth select label="Currency" value={costForm.currency} onChange={(e) => setCostForm((p) => ({ ...p, currency: e.target.value }))} sx={uniformFieldSx}><MenuItem value="USD">USD</MenuItem><MenuItem value="KES">KES</MenuItem><MenuItem value="EUR">EUR</MenuItem></TextField></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth label="Vendor" value={costForm.vendorName} onChange={(e) => setCostForm((p) => ({ ...p, vendorName: e.target.value }))} sx={uniformFieldSx} /></Grid>
                  </Grid>
                  <MDBox mt={2}><MDButton variant="gradient" color="info" onClick={submitCost} disabled={saving}>Save Cost</MDButton></MDBox>
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}><MDTypography variant="h6">Recent Payouts</MDTypography></MDBox>
                <Divider />
                <DataTable table={payoutTable} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
              </Card>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}><MDTypography variant="h6">Recent Cost Entries</MDTypography></MDBox>
                <Divider />
                <DataTable table={costTable} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
              </Card>
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default FinanceTracker;

