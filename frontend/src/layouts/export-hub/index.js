import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import AuthService from "services/auth-service";
import HttpService from "services/htttp.service";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function ExportHub() {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [profileData, listingData, orderData] = await Promise.all([
          AuthService.getProfile(),
          HttpService.get("/api/listings?status=PUBLISHED"),
          HttpService.get("/api/orders"),
        ]);

        if (!mounted) return;
        setProfile(profileData);
        setListings(Array.isArray(listingData) ? listingData : []);
        setOrders(Array.isArray(orderData) ? orderData : []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load hub data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const isBuyer = profile?.role === "BUYER";

  const stats = useMemo(() => {
    const openOrders = orders.filter((item) =>
      ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "SHIPPED"].includes(item.status)
    ).length;
    const activeFarmerKeys = new Set(
      listings
        .map((item) => item.farmer_id || item.farmer_name)
        .filter(Boolean)
        .map((value) => String(value))
    );

    return {
      openOrders,
      activeFarmers: activeFarmerKeys.size,
    };
  }, [listings, orders]);

  const queueTable = useMemo(() => {
    const columns = [
      { Header: "order", accessor: "order", align: "left" },
      { Header: "farmer", accessor: "farmer", align: "left" },
      { Header: "buyer", accessor: "buyer", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "updated", accessor: "updated", align: "left" },
    ];

    const rows = orders.slice(0, 10).map((item) => ({
      order: item.listing_title || item.listing_id,
      farmer: item.farmer_name || "-",
      buyer: item.buyer_name || "-",
      status: item.status,
      updated: formatDate(item.updated_at),
    }));

    return { columns, rows };
  }, [orders]);

  const supplierTable = useMemo(() => {
    const columns = [
      { Header: "produce", accessor: "produce", align: "left" },
      { Header: "farmer", accessor: "farmer", align: "left" },
      { Header: "county", accessor: "county", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
    ];

    const rows = listings.slice(0, 10).map((item) => ({
      produce: item.title || "-",
      farmer: item.farmer_name || "-",
      county: item.county || "-",
      status: item.status || "-",
    }));

    return { columns, rows };
  }, [listings]);

  const pageTitle = isBuyer ? "Import Hub" : "Export Hub";
  const pageTip = isBuyer
    ? "Track your import pipeline and supplier readiness."
    : profile?.role === "FARMER"
      ? "Track your orders and export progress handled by Consynair."
      : "Monitor managed export volume and service capacity from one place.";

  const queueTitle = isBuyer ? "My Import Queue" : "Export/Shipment Queue";
  const queueEmpty = isBuyer ? "No import orders in your queue yet." : "No orders in queue yet.";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2}>
          <MDTypography variant="h4" fontWeight="bold">
            {pageTitle}
          </MDTypography>
          <MDTypography variant="button" color="text" fontWeight="regular">
            {pageTip}
          </MDTypography>
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

        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="dark"
              icon={isBuyer ? "shopping_cart" : "inventory_2"}
              title={isBuyer ? "My Open Imports" : "Open Orders"}
              count={stats.openOrders}
              percentage={{
                color: "dark",
                amount: "",
                label: loading
                  ? "Loading..."
                  : isBuyer
                    ? "Requested to shipment stage"
                    : "Operational order pipeline",
              }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="info"
              icon={isBuyer ? "agriculture" : "task_alt"}
              title={isBuyer ? "Active Suppliers" : "Published Listings"}
              count={isBuyer ? stats.activeFarmers : listings.length}
              percentage={{
                color: "info",
                amount: "",
                label: loading
                  ? "Loading..."
                  : isBuyer
                    ? "Farmers with published supply"
                    : "Available for buyer demand",
              }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="success"
              icon="local_shipping"
              title={isBuyer ? "Shipped Orders" : "Shipped Orders"}
              count={orders.filter((item) => item.status === "SHIPPED").length}
              percentage={{
                color: "success",
                amount: "",
                label: loading ? "Loading..." : "In transit to destination",
              }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="primary"
              icon="public"
              title={isBuyer ? "Completed Imports" : "Completed Orders"}
              count={orders.filter((item) => item.status === "COMPLETED").length}
              percentage={{
                color: "primary",
                amount: "",
                label: loading
                  ? "Loading..."
                  : "Successfully closed",
              }}
            />
          </Grid>
        </Grid>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6" fontWeight="medium">
                {queueTitle}
              </MDTypography>
            </MDBox>
            <Divider />
            {queueTable.rows.length > 0 ? (
              <DataTable
                table={queueTable}
                showTotalEntries={false}
                isSorted={false}
                noEndBorder
                entriesPerPage={false}
              />
            ) : (
              <MDBox p={3}>
                <MDTypography variant="button" color="text">
                  {queueEmpty}
                </MDTypography>
              </MDBox>
            )}
          </Card>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6" fontWeight="medium">
                {isBuyer ? "Supplier Availability" : "Export Supply Overview"}
              </MDTypography>
                <MDTypography variant="button" color="text" fontWeight="regular">
                  {isBuyer
                    ? "Published supply you can source for imports."
                    : "Published listings ready for buyer demand."}
                </MDTypography>
            </MDBox>
            <Divider />
            {supplierTable.rows.length > 0 ? (
              <DataTable
                table={supplierTable}
                showTotalEntries={false}
                isSorted={false}
                noEndBorder
                entriesPerPage={false}
              />
            ) : (
              <MDBox p={3}>
                <MDTypography variant="button" color="text">
                  No published listings available right now.
                </MDTypography>
              </MDBox>
            )}
          </Card>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default ExportHub;
