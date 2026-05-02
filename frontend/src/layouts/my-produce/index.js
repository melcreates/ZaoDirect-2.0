import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import AuthService from "services/auth-service";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function MyProduce() {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [myProcurement, setMyProcurement] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deletingId, setDeletingId] = useState("");

  const loadData = async (mounted = true) => {
    setLoading(true);
    setError("");
    try {
      const [profileData, listingData, procurementData] = await Promise.all([
        AuthService.getProfile(),
        HttpService.get("/api/listings"),
        HttpService.get("/api/ops/farmer-purchase-orders/mine").catch(() => []),
      ]);

      if (!mounted) return;

      const ownedListings = Array.isArray(listingData)
        ? profileData.role === "ADMIN"
          ? listingData
          : listingData.filter((item) => item.farmer_id === profileData.id)
        : [];

      setProfile(profileData);
      setListings(ownedListings);
      setMyProcurement(Array.isArray(procurementData) ? procurementData : []);
    } catch (err) {
      if (!mounted) return;
      setError(err?.message || "Failed to load your produce.");
    } finally {
      if (mounted) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadData(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  const deleteListing = async (listing) => {
    const confirmed = window.confirm(`Delete listing "${listing.title}"? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(listing.id);
    setError("");
    setSuccess("");
    try {
      await HttpService.delete(`/api/listings/${listing.id}`);
      setSuccess("Listing deleted successfully.");
      await loadData(true);
    } catch (err) {
      setError(err?.message || "Failed to delete listing.");
    } finally {
      setDeletingId("");
    }
  };

  const stats = useMemo(() => {
    const publishedCount = listings.filter((item) => item.status === "PUBLISHED").length;
    const liveProcurementStatuses = new Set(["OPEN", "CONFIRMED", "ALLOCATED", "READY_FOR_PICKUP", "PICKED_UP"]);
    const withLiveProcurement = new Set(
      myProcurement
        .filter((item) => item.listing_id && liveProcurementStatuses.has(String(item.status || "")))
        .map((item) => item.listing_id)
    );
    const fullyAllocated = new Set(
      myProcurement
        .filter((item) => item.listing_id && Number(item.remaining_weight || 0) <= 0 && item.status !== "REJECTED")
        .map((item) => item.listing_id)
    );
    return {
      total: listings.length,
      publishedCount,
      withLiveProcurementCount: withLiveProcurement.size,
      fullyAllocatedCount: fullyAllocated.size,
    };
  }, [listings, myProcurement]);

  const listingTable = useMemo(() => {
    const isAdmin = profile?.role === "ADMIN";
    const openCell = (item, text) => (
      <MDBox
        component={Link}
        to={`/produce/new?listingId=${encodeURIComponent(item.id)}`}
        sx={{
          display: "block",
          width: "100%",
          color: "inherit",
          textDecoration: "none",
          cursor: "pointer",
          "&:hover": { textDecoration: "underline" },
        }}
      >
        {text}
      </MDBox>
    );
    const columns = [
      { Header: "produce", accessor: "produce", align: "left" },
      ...(isAdmin ? [{ Header: "farmer", accessor: "farmer", align: "left" }] : []),
      { Header: "quantity", accessor: "quantity", align: "left" },
      { Header: "price/unit", accessor: "price", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "county", accessor: "county", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];

    const rows = listings.map((item) => ({
      produce: openCell(item, item.title),
      farmer: openCell(item, item.farmer_name || "-"),
      quantity: openCell(item, `${item.quantity} ${item.unit}`),
      price: openCell(item, currencyFormatter.format(Number(item.price_per_unit || 0))),
      status: openCell(item, toStatusLabel(item.status)),
      county: openCell(item, item.county || "-"),
      action: (
        <MDButton
          size="small"
          variant="text"
          color="error"
          onClick={() => deleteListing(item)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? "Deleting..." : "Delete"}
        </MDButton>
      ),
    }));

    return { columns, rows };
  }, [listings, profile?.role, deletingId]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2}>
          <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
            <MDBox>
              <MDTypography variant="h4" fontWeight="bold">
                My Produce
              </MDTypography>
              <MDTypography variant="button" color="text" fontWeight="regular">
                {profile
                  ? profile.role === "ADMIN"
                    ? "All farmer listings and publish status."
                    : `${profile.name}'s listing portfolio and publish status.`
                  : "Loading your profile..."}
              </MDTypography>
            </MDBox>
            <MDButton component={Link} to="/produce/new" color="info" variant="gradient">
              Add Produce
            </MDButton>
          </MDBox>
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
        {success && (
          <Card sx={{ mb: 3 }}>
            <MDBox p={2}>
              <MDTypography variant="button" color="success" fontWeight="medium">
                {success}
              </MDTypography>
            </MDBox>
          </Card>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="info"
              icon="inventory_2"
              title="Total Listings"
              count={stats.total}
              percentage={{ color: "info", amount: "", label: loading ? "Loading..." : "All statuses" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="success"
              icon="published_with_changes"
              title="Published"
              count={stats.publishedCount}
              percentage={{ color: "success", amount: "", label: loading ? "Loading..." : "Visible for matching" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="primary"
              icon="playlist_add_check"
              title="With Live Procurement"
              count={stats.withLiveProcurementCount}
              percentage={{ color: "primary", amount: "", label: loading ? "Loading..." : "Linked to active orders" }}
            />
          </Grid>
          <Grid item xs={12} md={6} lg={3}>
            <ComplexStatisticsCard
              color="dark"
              icon="done_all"
              title="Fully Allocated"
              count={stats.fullyAllocatedCount}
              percentage={{ color: "dark", amount: "", label: loading ? "Loading..." : "No remaining allocation" }}
            />
          </Grid>
        </Grid>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6" fontWeight="medium">
                My Listings
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
                  You have no listings yet.
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

export default MyProduce;
