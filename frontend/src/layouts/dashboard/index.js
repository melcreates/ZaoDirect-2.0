/**
=========================================================
* Material Dashboard 2 React - v2.1.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2022 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useEffect, useMemo, useState } from "react";

// @mui material components
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Divider from "@mui/material/Divider";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";

// Services
import AuthService from "services/auth-service";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const roleLabel = {
  FARMER: "Farmer",
  ADMIN: "Admin",
};

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function statusColor(status) {
  if (status === "COMPLETED" || status === "PUBLISHED") return "success";
  if (status === "REQUESTED" || status === "ACCEPTED" || status === "IN_PROGRESS") return "info";
  if (status === "CANCELLED" || status === "ARCHIVED") return "error";
  return "dark";
}

function makeEntityKey(item, idKey, nameKey) {
  if (!item) return "";
  if (item[idKey]) return `id-${item[idKey]}`;
  if (item[nameKey]) return `name-${item[nameKey]}`;
  return "";
}

function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [myProcurement, setMyProcurement] = useState([]);
  const [myFinanceOverview, setMyFinanceOverview] = useState(null);
  const [opsKpis, setOpsKpis] = useState(null);
  const [adminFinanceOverview, setAdminFinanceOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      try {
        const profileData = await AuthService.getProfile();

        const listingsRequest =
          profileData?.role === "ADMIN"
            ? HttpService.get("/api/listings")
            : profileData?.role === "FARMER"
              ? HttpService.get("/api/listings")
              : HttpService.get("/api/listings?status=PUBLISHED");

        const [listingsData, ordersData, myProcData, farmerFinanceData] = await Promise.all([
          listingsRequest,
          HttpService.get("/api/orders"),
          profileData?.role === "FARMER"
            ? HttpService.get("/api/ops/farmer-purchase-orders/mine")
            : Promise.resolve([]),
          profileData?.role === "FARMER"
            ? HttpService.get("/api/ops/farmer-finance-overview")
            : Promise.resolve(null),
        ]);

        if (!mounted) return;
        const normalizedListings = Array.isArray(listingsData) ? listingsData : [];
        const visibleListings =
          profileData?.role === "FARMER"
            ? normalizedListings.filter((item) => item.farmer_id === profileData.id)
            : normalizedListings;

        setProfile(profileData);
        setListings(visibleListings);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
        setMyProcurement(Array.isArray(myProcData) ? myProcData : []);
        setMyFinanceOverview(farmerFinanceData || null);
        if (profileData?.role === "ADMIN") {
          try {
            const [kpis, financeOverview] = await Promise.all([
              HttpService.get("/api/ops/kpis"),
              HttpService.get("/api/ops/finance-overview"),
            ]);
            if (mounted) setOpsKpis(kpis || null);
            if (mounted) setAdminFinanceOverview(financeOverview || null);
          } catch (_e) {
            if (mounted) {
              setOpsKpis(null);
              setAdminFinanceOverview(null);
            }
          }
        } else if (mounted) {
          setAdminFinanceOverview(null);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || "Failed to load dashboard data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const openOrderStatuses = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "SHIPPED"];
    const openOrders = orders.filter((order) => openOrderStatuses.includes(order.status)).length;
    const publishedListings = listings.filter((item) => item.status === "PUBLISHED").length;
    const requestedOrders = orders.filter((item) => item.status === "REQUESTED").length;
    const newProcurementRequests = myProcurement.filter((item) => item.status === "OPEN").length;
    const confirmedProcurement = myProcurement.filter((item) => item.status === "CONFIRMED").length;
    const allocatedProcurement = myProcurement.filter((item) => item.status === "ALLOCATED").length;
    const readyForPickupProcurement = myProcurement.filter((item) => item.status === "READY_FOR_PICKUP").length;
    const pickedUpProcurement = myProcurement.filter((item) => item.status === "PICKED_UP").length;
    const settledProcurement = myProcurement.filter((item) => item.status === "SETTLED").length;
    const buyerInProgressOrders = orders.filter((item) =>
      ["ACCEPTED", "IN_PROGRESS", "SHIPPED"].includes(item.status)
    ).length;
    const shippedOrders = orders.filter((item) => item.status === "SHIPPED").length;
    const completedOrders = orders.filter((item) => item.status === "COMPLETED").length;
    const listingPriceTotal = listings.reduce((sum, item) => sum + Number(item.price_per_unit || 0), 0);
    const averageListingPrice = listings.length > 0 ? listingPriceTotal / listings.length : 0;

    const farmerKeys = new Set();
    const buyerKeys = new Set();

    listings.forEach((item) => {
      const key = makeEntityKey(item, "farmer_id", "farmer_name");
      if (key) farmerKeys.add(key);
    });

    orders.forEach((item) => {
      const farmerKey = makeEntityKey(item, "farmer_id", "farmer_name");
      const buyerKey = makeEntityKey(item, "buyer_id", "buyer_name");
      if (farmerKey) farmerKeys.add(farmerKey);
      if (buyerKey) buyerKeys.add(buyerKey);
    });

    return {
      listingsCount: listings.length,
      publishedListings,
      openOrders,
      requestedOrders,
      newProcurementRequests,
      confirmedProcurement,
      allocatedProcurement,
      readyForPickupProcurement,
      pickedUpProcurement,
      settledProcurement,
      buyerInProgressOrders,
      shippedOrders,
      completedOrders,
      averageListingPrice,
      activeFarmers: farmerKeys.size,
      activeBuyers: buyerKeys.size,
    };
  }, [listings, orders, myProcurement]);

  const roleStats = useMemo(() => {
    if (profile?.role === "FARMER") {
      return [
        {
          color: "warning",
          icon: "mark_email_unread",
          title: "Open Requests",
          count: metrics.newProcurementRequests,
          label: "New procurement requests to confirm",
        },
        {
          color: "info",
          icon: "inventory_2",
          title: "Published Listings",
          count: metrics.publishedListings,
          label: "Your active listings visible to ops",
        },
        {
          color: "primary",
          icon: "local_shipping",
          title: "Allocated For Pickup",
          count: metrics.allocatedProcurement + metrics.readyForPickupProcurement,
          label: "Orders allocated and waiting collection workflow",
        },
        {
          color: "success",
          icon: "payments",
          title: "Settled Orders",
          count: metrics.settledProcurement,
          label: "Procurement orders fully paid",
        },
      ];
    }

    if (false) {
      return [
        {
          color: "info",
          icon: "storefront",
          title: "Published Produce",
          count: metrics.publishedListings,
          label: "Products ready to order now",
        },
        {
          color: "primary",
          icon: "agriculture",
          title: "Active Farmers",
          count: metrics.activeFarmers,
          label: "Farmers currently supplying produce",
        },
        {
          color: "warning",
          icon: "receipt_long",
          title: "My Open Orders",
          count: metrics.openOrders,
          label: "Requested, accepted, or in shipment",
        },
        {
          color: "success",
          icon: "done_all",
          title: "My Completed",
          count: metrics.completedOrders,
          label: "Successfully completed purchase orders",
        },
      ];
    }

    return [
      {
        color: "info",
        icon: "inventory_2",
        title: "Total Listings",
        count: metrics.listingsCount,
        label: "All listings from farmers",
      },
      {
        color: "success",
        icon: "receipt_long",
        title: "Open Orders",
        count: metrics.openOrders,
        label: "Orders requiring active follow-up",
      },
      {
        color: "primary",
        icon: "agriculture",
        title: "Active Farmers",
        count: metrics.activeFarmers,
        label: "Farmers represented in listings/orders",
      },
      {
        color: "dark",
        icon: "public",
        title: "Active Clients",
        count: metrics.activeBuyers,
        label: "International clients participating in trade",
      },
    ];
  }, [metrics, profile?.role]);

  const listingTable = useMemo(() => {
    const columns = [
      { Header: "Produce", accessor: "produce", align: "left" },
      { Header: "Farmer", accessor: "farmer", align: "left" },
      { Header: "Quantity", accessor: "quantity", align: "left" },
      { Header: "Price", accessor: "price", align: "left" },
      { Header: "Status", accessor: "status", align: "left" },
    ];

    const rows = listings.slice(0, 8).map((item) => ({
      produce: item.title,
      farmer: item.farmer_name || "-",
      quantity: `${item.quantity} ${item.unit}`,
      price: currencyFormatter.format(Number(item.price_per_unit || 0)),
      status: (
        <MDTypography variant="caption" color={statusColor(item.status)} fontWeight="bold">
          {toStatusLabel(item.status)}
        </MDTypography>
      ),
    }));

    return { columns, rows };
  }, [listings]);

  const listingSectionTitle = profile?.role === "ADMIN" ? "Latest Produce Listings" : "Published Produce Listings";
  const listingSectionSubtitle =
    profile?.role === "ADMIN"
      ? "Latest farmer listings across all statuses."
      : "Your listings currently available in operations.";
  const emptyListingMessage =
    profile?.role === "ADMIN"
      ? "No listings created yet."
      : "No published listings available right now.";
  const ordersSectionTitle = profile?.role === "FARMER" ? "My Procurement Workflow" : "Recent Order Activity";
  const ordersSectionSubtitle =
    profile?.role === "FARMER"
      ? "Track request confirmation, allocation, pickup, and settlement."
      : "Latest client-farmer order interactions and fulfillment status.";

  const orderTable = useMemo(() => {
    if (profile?.role === "FARMER") {
      const columns = [
        { Header: "buyer", accessor: "buyer", align: "left" },
        { Header: "crop", accessor: "crop", align: "left" },
        { Header: "order weight", accessor: "qty", align: "left" },
        { Header: "allocated", accessor: "allocated", align: "left" },
        { Header: "remaining", accessor: "remaining", align: "left" },
        { Header: "status", accessor: "status", align: "left" },
      ];

      const rows = myProcurement.slice(0, 8).map((item) => ({
        buyer: item.buyer_name || "-",
        crop: item.crop_type || "-",
        qty: `${item.quantity} ${item.unit}`,
        allocated: `${Number(item.allocated_weight || 0)} ${item.unit}`,
        remaining: `${Number(item.remaining_weight || 0)} ${item.unit}`,
        status: (
          <MDTypography variant="caption" color={statusColor(item.status)} fontWeight="bold">
            {toStatusLabel(item.status)}
          </MDTypography>
        ),
      }));

      return { columns, rows };
    }

    const columns = [
      { Header: "Order", accessor: "order", align: "left" },
      { Header: "Counterparty", accessor: "counterparty", align: "left" },
      { Header: "Requested", accessor: "requested", align: "left" },
      { Header: "Offer", accessor: "offer", align: "left" },
      { Header: "Status", accessor: "status", align: "left" },
      { Header: "Flight", accessor: "flight", align: "left" },
      { Header: "Tracking", accessor: "tracking", align: "left" },
      { Header: "Updated", accessor: "updated", align: "left" },
    ];

    const rows = orders.slice(0, 8).map((item) => {
      const counterparty =
        profile?.role === "FARMER"
          ? item.buyer_name
          : `${item.buyer_name} -> ${item.farmer_name}`;

      return {
        order: item.listing_title || item.listing_id,
        counterparty: counterparty || "-",
        requested: `${item.requested_qty} ${item.unit}`,
        offer: currencyFormatter.format(Number(item.offer_price || 0)),
        status: (
          <MDTypography variant="caption" color={statusColor(item.status)} fontWeight="bold">
            {toStatusLabel(item.status)}
          </MDTypography>
        ),
        flight: item.shipment_flight_number || "-",
        tracking: item.shipment_tracking_status ? toStatusLabel(item.shipment_tracking_status) : "-",
        updated: formatDate(item.updated_at),
      };
    });

    return { columns, rows };
  }, [orders, myProcurement, profile?.role]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox mb={2}>
          <MDTypography variant="h4" fontWeight="bold">
            Operations Dashboard
          </MDTypography>
          <MDTypography variant="button" color="text" fontWeight="regular">
            {profile ? `Role: ${roleLabel[profile.role] || profile.role}` : "Loading role..."}
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
          {roleStats.map((stat) => (
            <Grid item xs={12} md={6} lg={3} key={stat.title}>
              <ComplexStatisticsCard
                color={stat.color}
                icon={stat.icon}
                title={stat.title}
                count={numberFormatter.format(stat.count)}
                percentage={{
                  color: stat.color,
                  amount: "",
                  label: loading ? "Loading..." : stat.label,
                }}
              />
            </Grid>
          ))}
        </Grid>

        {profile?.role === "ADMIN" && opsKpis && (
          <MDBox mt={3}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6} lg={3}>
                <ComplexStatisticsCard
                  color="info"
                  icon="local_shipping"
                  title="Ready for Pickup"
                  count={numberFormatter.format(opsKpis.todaysPickups || 0)}
                  percentage={{ color: "info", amount: "", label: "Farmer-confirmed lots awaiting collection" }}
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <ComplexStatisticsCard
                  color="primary"
                  icon="flight_takeoff"
                  title="In-Transit Batches"
                  count={numberFormatter.format(opsKpis.inTransitBatches || 0)}
                  percentage={{ color: "primary", amount: "", label: "Dispatched or shipped batches" }}
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <ComplexStatisticsCard
                  color="warning"
                  icon="warning"
                  title="Delayed Shipments"
                  count={numberFormatter.format(opsKpis.delayedShipments || 0)}
                  percentage={{ color: "warning", amount: "", label: "Tracking status = delayed" }}
                />
              </Grid>
              <Grid item xs={12} md={6} lg={3}>
                <ComplexStatisticsCard
                  color="dark"
                  icon="account_balance_wallet"
                  title="Pending Payouts"
                  count={`USD ${numberFormatter.format(opsKpis.pendingPayoutsValueUsd || 0)}`}
                  percentage={{ color: "dark", amount: "", label: "Awaiting farmer settlement" }}
                />
              </Grid>
            </Grid>
          </MDBox>
        )}

        <MDBox mt={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={6}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}>
                  {profile?.role === "FARMER" ? (
                    <>
                      <MDTypography variant="h6" fontWeight="medium">
                        Farmer Operations
                      </MDTypography>
                      <MDTypography variant="button" color="text" fontWeight="regular">
                        Procurement flow from confirmation to pickup.
                      </MDTypography>
                      <MDBox mt={2}>
                        <MDTypography variant="button" color="text">
                          Confirmed requests: <strong>{numberFormatter.format(metrics.confirmedProcurement)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Allocated: <strong>{numberFormatter.format(metrics.allocatedProcurement)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Ready for pickup: <strong>{numberFormatter.format(metrics.readyForPickupProcurement)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Collected: <strong>{numberFormatter.format(metrics.pickedUpProcurement)}</strong>
                        </MDTypography>
                      </MDBox>
                    </>
                  ) : (
                    <>
                      <MDTypography variant="h6" fontWeight="medium">
                        Operations Snapshot
                      </MDTypography>
                      <MDTypography variant="button" color="text" fontWeight="regular">
                        Daily execution status across pickup and logistics.
                      </MDTypography>
                      <MDBox mt={2}>
                        <MDTypography variant="button" color="text">
                          Ready for pickup:{" "}
                          <strong>{numberFormatter.format(opsKpis?.todaysPickups || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          In-transit batches:{" "}
                          <strong>{numberFormatter.format(opsKpis?.inTransitBatches || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Delayed shipments:{" "}
                          <strong>{numberFormatter.format(opsKpis?.delayedShipments || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Open international orders:{" "}
                          <strong>{numberFormatter.format(adminFinanceOverview?.openInternationalOrders || 0)}</strong>
                        </MDTypography>
                      </MDBox>
                    </>
                  )}
                </MDBox>
              </Card>
            </Grid>
            <Grid item xs={12} lg={6}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}>
                  {profile?.role === "FARMER" ? (
                    <>
                      <MDTypography variant="h6" fontWeight="medium">
                        Farmer Finance Snapshot
                      </MDTypography>
                      <MDTypography variant="button" color="text" fontWeight="regular">
                        Payment visibility from procurement settlements.
                      </MDTypography>
                      <MDBox mt={2}>
                        <MDTypography variant="button" color="text">
                          Total earned:{" "}
                          <strong>KES {numberFormatter.format(myFinanceOverview?.totalEarnedValue || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Pending payout:{" "}
                          <strong>KES {numberFormatter.format(myFinanceOverview?.pendingValue || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Adjustments:{" "}
                          <strong>KES {numberFormatter.format(myFinanceOverview?.adjustmentsValue || 0)}</strong>
                        </MDTypography>
                      </MDBox>
                    </>
                  ) : (
                    <>
                      <MDTypography variant="h6" fontWeight="medium">
                        Finance Snapshot
                      </MDTypography>
                      <MDTypography variant="button" color="text" fontWeight="regular">
                        Live payout and exposure view for operations.
                      </MDTypography>
                      <MDBox mt={2}>
                        <MDTypography variant="button" color="text">
                          Total payouts:{" "}
                          <strong>USD {numberFormatter.format(adminFinanceOverview?.totalPayoutValueUsd || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Pending payouts:{" "}
                          <strong>
                            USD {numberFormatter.format(adminFinanceOverview?.pendingPayoutValueUsd || 0)}
                          </strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Total costs:{" "}
                          <strong>USD {numberFormatter.format(adminFinanceOverview?.totalCostValue || 0)}</strong>
                        </MDTypography>
                        <MDTypography variant="button" color="text" display="block">
                          Active clients: <strong>{numberFormatter.format(metrics.activeBuyers)}</strong>
                        </MDTypography>
                      </MDBox>
                    </>
                  )}
                </MDBox>
              </Card>
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <Card>
                <MDBox p={3}>
                  <MDTypography variant="h6" fontWeight="medium">
                    {listingSectionTitle}
                  </MDTypography>
                  <MDTypography variant="button" color="text" fontWeight="regular">
                    {listingSectionSubtitle}
                  </MDTypography>
                </MDBox>
                <Divider />
                <MDBox>
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
                        {emptyListingMessage}
                      </MDTypography>
                    </MDBox>
                  )}
                </MDBox>
              </Card>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={3}>
                  <MDTypography variant="h6" fontWeight="medium">
                    {ordersSectionTitle}
                  </MDTypography>
                  <MDTypography variant="button" color="text" fontWeight="regular">
                    {ordersSectionSubtitle}
                  </MDTypography>
                </MDBox>
                <Divider />
                <MDBox>
                  {orderTable.rows.length > 0 ? (
                    <DataTable
                      table={orderTable}
                      showTotalEntries={false}
                      isSorted={false}
                      noEndBorder
                      entriesPerPage={false}
                    />
                  ) : (
                    <MDBox p={3} display="flex" alignItems="center" gap={1}>
                      <Icon color="info">notifications_none</Icon>
                      <MDTypography variant="button" color="text">
                        No orders yet.
                      </MDTypography>
                    </MDBox>
                  )}
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

export default Dashboard;
