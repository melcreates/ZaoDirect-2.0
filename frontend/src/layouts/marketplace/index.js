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
import HttpService from "services/htttp.service";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function Marketplace() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const data = await HttpService.get("/api/listings?status=PUBLISHED");
        if (!mounted) return;
        setListings(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load listings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const farmerKeys = new Set(
      listings
        .map((item) => item.farmer_id || item.farmer_name)
        .filter(Boolean)
        .map((value) => String(value))
    );

    return {
      totalListings: listings.length,
      activeFarmers: farmerKeys.size,
    };
  }, [listings]);

  const listingTable = useMemo(() => {
    const columns = [
      { Header: "produce", accessor: "produce", align: "left" },
      { Header: "farmer", accessor: "farmer", align: "left" },
      { Header: "quantity", accessor: "quantity", align: "left" },
      { Header: "price/unit", accessor: "price", align: "left" },
      { Header: "county", accessor: "county", align: "left" },
    ];

    const rows = listings.slice(0, 10).map((item) => ({
      produce: item.title,
      farmer: item.farmer_name || "-",
      quantity: `${item.quantity} ${item.unit}`,
      price: currencyFormatter.format(Number(item.price_per_unit || 0)),
      county: item.county || "-",
    }));

    return { columns, rows };
  }, [listings]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2}>
          <MDTypography variant="h4" fontWeight="bold">
            Produce Marketplace
          </MDTypography>
          <MDTypography variant="button" color="text" fontWeight="regular">
            Live view of published produce available for buyers.
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
              color="info"
              icon="storefront"
              title="Published Listings"
              count={stats.totalListings}
              percentage={{ color: "info", amount: "", label: loading ? "Loading..." : "Ready for orders" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="success"
              icon="agriculture"
              title="Active Farmers"
              count={stats.activeFarmers}
              percentage={{ color: "success", amount: "", label: loading ? "Loading..." : "Supplying produce" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="dark"
              icon="local_shipping"
              title="Avg Price"
              count={currencyFormatter.format(
                listings.length
                  ? listings.reduce((sum, item) => sum + Number(item.price_per_unit || 0), 0) / listings.length
                  : 0
              )}
              percentage={{ color: "dark", amount: "", label: loading ? "Loading..." : "Average market offer" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="primary"
              icon="assignment_turned_in"
              title="Categories"
              count={new Set(listings.map((item) => item.category).filter(Boolean)).size}
              percentage={{ color: "primary", amount: "", label: loading ? "Loading..." : "Unique produce categories" }}
            />
          </Grid>
        </Grid>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6" fontWeight="medium">
                Latest Published Listings
              </MDTypography>
            </MDBox>
            <Divider />
            {listingTable.rows.length > 0 ? (
              <DataTable
                table={listingTable}
                showTotalEntries={false}
                isSorted={false}
                noEndBorder
                entriesPerPage={false}
              />
            ) : (
              <MDBox p={3}>
                <MDTypography variant="button" color="text">
                  No published listings available yet.
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

export default Marketplace;
