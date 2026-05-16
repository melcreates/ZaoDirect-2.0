/**
=========================================================
* Material Dashboard 3 PRO React - v2.4.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-pro-react
* Copyright 2024 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import Icon from "@mui/material/Icon";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAlert from "components/MDAlert";

// Material Dashboard 3 PRO React examples
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import BookingCard from "examples/Cards/BookingCard";

// Anaytics dashboard components
import SalesByCountry from "layouts/dashboards/analytics/components/SalesByCountry";

import HttpService from "services/http.service";
import AuthService from "services/auth-service";

// Images
import booking1 from "assets/images/products/product-1-min.jpg";
import booking2 from "assets/images/products/product-2-min.jpg";
import booking3 from "assets/images/products/product-3-min.jpg";

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function buildLast7Days() {
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    days.push(d);
  }
  return days;
}

function getListingCardImage(listing, fallbackIndex) {
  const photoUrls = Array.isArray(listing?.photo_urls) ? listing.photo_urls : [];
  return photoUrls[0] || [booking1, booking2, booking3][fallbackIndex % 3];
}

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [listings, setListings] = useState([]);
  const [procurements, setProcurements] = useState([]);
  const [batches, setBatches] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const me = await AuthService.getProfile();
        const currentRole = String(me?.role || "").toUpperCase();
        setRole(currentRole);

        if (currentRole === "ADMIN") {
          const [listingRows, procurementRows, batchRows] = await Promise.all([
            HttpService.get("/listings"),
            HttpService.get("/ops/farmer-purchase-orders"),
            HttpService.get("/ops/batches"),
          ]);
          setListings(Array.isArray(listingRows) ? listingRows : []);
          setProcurements(Array.isArray(procurementRows) ? procurementRows : []);
          setBatches(Array.isArray(batchRows) ? batchRows : []);
        } else {
          const [listingRows, mineOrders] = await Promise.all([
            HttpService.get("/listings"),
            HttpService.get("/ops/farmer-purchase-orders/mine"),
          ]);
          const myId = me?.id;
          const allListings = Array.isArray(listingRows) ? listingRows : [];
          const myListings = allListings.filter((item) => {
            const ownerId = item?.owner_user_id || item?.farmer_id || item?.user_id || item?.ownerId;
            return ownerId === myId;
          });
          setListings(myListings);
          setProcurements(Array.isArray(mineOrders) ? mineOrders : []);
          setBatches([]);
        }
      } catch (e) {
        setError(e?.message || "Unable to load operations overview.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const kpis = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const today = dateKey(now);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterday = dateKey(yesterdayDate);
    const last7 = buildLast7Days();
    const last7Keys = last7.map((d) => dateKey(d));

    const publishedListings = listings.filter(
      (l) => String(l?.status || "").toUpperCase() === "PUBLISHED"
    );
    const publishedThisWeek = publishedListings.filter((l) => {
      const createdAt = l?.created_at ? new Date(l.created_at) : null;
      return createdAt && createdAt >= weekStart;
    });
    const publishedByDay = last7Keys.map(
      (key) =>
        publishedListings.filter((l) => l?.created_at && dateKey(l.created_at) === key).length
    );

    const readyForPickup = procurements.filter(
      (o) => String(o?.status || "").toUpperCase() === "READY_FOR_PICKUP"
    );
    const pickupToday = readyForPickup.filter((o) => o?.updated_at && dateKey(o.updated_at) === today).length;
    const pickupYesterday = readyForPickup.filter(
      (o) => o?.updated_at && dateKey(o.updated_at) === yesterday
    ).length;
    const pickupDeltaPct =
      pickupYesterday === 0 ? (pickupToday > 0 ? 100 : 0) : ((pickupToday - pickupYesterday) / pickupYesterday) * 100;
    const pickupByDay = last7Keys.map(
      (key) => readyForPickup.filter((o) => o?.updated_at && dateKey(o.updated_at) === key).length
    );

    let executionProgressPct = 0;
    let shippedByDay = Array(7).fill(0);
    if (role === "ADMIN") {
      const shippedOrDelivered = batches.filter((b) =>
        ["SHIPPED", "DELIVERED"].includes(String(b?.status || "").toUpperCase())
      );
      executionProgressPct = batches.length
        ? Math.round((shippedOrDelivered.length / batches.length) * 100)
        : 0;
      shippedByDay = last7Keys.map(
        (key) =>
          shippedOrDelivered.filter(
            (b) => (b?.updated_at || b?.created_at) && dateKey(b?.updated_at || b?.created_at) === key
          ).length
      );
    } else {
      const mineShipped = procurements.filter((o) =>
        ["PARTIALLY_SHIPPED", "SHIPPED", "DELIVERED"].includes(String(o?.shipment_progress || "").toUpperCase())
      );
      executionProgressPct = procurements.length
        ? Math.round((mineShipped.length / procurements.length) * 100)
        : 0;
      shippedByDay = last7Keys.map(
        (key) =>
          mineShipped.filter((o) => (o?.updated_at || o?.created_at) && dateKey(o?.updated_at || o?.created_at) === key)
            .length
      );
    }

    return {
      publishedCount: publishedThisWeek.length,
      publishedChart: {
        labels: ["M", "T", "W", "T", "F", "S", "S"],
        datasets: { label: "Listings", data: publishedByDay },
      },
      pickupDeltaText: `${pickupDeltaPct >= 0 ? "+" : ""}${Math.round(pickupDeltaPct)}%`,
      pickupChart: {
        labels: ["M", "T", "W", "T", "F", "S", "S"],
        datasets: { label: "Pickups", data: pickupByDay },
      },
      shippedProgressText: `${executionProgressPct}%`,
      shippedChart: {
        labels: ["M", "T", "W", "T", "F", "S", "S"],
        datasets: { label: "Shipped batches", data: shippedByDay },
      },
      openRequests: procurements.filter((o) => String(o?.status || "").toUpperCase() === "OPEN").length,
      publishedActiveListings: publishedListings.length,
      allocatedForPickup: procurements.filter((o) =>
        ["ALLOCATED", "READY_FOR_PICKUP"].includes(String(o?.status || "").toUpperCase())
      ).length,
      settledOrders: procurements.filter((o) => String(o?.status || "").toUpperCase() === "SETTLED").length,
    };
  }, [batches, listings, procurements, role]);

  const listingCards = useMemo(() => {
    const rows = listings
      .filter((l) => String(l?.status || "").toUpperCase() === "PUBLISHED")
      .slice(0, 6);

    return rows.map((listing, idx) => ({
      image: getListingCardImage(listing, idx),
      title: listing?.title || listing?.name || listing?.crop_type || "Produce Listing",
      description:
        listing?.description ||
        `${listing?.category || "Produce"} • ${listing?.unit || "kg"} • ${listing?.currency || "KES"} ${
          listing?.price_per_unit || listing?.price || "-"
        }/unit`,
      price: `${Number(listing?.quantity_kg || listing?.quantity || 0).toLocaleString()} ${
        listing?.unit || "kg"
      }`,
      location: `${listing?.county || "Kenya"}, ${listing?.country || "Kenya"}`,
    }));
  }, [listings]);

  // Action buttons for the BookingCard
  const actionButtons = (
    <>
      <Tooltip title="Refresh" placement="bottom">
        <MDTypography
          variant="body1"
          color="primary"
          lineHeight={1}
          sx={{ cursor: "pointer", mx: 3 }}
        >
          <Icon color="inherit">refresh</Icon>
        </MDTypography>
      </Tooltip>
      <Tooltip title="Edit" placement="bottom">
        <MDTypography
          variant="body1"
          color="info"
          lineHeight={1}
          sx={{ cursor: "pointer", mx: 3 }}
        >
          <Icon color="inherit">edit</Icon>
        </MDTypography>
      </Tooltip>
    </>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pb={3}>
        <MDBox mb={3} ml={1}>
          <MDTypography variant="h4" fontWeight="bold">
            Operations Overview
          </MDTypography>
          <MDTypography
            variant="button"
            fontWeight="regular"
            sx={{ fontSize: "16px", color: "#737373" }}
          >
            Live snapshot of procurement, batches, shipments, and farmer payouts.
          </MDTypography>
        </MDBox>
        {error && (
          <MDAlert color="error" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">
              {error}
            </MDTypography>
          </MDAlert>
        )}
        <MDBox>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                <ReportsBarChart
                  color="success"
                  title="produce listings"
                  description={`Published listings this week: ${kpis.publishedCount}`}
                  date={loading ? "loading..." : "updated just now"}
                  chart={kpis.publishedChart}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                <ReportsLineChart
                  color="success"
                  title="daily pickups"
                  description={
                    <>
                      (<strong>{kpis.pickupDeltaText}</strong>) pickup confirmations vs yesterday.
                    </>
                  }
                  date={loading ? "loading..." : "updated just now"}
                  chart={kpis.pickupChart}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={4}>
              <MDBox mb={3}>
                <ReportsLineChart
                  color="success"
                  title="shipped batches"
                  description={`Execution progress: ${kpis.shippedProgressText}`}
                  date={loading ? "loading..." : "updated just now"}
                  chart={kpis.shippedChart}
                />
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>
        <MDBox>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3} sx={{ display: "flex" }}>
              <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                <ComplexStatisticsCard
                  icon="weekend"
                  title="Open Requests"
                  count={kpis.openRequests}
                  percentage={{
                    color: "success",
                    amount: "",
                    label: "New procurement requests to confirm",
                  }}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={3} sx={{ display: "flex" }}>
              <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                <ComplexStatisticsCard
                  icon="leaderboard"
                  title="Published Listings"
                  count={kpis.publishedActiveListings}
                  percentage={{
                    color: "success",
                    amount: "",
                    label: "Your active listings visible to ops",
                  }}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={3} sx={{ display: "flex" }}>
              <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                <ComplexStatisticsCard
                  icon="store"
                  title="Allocated For Pickup"
                  count={kpis.allocatedForPickup}
                  percentage={{
                    color: "success",
                    amount: "",
                    label: "Orders allocated and waiting collection workflow",
                  }}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6} lg={3} sx={{ display: "flex" }}>
              <MDBox width="100%" sx={{ "& > *": { height: "100%" } }}>
                <ComplexStatisticsCard
                  icon="person_add"
                  title="Settled Orders"
                  count={kpis.settledOrders}
                  percentage={{
                    color: "success",
                    amount: "",
                    label: "Procurement orders fully paid",
                  }}
                />
              </MDBox>
            </Grid>
          </Grid>
        </MDBox>
        <MDBox>
          <Grid container spacing={3}>
            {listingCards.map((card) => (
              <Grid item xs={12} md={6} lg={4} key={`${card.title}-${card.location}-${card.price}`}>
                <MDBox mt={3}>
                  <BookingCard
                    image={card.image}
                    title={card.title}
                    description={card.description}
                    price={card.price}
                    location={card.location}
                    action={actionButtons}
                  />
                </MDBox>
              </Grid>
            ))}
            {!listingCards.length && (
              <Grid item xs={12}>
                <MDBox mt={3}>
                  <MDAlert color="info">
                    <MDTypography variant="button" color="white">
                      No published produce listings yet.
                    </MDTypography>
                  </MDAlert>
                </MDBox>
              </Grid>
            )}
          </Grid>
        </MDBox>
        {role === "ADMIN" && (
          <Grid container mt={3}>
            <SalesByCountry />
          </Grid>
        )}
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default Analytics;
