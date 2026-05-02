import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";

function FinancierReadiness() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const [lastExportAt, setLastExportAt] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await HttpService.get("/api/ops/financier-readiness");
        if (!mounted) return;
        setData(res || null);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load financier readiness metrics.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const reportRows = useMemo(() => {
    if (!data) return [];
    const asOfLabel = data.asOf
      ? new Date(data.asOf).toLocaleString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "-";
    return [
      ["Trade worth moved (YTD, USD)", data.tradeWorthMovedYtd],
      ["In-transit worth (YTD, USD)", data.inTransitWorthYtd],
      ["Delivered worth (YTD, USD)", data.deliveredWorthYtd],
      ["Open order value (USD)", data.openOrderValue],
      ["Pending payout value (KES)", data.pendingPayoutValue],
      ["Delayed shipments", data.delayedShipments],
      ["As of", asOfLabel],
    ];
  }, [data]);

  const exportCsv = () => {
    const headers = ["Metric", "Value"];
    const csv = [headers, ...reportRows]
      .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zaodirect-financier-readiness-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    const now = new Date();
    setExportNotice("Financier readiness snapshot exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
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

  const exportExposure = () => {
    if (!data) return;
    const rows = [
      ["Open international orders", data.openInternationalOrders],
      ["Open order value (USD)", data.openOrderValue],
      ["Trade worth moved YTD (USD)", data.tradeWorthMovedYtd],
      ["In-transit worth YTD (USD)", data.inTransitWorthYtd],
      ["Delivered worth YTD (USD)", data.deliveredWorthYtd],
      ["As of", data.asOf || ""],
    ];
    downloadCsv(`zaodirect-evidence-exposure-${new Date().toISOString().slice(0, 10)}.csv`, ["Metric", "Value"], rows);
    const now = new Date();
    setExportNotice("Exposure evidence exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const exportPayoutAging = async () => {
    const payouts = await HttpService.get("/api/ops/payouts");
    const list = Array.isArray(payouts) ? payouts : [];
    const rows = list
      .filter((p) => ["PENDING", "APPROVED"].includes(p.status))
      .map((p) => {
        const created = p.created_at ? new Date(p.created_at) : null;
        const ageDays = created ? Math.max(0, Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))) : "";
        return [
          p.farmer_name || "",
          p.crop_type || "",
          p.amount || 0,
          p.currency || "KES",
          p.status || "",
          ageDays,
          p.created_at ? new Date(p.created_at).toISOString() : "",
        ];
      });
    downloadCsv(
      `zaodirect-evidence-payout-aging-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Farmer", "Crop", "Amount", "Currency", "Status", "Age Days", "Created At"],
      rows
    );
    const now = new Date();
    setExportNotice("Payout aging evidence exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const exportShipmentRisk = async () => {
    const orders = await HttpService.get("/api/orders");
    const list = Array.isArray(orders) ? orders : [];
    const rows = list
      .filter((o) => o.shipment_tracking_status === "DELAYED")
      .map((o) => [
        o.id || "",
        o.buyer_name || "",
        o.farmer_name || "",
        o.shipment_flight_number || "",
        o.shipment_awb_number || "",
        o.shipment_tracking_status || "",
        o.shipment_eta ? new Date(o.shipment_eta).toISOString() : "",
        o.updated_at ? new Date(o.updated_at).toISOString() : "",
      ]);
    downloadCsv(
      `zaodirect-evidence-shipment-risk-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Order ID", "Client", "Farmer", "Flight", "AWB", "Tracking Status", "ETA", "Updated At"],
      rows
    );
    const now = new Date();
    setExportNotice("Shipment risk evidence exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const exportDisputes = async () => {
    const disputes = await HttpService.get("/api/ops/dispute-cases");
    const list = Array.isArray(disputes) ? disputes : [];
    const rows = list
      .filter((d) => ["OPEN", "IN_REVIEW"].includes(d.status) || ["HIGH", "CRITICAL"].includes(d.severity))
      .map((d) => [
        d.id || "",
        d.case_type || "",
        d.title || "",
        d.severity || "",
        d.status || "",
        d.owner_name || "",
        d.due_at ? new Date(d.due_at).toISOString() : "",
        d.created_at ? new Date(d.created_at).toISOString() : "",
      ]);
    downloadCsv(
      `zaodirect-evidence-disputes-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Case ID", "Type", "Title", "Severity", "Status", "Owner", "Due At", "Created At"],
      rows
    );
    const now = new Date();
    setExportNotice("Disputes evidence exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const exportAudit30d = async () => {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const audits = await HttpService.get(`/api/ops/audit-events?from=${encodeURIComponent(from.toISOString())}&limit=1000`);
    const list = Array.isArray(audits) ? audits : [];
    const rows = list.map((a) => [
      a.created_at ? new Date(a.created_at).toISOString() : "",
      a.actor_name || a.actor_email || "System",
      a.entity_type || "",
      a.entity_id || "",
      a.action || "",
      JSON.stringify(a.payload || {}),
    ]);
    downloadCsv(
      `zaodirect-evidence-audit-30d-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Time", "Actor", "Entity Type", "Entity ID", "Action", "Payload"],
      rows
    );
    const now = new Date();
    setExportNotice("Audit evidence (30d) exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const exportFullPack = async () => {
    await exportExposure();
    await exportPayoutAging();
    await exportShipmentRisk();
    await exportDisputes();
    await exportAudit30d();
    const now = new Date();
    setExportNotice("Full evidence pack exported.");
    setLastExportAt(
      now.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDBox>
            <MDTypography variant="h4" fontWeight="bold">Financier Readiness</MDTypography>
            <MDTypography variant="button" color="text">
              Snapshot of operational and payout exposure for banking and credit partners.
            </MDTypography>
          </MDBox>
          <MDButton variant="outlined" color="info" onClick={exportCsv} disabled={!data}>
            Export CSV
          </MDButton>
        </MDBox>

        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        {exportNotice && (
          <MDTypography color="success" variant="button" display="block" mt={1}>
            {exportNotice}{lastExportAt ? ` Last export: ${lastExportAt}` : ""}
          </MDTypography>
        )}

        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                icon="paid"
                title="Trade Worth Moved (YTD)"
                count={data ? `USD ${Number(data.tradeWorthMovedYtd || 0).toLocaleString()}` : "USD 0"}
                percentage={{
                  color: "dark",
                  amount: "",
                  label: data
                    ? `Delivered: USD ${Number(data.deliveredWorthYtd || 0).toLocaleString()} | In transit: USD ${Number(data.inTransitWorthYtd || 0).toLocaleString()}`
                    : "Delivered and in-transit worth",
                }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                icon="payments"
                title="Open Value"
                count={data ? `USD ${Number(data.openOrderValue || 0).toLocaleString()}` : "USD 0"}
                percentage={{ color: "dark", amount: "", label: "Unsettled international demand" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                icon="account_balance_wallet"
                title="Pending Payouts"
                count={data ? `KES ${Number(data.pendingPayoutValue || 0).toLocaleString()}` : "KES 0"}
                percentage={{ color: "dark", amount: "", label: "Farmer settlement queue" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                icon="public"
                title="Open Orders"
                count={data ? data.openInternationalOrders : 0}
                percentage={{ color: "dark", amount: "", label: "Awaiting fulfillment" }}
              />
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">Lender Review Snapshot</MDTypography>
              {reportRows.map(([metric, value]) => (
                <MDBox key={metric} display="flex" justifyContent="space-between" py={0.75}>
                  <MDTypography variant="button" color="text">{metric}</MDTypography>
                  <MDTypography variant="button" fontWeight="medium">{String(value)}</MDTypography>
                </MDBox>
              ))}
            </MDBox>
          </Card>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">Evidence Pack</MDTypography>
              <MDTypography variant="button" color="text">
                One-click exports for lender due diligence and credit discussions.
              </MDTypography>
              <MDBox mt={2} display="flex" flexWrap="wrap" gap={1}>
                <MDButton variant="outlined" color="info" onClick={exportExposure}>Export Exposure</MDButton>
                <MDButton variant="outlined" color="info" onClick={exportPayoutAging}>Export Payout Aging</MDButton>
                <MDButton variant="outlined" color="info" onClick={exportShipmentRisk}>Export Shipment Risk</MDButton>
                <MDButton variant="outlined" color="info" onClick={exportDisputes}>Export Disputes</MDButton>
                <MDButton variant="outlined" color="info" onClick={exportAudit30d}>Export Audit (30d)</MDButton>
                <MDButton variant="gradient" color="info" onClick={exportFullPack}>Export Full Pack</MDButton>
              </MDBox>
            </MDBox>
          </Card>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default FinancierReadiness;
