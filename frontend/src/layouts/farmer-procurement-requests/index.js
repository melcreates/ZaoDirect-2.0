import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

function FarmerProcurementRequests() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const loadRows = async () => {
    const data = await HttpService.get("/api/ops/farmer-purchase-orders/mine");
    setRows(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await HttpService.get("/api/ops/farmer-purchase-orders/mine");
        if (!mounted) return;
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load your procurement requests.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const openDialog = (row) => {
    setSelectedOrder(row);
    setDialogOpen(true);
  };

  const submitStatus = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setError("");
    try {
      const nextStatus = selectedOrder.status === "OPEN" ? "CONFIRMED" : "READY_FOR_PICKUP";
      await HttpService.patch(`/api/ops/farmer-purchase-orders/${selectedOrder.id}/farmer-status`, {
        status: nextStatus,
      });
      setDialogOpen(false);
      setSelectedOrder(null);
      await loadRows();
    } catch (e) {
      setError(e?.message || "Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "order weight", accessor: "qty", align: "left" },
      { Header: "allocated weight", accessor: "allocatedWeight", align: "left" },
      { Header: "shipped weight", accessor: "shippedWeight", align: "left" },
      { Header: "shipment", accessor: "shipment", align: "left" },
      { Header: "payment", accessor: "payment", align: "left" },
      { Header: "price", accessor: "price", align: "left" },
      { Header: "pickup date", accessor: "pickupDate", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    const tableRows = rows.map((r) => ({
      crop: r.crop_type,
      qty: `${r.quantity} ${r.unit}`,
      allocatedWeight: `${Number(r.allocated_weight || 0)} ${r.unit}`,
      shippedWeight: `${Number(r.shipped_weight || 0)} ${r.unit}`,
      shipment: toStatusLabel(r.shipment_progress || "NOT_SHIPPED"),
      payment: toStatusLabel(r.payment_status || "UNPAID"),
      price: `${r.currency} ${r.farm_gate_price}`,
      pickupDate: r.pickup_date ? new Date(r.pickup_date).toLocaleDateString() : "-",
      status: toStatusLabel(r.status),
      action: (
        <MDButton
          size="small"
          variant="text"
          color="info"
          disabled={!["OPEN", "ALLOCATED"].includes(r.status)}
          onClick={() => openDialog(r)}
        >
          {r.status === "OPEN" ? "Confirm" : r.status === "ALLOCATED" ? "Mark Ready" : "View"}
        </MDButton>
      ),
    }));
    return { columns, rows: tableRows };
  }, [rows]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDTypography variant="h4" fontWeight="bold">My Procurement Requests</MDTypography>
        <MDTypography variant="button" color="text">
          Confirm open orders, then once allocated mark produce ready for pickup by Consynair.
        </MDTypography>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        <MDBox mt={3}>
          <Card>
            <MDBox p={3}><MDTypography variant="h6">Requests</MDTypography></MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>
          {selectedOrder?.status === "OPEN" ? "Confirm Order" : "Mark Ready For Pickup"}
        </DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <MDTypography variant="button" color="text">
              {selectedOrder?.status === "OPEN"
                ? "Are you sure you want to confirm this order?"
                : "Are you sure this produce is ready for pickup?"}
            </MDTypography>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>
            Cancel
          </MDButton>
          <MDButton variant="gradient" color="info" onClick={submitStatus} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </MDButton>
        </DialogActions>
      </Dialog>
      <Footer />
    </DashboardLayout>
  );
}

export default FarmerProcurementRequests;
