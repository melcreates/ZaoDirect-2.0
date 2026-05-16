import { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAlert from "components/MDAlert";

// Material Dashboard 3 PRO React examples
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DefaultLineChart from "examples/Charts/LineCharts/DefaultLineChart";
import HorizontalBarChart from "examples/Charts/BarCharts/HorizontalBarChart";

// Sales dashboard components
import ChannelsChart from "layouts/dashboards/sales/components/ChannelsChart";
import ProductCell from "layouts/dashboards/sales/components/ProductCell";
import DefaultCell from "layouts/dashboards/sales/components/DefaultCell";

import HttpService from "services/http.service";
import AuthService from "services/auth-service";

// Images
import nikeV22 from "assets/images/ecommerce/blue-shoe.jpeg";
import businessKit from "assets/images/ecommerce/black-mug.jpeg";
import blackChair from "assets/images/ecommerce/black-chair.jpeg";
import wirelessCharger from "assets/images/ecommerce/bang-sound.jpeg";
import tripKit from "assets/images/ecommerce/photo-tools.jpeg";

function formatUSD(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function formatKES(value) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function monthLabel(dateLike) {
  const d = new Date(dateLike);
  return d.toLocaleString("en", { month: "short" });
}

function Sales() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [payouts, setPayouts] = useState([]);
  const [costEntries, setCostEntries] = useState([]);
  const [intlOrders, setIntlOrders] = useState([]);
  const [farmerOrders, setFarmerOrders] = useState([]);
  const [adminOverview, setAdminOverview] = useState(null);
  const [farmerOverview, setFarmerOverview] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const me = await AuthService.getProfile();
        const currentRole = String(me?.role || "").toUpperCase();
        setRole(currentRole);

        if (currentRole === "ADMIN") {
          const [overview, payoutRows, costsRows, orderRows] = await Promise.all([
            HttpService.get("/ops/finance-overview"),
            HttpService.get("/ops/payouts"),
            HttpService.get("/ops/cost-entries"),
            HttpService.get("/ops/international-orders"),
          ]);
          setAdminOverview(overview || {});
          setPayouts(Array.isArray(payoutRows) ? payoutRows : []);
          setCostEntries(Array.isArray(costsRows) ? costsRows : []);
          setIntlOrders(Array.isArray(orderRows) ? orderRows : []);
        } else {
          const [overview, payoutRows, myOrders] = await Promise.all([
            HttpService.get("/ops/farmer-finance-overview"),
            HttpService.get("/ops/payouts/mine"),
            HttpService.get("/ops/farmer-purchase-orders/mine"),
          ]);
          setFarmerOverview(overview || {});
          setPayouts(Array.isArray(payoutRows) ? payoutRows : []);
          setFarmerOrders(Array.isArray(myOrders) ? myOrders : []);
        }
      } catch (e) {
        setError(e?.message || "Unable to load trade and finance dashboard.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const topKpis = useMemo(() => {
    if (role === "ADMIN") {
      const shippedValue = intlOrders
        .filter((o) =>
          ["PARTIALLY_SHIPPED", "SHIPPED", "DELIVERED"].includes(String(o?.status || "").toUpperCase())
        )
        .reduce(
          (sum, o) => sum + Number(o?.required_quantity || 0) * Number(o?.target_price || 0),
          0
        );
      const settledKes = payouts
        .filter((p) => String(p?.status || "").toUpperCase() === "PAID")
        .reduce((sum, p) => sum + Number(p?.amount || 0), 0);

      return {
        shippedValueText: formatUSD(shippedValue),
        settledText: formatKES(settledKes),
        pendingText: formatUSD(adminOverview?.pendingPayoutValueUsd || 0),
      };
    }
    return {
      shippedValueText: formatKES(farmerOverview?.totalEarnedValue || 0),
      settledText: String(
        farmerOrders.filter((o) => String(o?.status || "").toUpperCase() === "SETTLED").length
      ),
      pendingText: formatKES(farmerOverview?.pendingValue || 0),
    };
  }, [adminOverview, farmerOverview, farmerOrders, intlOrders, payouts, role]);

  const payoutStatusMix = useMemo(() => {
    const groups = { PENDING: 0, APPROVED: 0, PAID: 0, FAILED: 0 };
    payouts.forEach((p) => {
      const key = String(p?.effective_status || p?.status || "").toUpperCase();
      if (groups[key] !== undefined) groups[key] += 1;
    });
    return {
      labels: ["Pending", "Approved", "Paid", "Failed"],
      datasets: {
        label: "Payout statuses",
        backgroundColors: ["warning", "info", "success", "error"],
        data: [groups.PENDING, groups.APPROVED, groups.PAID, groups.FAILED],
      },
    };
  }, [payouts]);

  const farmerOrderStatusMix = useMemo(() => {
    const groups = { OPEN: 0, ALLOCATED: 0, READY_FOR_PICKUP: 0, SETTLED: 0 };
    farmerOrders.forEach((o) => {
      const key = String(o?.status || "").toUpperCase();
      if (groups[key] !== undefined) groups[key] += 1;
    });
    return {
      labels: ["Open", "Allocated", "Ready for pickup", "Settled"],
      datasets: {
        label: "My order statuses",
        backgroundColors: ["warning", "info", "primary", "success"],
        data: [groups.OPEN, groups.ALLOCATED, groups.READY_FOR_PICKUP, groups.SETTLED],
      },
    };
  }, [farmerOrders]);

  const cashFlowLine = useMemo(() => {
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const settled = Object.fromEntries(monthOrder.map((m) => [m, 0]));
    const pending = Object.fromEntries(monthOrder.map((m) => [m, 0]));
    payouts.forEach((p) => {
      const label = monthLabel(p?.created_at || p?.paid_at || new Date());
      const amount = Number(p?.amount || 0);
      const status = String(p?.effective_status || p?.status || "").toUpperCase();
      if (status === "PAID") settled[label] = (settled[label] || 0) + amount;
      if (["PENDING", "APPROVED"].includes(status)) pending[label] = (pending[label] || 0) + amount;
    });
    return {
      labels: monthOrder,
      datasets: [
        { label: "Settled", color: "success", data: monthOrder.map((m) => settled[m]) },
        { label: "Pending", color: "warning", data: monthOrder.map((m) => pending[m]) },
      ],
    };
  }, [payouts]);

  const costByCategory = useMemo(() => {
    if (role === "ADMIN") {
      const grouped = {};
      costEntries.forEach((c) => {
        const key = String(c?.cost_type || "OTHER");
        grouped[key] = (grouped[key] || 0) + Number(c?.amount || 0);
      });
      const labels = Object.keys(grouped);
      const values = labels.map((k) => grouped[k]);
      return {
        labels: labels.length ? labels : ["No data"],
        datasets: [{ label: "Cost", color: "dark", data: values.length ? values : [0] }],
      };
    }
    const grouped = {};
    payouts.forEach((p) => {
      const key = String(p?.payout_type || "OTHER");
      grouped[key] = (grouped[key] || 0) + Number(p?.amount || 0);
    });
    const labels = Object.keys(grouped);
    const values = labels.map((k) => grouped[k]);
    return {
      labels: labels.length ? labels : ["No data"],
      datasets: [{ label: "Payout type", color: "dark", data: values.length ? values : [0] }],
    };
  }, [costEntries, payouts, role]);

  const destinationRows = useMemo(() => {
    if (role === "ADMIN") {
      const grouped = {};
      intlOrders.forEach((o) => {
        const country = o?.buyer_country || "Unknown";
        if (!grouped[country]) grouped[country] = { country, orders: 0, value: 0 };
        grouped[country].orders += 1;
        grouped[country].value += Number(o?.required_quantity || 0) * Number(o?.target_price || 0);
      });
      return Object.values(grouped)
        .sort((a, b) => b.value - a.value)
        .slice(0, 8)
        .map((r) => ({ ...r, share: " -" }));
    }
    const grouped = {};
    farmerOrders.forEach((o) => {
      const buyer = o?.buyer_name || "ZaoDirect Buyer";
      if (!grouped[buyer]) grouped[buyer] = { country: buyer, orders: 0, value: 0 };
      grouped[buyer].orders += 1;
      grouped[buyer].value += Number(o?.farm_gate_price || 0) * Number(o?.quantity || 0);
    });
    return Object.values(grouped)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
      .map((r) => ({ ...r, share: " -" }));
  }, [farmerOrders, intlOrders, role]);

  const transactionTable = useMemo(() => {
    const txRows = [];
    payouts.slice(0, 20).forEach((p) => {
      const payoutStatus = String(p?.effective_status || p?.status || "").toUpperCase();
      txRows.push({
        date: p?.created_at || p?.paid_at || new Date().toISOString(),
        type: "Payout",
        reference: p?.crop_type || p?.farmer_name || "Farmer Payout",
        amount: Number(p?.amount || 0),
        currency: p?.currency || (role === "ADMIN" ? "USD" : "KES"),
        status: payoutStatus === "PAID" ? "SETTLED" : "PENDING",
      });
    });
    if (role === "ADMIN") {
      costEntries.slice(0, 20).forEach((c) => {
        txRows.push({
          date: c?.created_at || new Date().toISOString(),
          type: "Cost",
          reference: c?.cost_type || "Cost Entry",
          amount: Number(c?.amount || 0),
          currency: c?.currency || "USD",
          status: "SETTLED",
        });
      });
    }
    const sorted = txRows.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12);
    const productImages = [nikeV22, businessKit, blackChair, wirelessCharger, tripKit];
    return {
      columns: [
        { Header: "type", accessor: "type", width: "32%" },
        { Header: "reference", accessor: "reference" },
        { Header: "amount", accessor: "amount", align: "center" },
        { Header: "status", accessor: "status", align: "center" },
      ],
      rows: sorted.map((t, idx) => ({
        type: <ProductCell image={productImages[idx % productImages.length]} name={t.type} orders={monthLabel(t.date)} />,
        reference: <DefaultCell>{t.reference}</DefaultCell>,
        amount: <DefaultCell>{`${t.currency} ${Number(t.amount || 0).toLocaleString()}`}</DefaultCell>,
        status: <DefaultCell>{t.status === "SETTLED" ? "Settled" : "Pending"}</DefaultCell>,
      })),
    };
  }, [costEntries, payouts, role]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        {error && (
          <MDAlert color="error" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">
              {error}
            </MDTypography>
          </MDAlert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
              <ComplexStatisticsCard
                color="info"
                icon="paid"
                title={role === "ADMIN" ? "Total Shipped Value" : "Total Earned"}
                count={topKpis.shippedValueText}
                percentage={{
                  color: "dark",
                  amount: "",
                  label:
                    role === "ADMIN"
                      ? "From completed shipment flow"
                      : "Value of your paid produce orders",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
              <ComplexStatisticsCard
                color="dark"
                icon="groups"
                title={role === "ADMIN" ? "Total Settled to Farmers" : "Settled Orders"}
                count={topKpis.settledText}
                percentage={{
                  color: "dark",
                  amount: "",
                  label:
                    role === "ADMIN"
                      ? "Paid procurement settlements"
                      : "Procurement orders fully settled",
                }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: "flex" }}>
            <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
              <ComplexStatisticsCard
                color="warning"
                icon="insights"
                title="Pending Payouts"
                count={topKpis.pendingText}
                percentage={{
                  color: "dark",
                  amount: "",
                  label:
                    role === "ADMIN"
                      ? "Awaiting payout clearance"
                      : "Amounts waiting payout approval",
                }}
              />
            </MDBox>
          </Grid>
        </Grid>

        <MDBox mt={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={4} sx={{ display: "flex" }}>
              <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                <ChannelsChart
                  title={role === "ADMIN" ? "Payout Status Mix" : "My Order Status Mix"}
                  tooltipTitle={
                    role === "ADMIN"
                      ? "Distribution of payout lifecycle statuses"
                      : "Distribution of your procurement order statuses"
                  }
                  chartData={role === "ADMIN" ? payoutStatusMix : farmerOrderStatusMix}
                  badgeItems={
                    role === "ADMIN"
                      ? [
                          { color: "warning", label: "Pending" },
                          { color: "info", label: "Approved" },
                          { color: "success", label: "Paid" },
                          { color: "error", label: "Failed" },
                        ]
                      : [
                          { color: "warning", label: "Open" },
                          { color: "info", label: "Allocated" },
                          { color: "primary", label: "Ready for pickup" },
                          { color: "success", label: "Settled" },
                        ]
                  }
                  footerText={
                    role === "ADMIN"
                      ? "Operational payout balance across all current records."
                      : "Track how your active orders are progressing through the collection and settlement flow."
                  }
                  actionLabel={role === "ADMIN" ? "view payouts" : "view my orders"}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} lg={8} sx={{ display: "flex" }}>
              <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                <DefaultLineChart
                  title="Monthly Cash Flow"
                  chart={cashFlowLine}
                  legend={{
                    labels: ["Settled", "Pending"],
                    colors: ["success", "warning"],
                  }}
                />
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>

        {role === "ADMIN" && (
          <MDBox mt={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8} sx={{ display: "flex" }}>
                <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                  <HorizontalBarChart title="Cost by Category" chart={costByCategory} />
                </MDBox>
              </Grid>
              <Grid item xs={12} lg={4} sx={{ display: "flex" }}>
                <Card sx={{ width: "100%" }}>
                  <MDBox p={3}>
                    <MDTypography variant="h6" gutterBottom>
                      Trade by Destination
                    </MDTypography>
                    {destinationRows.map((row) => (
                      <MDBox
                        key={row.country}
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        py={1}
                        borderBottom="1px solid"
                        borderColor="grey.200"
                      >
                        <MDTypography variant="button">{row.country}</MDTypography>
                        <MDTypography variant="caption" color="text">
                          {row.orders} orders
                        </MDTypography>
                        <MDTypography variant="caption" color="text">
                          {formatUSD(row.value)}
                        </MDTypography>
                      </MDBox>
                    ))}
                    {!destinationRows.length && (
                      <MDTypography variant="caption" color="text">
                        No trade records yet.
                      </MDTypography>
                    )}
                  </MDBox>
                </Card>
              </Grid>
            </Grid>
          </MDBox>
        )}

        <MDBox mt={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} sx={{ display: "flex" }}>
              <Card sx={{ width: "100%" }}>
                <MDBox p={3}>
                  <MDTypography variant="h5" gutterBottom>
                    Recent Finance Transactions
                  </MDTypography>
                  <DataTable table={transactionTable} entriesPerPage={false} canSearch={false} />
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Sales;
