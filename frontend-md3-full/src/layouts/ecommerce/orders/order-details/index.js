import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";
import MDAvatar from "components/MDAvatar";
import MDBadge from "components/MDBadge";

// Material Dashboard 3 PRO React examples
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import TimelineItem from "examples/Timeline/TimelineItem";

import HttpService from "services/http.service";
import AuthService from "services/auth-service";
import zaodirectLogo from "assets/images/ZaoDirectLogo.svg";

function formatStatus(value) {
  return String(value || "-")
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function statusColor(status) {
  const s = String(status || "").toUpperCase();
  if (["SETTLED", "DELIVERED"].includes(s)) return "success";
  if (["CONFIRMED", "ALLOCATED", "READY_FOR_PICKUP", "PICKED_UP", "COLLECTING"].includes(s)) return "info";
  if (["OPEN", "DRAFT", "PENDING"].includes(s)) return "warning";
  if (["REJECTED", "CANCELLED"].includes(s)) return "error";
  return "dark";
}

function OrderDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = new URLSearchParams(location.search).get("id");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [role, setRole] = useState("");
  const [order, setOrder] = useState(null);
  const [confirmAction, setConfirmAction] = useState("");

  const canAccept = useMemo(() => {
    const status = String(order?.status || "").toUpperCase();
    return role === "FARMER" && status === "OPEN";
  }, [order?.status, role]);

  const canMarkReady = useMemo(() => {
    const status = String(order?.status || "").toUpperCase();
    return role === "FARMER" && status === "ALLOCATED";
  }, [order?.status, role]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const me = await AuthService.getProfile();
      const currentRole = String(me?.role || "").toUpperCase();
      setRole(currentRole);

      const rows =
        currentRole === "ADMIN"
          ? await HttpService.get("/ops/farmer-purchase-orders")
          : await HttpService.get("/ops/farmer-purchase-orders/mine");

      const all = Array.isArray(rows) ? rows : [];
      const found = all.find((x) => String(x?.id) === String(orderId));

      if (!found) {
        setError("Order not found or you do not have access to it.");
        setOrder(null);
        return;
      }

      setOrder(found);
    } catch (e) {
      setError("Something went wrong. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) {
      setError("Missing order id.");
      setLoading(false);
      return;
    }
    load();
  }, [orderId]);

  const handleAccept = async () => {
    setConfirmAction("accept");
  };

  const doAccept = async () => {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await HttpService.patch(`/ops/farmer-purchase-orders/${encodeURIComponent(orderId)}/farmer-status`, {
        status: "CONFIRMED",
      });

      setSuccess("Order accepted successfully.");
      await load();
    } catch (e) {
      setError(e?.message || "Unable to accept this order.");
    } finally {
      setSubmitting(false);
      setConfirmAction("");
    }
  };

  const handleMarkReady = async () => {
    setConfirmAction("ready");
  };

  const doMarkReady = async () => {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await HttpService.patch(`/ops/farmer-purchase-orders/${encodeURIComponent(orderId)}/farmer-status`, {
        status: "READY_FOR_PICKUP",
      });

      setSuccess("Order marked ready for pickup.");
      await load();
    } catch (e) {
      setError(e?.message || "Unable to mark order as ready.");
    } finally {
      setSubmitting(false);
      setConfirmAction("");
    }
  };

  const qty = `${Number(order?.quantity || 0).toLocaleString()} ${order?.unit || "kg"}`;
  const allocatedQty = `${Number(order?.accepted_quantity || 0).toLocaleString()} ${order?.unit || "kg"}`;
  const pickedQty = `${Number(order?.actual_picked_quantity || 0).toLocaleString()} ${order?.unit || "kg"}`;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox my={6}>
        {error && (
          <MDAlert color="error" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">
              {error}
            </MDTypography>
          </MDAlert>
        )}

        {success && (
          <MDAlert color="success" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">
              {success}
            </MDTypography>
          </MDAlert>
        )}

        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} lg={10}>
            <Card>
              <MDBox pt={2} px={2} display="flex" justifyContent="space-between" alignItems="center">
                <MDBox>
                  <MDTypography variant="h6" fontWeight="medium">
                    Order Details
                  </MDTypography>
                  <MDTypography component="p" variant="button" color="text">
                    Order no. <b>{String(order?.id || "-").slice(0, 12)}</b>
                  </MDTypography>
                  <MDTypography component="p" variant="button" color="text">
                    Status: <b>{formatStatus(order?.status)}</b>
                  </MDTypography>
                </MDBox>
                <MDBox display="flex" gap={1}>
                  <MDButton variant="outlined" color="dark" onClick={() => navigate("/ecommerce/orders/order-list")}>
                    Back
                  </MDButton>
                  {canAccept && (
                    <MDButton variant="gradient" color="dark" onClick={handleAccept} disabled={submitting}>
                      {submitting ? "Accepting..." : "Accept Order"}
                    </MDButton>
                  )}
                  {canMarkReady && (
                    <MDButton variant="gradient" color="dark" onClick={handleMarkReady} disabled={submitting}>
                      {submitting ? "Saving..." : "Mark Ready For Pickup"}
                    </MDButton>
                  )}
                </MDBox>
              </MDBox>

              <Divider />

              <MDBox pt={1} pb={3} px={2}>
                {!loading && order ? (
                  <>
                    <MDBox mb={3}>
                      <Grid container spacing={3} alignItems="center">
                        <Grid item xs={12} md={7}>
                          <MDBox display="flex" alignItems="center">
                            <MDAvatar
                              size="xl"
                              src={zaodirectLogo}
                              alt="ZaoDirect"
                              bgColor="light"
                              sx={{ p: 0.5, bgcolor: "#fff", border: "1px solid", borderColor: "grey.400" }}
                            />
                            <MDBox ml={2} lineHeight={1}>
                              <MDTypography variant="h6" fontWeight="medium">
                                ZaoDirect
                              </MDTypography>
                              <MDBox mb={1}>
                                <MDTypography variant="button" color="text">
                                  Procurement customer
                                </MDTypography>
                              </MDBox>
                              <MDBadge variant="gradient" color={statusColor(order?.status)} size="xs" badgeContent={formatStatus(order?.status)} container />
                            </MDBox>
                          </MDBox>
                        </Grid>
                        <Grid item xs={12} md={5} sx={{ textAlign: { xs: "left", md: "right" } }}>
                          <MDTypography variant="button" color="text" display="block">
                            Crop: <b>{order?.crop_type || "-"}</b>
                          </MDTypography>
                          <MDTypography variant="button" color="text" display="block">
                            Pickup: <b>{order?.pickup_date ? new Date(order.pickup_date).toLocaleDateString() : "-"}</b>
                          </MDTypography>
                          <MDTypography variant="button" color="text" display="block">
                            Location: <b>{order?.pickup_location || "-"}</b>
                          </MDTypography>
                        </Grid>
                      </Grid>
                    </MDBox>

                    <Divider />

                    <MDBox mt={3}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6} lg={4}>
                          <MDTypography variant="h6" fontWeight="medium">
                            Track order
                          </MDTypography>
                          <MDBox mt={2}>
                            <TimelineItem color="secondary" icon="description" title="Order created" dateTime={order?.created_at ? new Date(order.created_at).toLocaleString() : "-"} />
                            <TimelineItem
                              color={["CONFIRMED", "ALLOCATED", "READY_FOR_PICKUP", "PICKED_UP", "SETTLED"].includes(String(order?.status || "").toUpperCase()) ? "success" : "secondary"}
                              icon="check_circle"
                              title="Order accepted"
                              dateTime={["CONFIRMED", "ALLOCATED", "READY_FOR_PICKUP", "PICKED_UP", "SETTLED"].includes(String(order?.status || "").toUpperCase()) ? "Completed" : "Pending"}
                            />
                            <TimelineItem
                              color={["READY_FOR_PICKUP", "PICKED_UP", "SETTLED"].includes(String(order?.status || "").toUpperCase()) ? "success" : "secondary"}
                              icon="warehouse"
                              title="Ready for pickup"
                              dateTime={["READY_FOR_PICKUP", "PICKED_UP", "SETTLED"].includes(String(order?.status || "").toUpperCase()) ? "Completed" : "Pending"}
                            />
                            <TimelineItem color={["ALLOCATED","READY_FOR_PICKUP","PICKED_UP","SETTLED"].includes(String(order?.status || "").toUpperCase()) ? "success" : "secondary"} icon="local_shipping" title="Collection workflow" dateTime={formatStatus(order?.status)} />
                            <TimelineItem color={String(order?.status || "").toUpperCase() === "SETTLED" ? "success" : "secondary"} icon="payments" title="Settlement" dateTime={String(order?.status || "").toUpperCase() === "SETTLED" ? "Paid" : "Pending"} lastItem />
                          </MDBox>
                        </Grid>

                        <Grid item xs={12} md={6} lg={4}>
                          <Card sx={{ height: "100%" }}>
                            <MDBox p={2}>
                              <MDTypography variant="h6" fontWeight="medium" gutterBottom>
                                Quantity Details
                              </MDTypography>
                              <MDTypography variant="button" color="text" display="block">Requested: <b>{qty}</b></MDTypography>
                              <MDTypography variant="button" color="text" display="block">Allocated: <b>{allocatedQty}</b></MDTypography>
                              <MDTypography variant="button" color="text" display="block">Picked: <b>{pickedQty}</b></MDTypography>
                            </MDBox>
                          </Card>
                        </Grid>

                        <Grid item xs={12} lg={4}>
                          <Card sx={{ height: "100%" }}>
                            <MDBox p={2}>
                              <MDTypography variant="h6" fontWeight="medium" gutterBottom>
                                Order Summary
                              </MDTypography>
                              <MDTypography variant="button" color="text" display="block">
                                Price: <b>{order?.currency || "KES"} {Number(order?.farm_gate_price || 0).toLocaleString()} / unit</b>
                              </MDTypography>
                              <MDTypography variant="button" color="text" display="block">
                                Current status: <b>{formatStatus(order?.status)}</b>
                              </MDTypography>
                              <MDTypography variant="button" color="text" display="block">
                                Notes: <b>{order?.notes || "-"}</b>
                              </MDTypography>
                            </MDBox>
                          </Card>
                        </Grid>
                      </Grid>
                    </MDBox>
                  </>
                ) : <MDBox minHeight="10rem" />}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <Dialog open={Boolean(confirmAction)} onClose={() => setConfirmAction("")} maxWidth="xs" fullWidth>
        <DialogTitle>
          {confirmAction === "accept" ? "Accept Order" : "Mark Ready For Pickup"}
        </DialogTitle>
        <DialogContent>
          <MDTypography variant="button" color="text">
            {confirmAction === "accept"
              ? "Are you sure you want to accept this order?"
              : "Are you sure this produce is ready for pickup?"}
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="dark" onClick={() => setConfirmAction("")}>
            Cancel
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={confirmAction === "accept" ? doAccept : doMarkReady}
            disabled={submitting}
          >
            {submitting ? "Processing..." : "Confirm"}
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default OrderDetails;
