import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

function MyFinance() {
  const [overview, setOverview] = useState({
    totalEarnedValue: 0,
    pendingValue: 0,
    adjustmentsValue: 0,
    displayCurrency: "KES",
    fxRates: { USD_KES: 129, EUR_KES: 140 },
  });
  const [payouts, setPayouts] = useState([]);
  const [error, setError] = useState("");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [overviewData, payoutData] = await Promise.all([
          HttpService.get("/api/ops/farmer-finance-overview"),
          HttpService.get("/api/ops/payouts/mine"),
        ]);
        if (!mounted) return;
        setOverview(overviewData || {});
        setPayouts(Array.isArray(payoutData) ? payoutData : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load your finance data.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const exportCsv = () => {
    const start = exportStartDate ? new Date(exportStartDate) : null;
    const end = exportEndDate ? new Date(exportEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    const headers = ["Crop", "Amount", "Currency", "Type", "Status", "Scheduled For", "Paid At", "Created At"];
    const rows = payouts
      .filter((p) => {
        const dt = p.created_at ? new Date(p.created_at) : null;
        if (!dt) return !start && !end;
        if (start && dt < start) return false;
        if (end && dt > end) return false;
        return true;
      })
      .map((p) => [
        p.crop_type || "",
        p.amount || 0,
        p.currency || "KES",
        p.payout_type || "",
        p.status || "",
        p.scheduled_for ? new Date(p.scheduled_for).toISOString() : "",
        p.paid_at ? new Date(p.paid_at).toISOString() : "",
        p.created_at ? new Date(p.created_at).toISOString() : "",
      ]);
    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaodirect-my-finance-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const payoutTable = useMemo(() => {
    const usdRate = Number(overview?.fxRates?.USD_KES || 129);
    const eurRate = Number(overview?.fxRates?.EUR_KES || 140);
    const convertToKes = (amount, currency) => {
      const numeric = Number(amount || 0);
      const code = String(currency || "KES").toUpperCase();
      if (code === "USD") return numeric * usdRate;
      if (code === "EUR") return numeric * eurRate;
      return numeric;
    };

    const columns = [
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "amount", accessor: "amount", align: "left" },
      { Header: "type", accessor: "type", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "date", accessor: "date", align: "left" },
    ];
    const rows = payouts.map((p) => ({
      crop: p.crop_type || "-",
      amount: `KES ${Number(convertToKes(p.amount, p.currency)).toLocaleString()}`,
      type: toStatusLabel(p.payout_type),
      status: (p.effective_status || p.status) === "PAID" ? "Settled" : toStatusLabel(p.effective_status || p.status),
      date: p.paid_at ? new Date(p.paid_at).toLocaleDateString() : p.created_at ? new Date(p.created_at).toLocaleDateString() : "-",
    }));
    return { columns, rows };
  }, [payouts, overview]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDBox>
            <MDTypography variant="h4" fontWeight="bold">My Finance</MDTypography>
            <MDTypography variant="button" color="text">
              Your payout visibility, pending settlements, and earnings history.
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block">
              Converted to KES using rates: 1 USD = {Number(overview?.fxRates?.USD_KES || 129)}, 1 EUR = {Number(overview?.fxRates?.EUR_KES || 140)}.
            </MDTypography>
          </MDBox>
          <MDBox display="flex" gap={1}>
            <TextField type="date" label="From" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <TextField type="date" label="To" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={uniformFieldSx} />
            <MDButton variant="outlined" color="info" onClick={exportCsv}>Export CSV</MDButton>
          </MDBox>
        </MDBox>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}

        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <ComplexStatisticsCard
                icon="payments"
                title="Total Earned"
                count={`KES ${Number(overview.totalEarnedValue || 0).toLocaleString()}`}
                percentage={{ color: "dark", amount: "", label: "Paid settlements" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <ComplexStatisticsCard
                icon="schedule"
                title="Pending Payout"
                count={`KES ${Number(overview.pendingValue || 0).toLocaleString()}`}
                percentage={{ color: "dark", amount: "", label: "Awaiting release" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <ComplexStatisticsCard
                icon="tune"
                title="Adjustments"
                count={`KES ${Number(overview.adjustmentsValue || 0).toLocaleString()}`}
                percentage={{ color: "dark", amount: "", label: "Adjustment records" }}
              />
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}><MDTypography variant="h6">Recent Payouts</MDTypography></MDBox>
            <DataTable table={payoutTable} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default MyFinance;
