import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// @mui material components
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";

// Material Dashboard 3 PRO React examples
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import HttpService from "services/http.service";
import AuthService from "services/auth-service";
import zaodirectLogo from "assets/images/ZaoDirectLogo.svg";

// Order list components
import CustomerCell from "layouts/ecommerce/orders/order-list/components/CustomerCell";
import DefaultCell from "layouts/ecommerce/orders/order-list/components/DefaultCell";
import StatusCell from "layouts/ecommerce/orders/order-list/components/StatusCell";
import IdCell from "layouts/ecommerce/orders/order-list/components/IdCell";

function formatStatus(value) {
  return String(value || "-")
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function getStatusVisual(rawStatus) {
  const status = String(rawStatus || "").toUpperCase();

  if (["SETTLED", "DELIVERED"].includes(status)) {
    return { color: "success", icon: "check", label: formatStatus(status) };
  }

  if (["READY_FOR_PICKUP", "ALLOCATED", "CONFIRMED", "COLLECTING"].includes(status)) {
    return { color: "info", icon: "local_shipping", label: formatStatus(status) };
  }

  if (["OPEN", "DRAFT", "PENDING"].includes(status)) {
    return { color: "warning", icon: "schedule", label: formatStatus(status) };
  }

  return { color: "dark", icon: "inventory_2", label: formatStatus(status) };
}

function OrderList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const me = await AuthService.getProfile();
        const role = String(me?.role || "").toUpperCase();

        const data =
          role === "ADMIN"
            ? await HttpService.get("/ops/farmer-purchase-orders")
            : await HttpService.get("/ops/farmer-purchase-orders/mine");

        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e?.message || "Unable to load orders.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const tableData = useMemo(() => {
    const clickable = (node, id) => (
      <MDBox
        onClick={() => navigate(`/ecommerce/orders/order-details?id=${encodeURIComponent(id)}`)}
        sx={{ cursor: "pointer" }}
      >
        {node}
      </MDBox>
    );

    return {
      columns: [
        { Header: "order", accessor: "order", width: "14%" },
        { Header: "customer", accessor: "customer", width: "18%" },
        { Header: "crop", accessor: "crop", width: "16%" },
        { Header: "quantity", accessor: "quantity", align: "center", width: "10%" },
        { Header: "allocated", accessor: "allocated", align: "center", width: "10%" },
        { Header: "shipped", accessor: "shipped", align: "center", width: "10%" },
        { Header: "price", accessor: "price", align: "center", width: "10%" },
        { Header: "shipment", accessor: "shipment", align: "center", width: "10%" },
        { Header: "payment", accessor: "payment", align: "center", width: "10%" },
        { Header: "pickup date", accessor: "pickupDate", align: "center", width: "6%" },
        { Header: "status", accessor: "status", align: "center", width: "10%" },
      ],
      rows: rows.map((order) => {
        const orderId = order?.id || order?.order_id || "-";
        const crop = order?.crop_type || order?.listing_title || order?.category || "Produce";
        const qty = Number(order?.quantity || order?.requested_quantity || 0);
        const unit = order?.unit || "kg";
        const currency = order?.currency || "KES";
        const pricePerUnit = Number(order?.farm_gate_price || order?.price_per_unit || 0);
        const pickupDate = order?.requested_pickup_date || order?.pickup_date || order?.created_at;
        const visual = getStatusVisual(order?.status);
        const allocatedWeight = Number(order?.allocated_weight || order?.accepted_quantity || 0);
        const shippedWeight = Number(order?.shipped_weight || 0);
        const shipmentProgress = formatStatus(order?.shipment_progress || "NOT_SHIPPED");
        const paymentStatus = formatStatus(order?.payment_status || "UNPAID");

        return {
          order: clickable(<IdCell id={String(orderId).slice(0, 12)} checked={false} />, orderId),
          customer: clickable(
            <CustomerCell name="ZaoDirect" image={zaodirectLogo} color="info" />,
            orderId
          ),
          crop: clickable(<DefaultCell value={String(crop)} />, orderId),
          quantity: clickable(<DefaultCell value={`${qty.toLocaleString()} ${unit}`} />, orderId),
          allocated: clickable(<DefaultCell value={`${allocatedWeight.toLocaleString()} ${unit}`} />, orderId),
          shipped: clickable(<DefaultCell value={`${shippedWeight.toLocaleString()} ${unit}`} />, orderId),
          price: clickable(
            <DefaultCell value={`${currency} ${pricePerUnit.toLocaleString()}`} suffix="/unit" />,
            orderId
          ),
          shipment: clickable(<DefaultCell value={shipmentProgress} />, orderId),
          payment: clickable(<DefaultCell value={paymentStatus} />, orderId),
          pickupDate: clickable(
            <DefaultCell
              value={pickupDate ? new Date(pickupDate).toLocaleDateString() : "-"}
            />,
            orderId
          ),
          status: clickable(
            <StatusCell icon={visual.icon} color={visual.color} status={visual.label} />,
            orderId
          ),
        };
      }),
    };
  }, [navigate, rows]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox my={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <MDTypography variant="h5" fontWeight="medium">
            Orders List
          </MDTypography>
          <MDButton variant="outlined" color="dark" onClick={() => window.location.reload()}>
            Refresh
          </MDButton>
        </MDBox>

        {error && (
          <MDAlert color="error" sx={{ mb: 2 }}>
            <MDTypography variant="button" color="white">
              {error}
            </MDTypography>
          </MDAlert>
        )}

        <Card>
          <MDBox p={2}>
            <Grid container>
              <Grid item xs={12}>
                <DataTable
                  table={tableData}
                  entriesPerPage={false}
                  canSearch
                  showTotalEntries={false}
                  isSorted={false}
                  noEndBorder
                />
              </Grid>
            </Grid>
            {loading && (
              <MDBox px={2} pb={1}>
                <MDTypography variant="button" color="text">
                  Loading orders...
                </MDTypography>
              </MDBox>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default OrderList;
