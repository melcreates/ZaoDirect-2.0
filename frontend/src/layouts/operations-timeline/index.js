import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";
import { toStatusLabel } from "utils/statusLabel";

function OperationsTimeline() {
  const [procurements, setProcurements] = useState([]);
  const [batchItems, setBatchItems] = useState([]);
  const [batches, setBatches] = useState([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [form, setForm] = useState({
    actualPickedQuantity: "",
    rejectedQuantity: "",
    pickupLocation: "",
  });

  const uniformFieldSx = {
    "& .MuiInputBase-root": { minHeight: "56px" },
  };

  const load = async () => {
    const [p, bi, b] = await Promise.all([
      HttpService.get("/api/ops/farmer-purchase-orders"),
      HttpService.get("/api/ops/batch-items"),
      HttpService.get("/api/ops/batches"),
    ]);
    setProcurements(Array.isArray(p) ? p : []);
    setBatchItems(Array.isArray(bi) ? bi : []);
    setBatches(Array.isArray(b) ? b : []);
  };

  useEffect(() => {
    let mounted = true;
    async function initialLoad() {
      try {
        await load();
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load pickup execution.");
      }
    }
    initialLoad();
    return () => {
      mounted = false;
    };
  }, []);

  const rowModels = useMemo(() => {
    const batchById = new Map(batches.map((b) => [b.id, b]));
    const itemByProcurement = new Map();
    batchItems.forEach((item) => {
      if (!itemByProcurement.has(item.farmer_purchase_order_id)) {
        itemByProcurement.set(item.farmer_purchase_order_id, item);
      }
    });

    return procurements
      .filter((p) => ["ALLOCATED", "READY_FOR_PICKUP", "PICKED_UP"].includes(String(p.status || "")))
      .map((p) => {
        const item = itemByProcurement.get(p.id);
        const batch = item ? batchById.get(item.batch_id) : null;
        return {
          procurement: p,
          batchItem: item || null,
          batch: batch || null,
        };
      });
  }, [procurements, batchItems, batches]);

  const stats = useMemo(() => {
    const allocated = rowModels.filter((r) => r.procurement.status === "ALLOCATED").length;
    const ready = rowModels.filter((r) => r.procurement.status === "READY_FOR_PICKUP").length;
    const picked = rowModels.filter((r) => r.procurement.status === "PICKED_UP").length;
    const qaPassed = rowModels.filter((r) => r.batch?.status === "QA_PASSED").length;
    return { allocated, ready, picked, qaPassed };
  }, [rowModels]);

  const openDialog = (rowModel) => {
    setDialogError("");
    setSelectedRow(rowModel);
    setForm({
      actualPickedQuantity:
        rowModel.procurement.actual_picked_quantity ?? rowModel.batchItem?.accepted_quantity ?? "",
      rejectedQuantity: rowModel.batchItem?.rejected_quantity ?? 0,
      pickupLocation: rowModel.procurement.pickup_location || "",
    });
    setDialogOpen(true);
  };

  const submitExecution = async (dispatchAfter = false) => {
    if (!selectedRow?.procurement) return;
    setSaving(true);
    setDialogError("");
    try {
      const actualPicked = Number(form.actualPickedQuantity || 0);
      const rejected = Number(form.rejectedQuantity || 0);
      const accepted = Math.max(actualPicked - rejected, 0);

      await HttpService.patch(`/api/ops/farmer-purchase-orders/${selectedRow.procurement.id}`, {
        actualPickedQuantity: actualPicked,
        pickupLocation: form.pickupLocation || undefined,
        status: "PICKED_UP",
      });

      if (selectedRow.batchItem?.id) {
        await HttpService.patch(`/api/ops/batch-items/${selectedRow.batchItem.id}`, {
          actualPickedQuantity: actualPicked,
          acceptedQuantity: accepted,
          rejectedQuantity: rejected,
        });
      }

      if (selectedRow.batch?.id) {
        const status = selectedRow.batch.status;
        if (status === "CREATED" || status === "COLLECTING") {
          await HttpService.patch(`/api/ops/batches/${selectedRow.batch.id}/status`, { status: "QA_PASSED" });
        }
        if (dispatchAfter) {
          const refreshedBatch = (await HttpService.get("/api/ops/batches")).find((b) => b.id === selectedRow.batch.id);
          const canDispatchStatus = refreshedBatch?.status || status;
          if (canDispatchStatus === "QA_PASSED") {
            await HttpService.patch(`/api/ops/batches/${selectedRow.batch.id}/status`, { status: "DISPATCHED" });
          }
        }
      }

      setDialogOpen(false);
      setSelectedRow(null);
      await load();
    } catch (e) {
      setDialogError(e?.message || "Failed to save pickup execution.");
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "farmer", accessor: "farmer", align: "left" },
      { Header: "buyer", accessor: "buyer", align: "left" },
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "batch", accessor: "batch", align: "left" },
      { Header: "allocated kg", accessor: "allocated", align: "left" },
      { Header: "actual picked", accessor: "picked", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];

    const rows = rowModels.map((r) => ({
      farmer: r.procurement.farmer_name || "-",
      buyer: r.procurement.buyer_name || "-",
      crop: r.procurement.crop_type || "-",
      batch: r.batch?.batch_code || "-",
      allocated: `${Number(r.batchItem?.accepted_quantity || 0)} ${r.procurement.unit || "kg"}`,
      picked: r.procurement.actual_picked_quantity
        ? `${Number(r.procurement.actual_picked_quantity)} ${r.procurement.unit || "kg"}`
        : "-",
      status: toStatusLabel(r.procurement.status),
      action: (
        <MDButton variant="text" color="info" size="small" onClick={() => openDialog(r)}>
          Execute Pickup
        </MDButton>
      ),
    }));
    return { columns, rows };
  }, [rowModels]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDTypography variant="h4" fontWeight="bold">Pickup Execution</MDTypography>
        <MDTypography variant="button" color="text">
          Record actual pickup, QA rejection, and dispatch progression in one flow.
        </MDTypography>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}

        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="info"
                icon="assignment_turned_in"
                title="Allocated"
                count={stats.allocated}
                percentage={{ color: "info", amount: "", label: "Awaiting farmer ready flag" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="warning"
                icon="local_shipping"
                title="Ready For Pickup"
                count={stats.ready}
                percentage={{ color: "warning", amount: "", label: "Can be executed now" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="primary"
                icon="inventory_2"
                title="Picked Up"
                count={stats.picked}
                percentage={{ color: "primary", amount: "", label: "Captured with actual weights" }}
              />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard
                color="success"
                icon="verified"
                title="QA Passed Batches"
                count={stats.qaPassed}
                percentage={{ color: "success", amount: "", label: "Ready for dispatch step" }}
              />
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">Pickup Queue</MDTypography>
            </MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Execute Pickup</DialogTitle>
        <DialogContent>
          <MDBox mt={1} display="flex" flexDirection="column" gap={2}>
            <TextField
              fullWidth
              type="number"
              label="Actual Picked Quantity (kg)"
              value={form.actualPickedQuantity}
              onChange={(e) => setForm((prev) => ({ ...prev, actualPickedQuantity: e.target.value }))}
              sx={uniformFieldSx}
            />
            <TextField
              fullWidth
              type="number"
              label="Rejected Quantity (QA)"
              value={form.rejectedQuantity}
              onChange={(e) => setForm((prev) => ({ ...prev, rejectedQuantity: e.target.value }))}
              sx={uniformFieldSx}
            />
            <TextField
              fullWidth
              label="Pickup Location"
              value={form.pickupLocation}
              onChange={(e) => setForm((prev) => ({ ...prev, pickupLocation: e.target.value }))}
              sx={uniformFieldSx}
            />
            {dialogError && (
              <MDTypography color="error" variant="caption">
                {dialogError}
              </MDTypography>
            )}
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>
            Cancel
          </MDButton>
          <MDButton
            variant="outlined"
            color="info"
            disabled={saving || Number(form.actualPickedQuantity || 0) <= 0}
            onClick={() => submitExecution(false)}
          >
            Save Pickup
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            disabled={saving || Number(form.actualPickedQuantity || 0) <= 0}
            onClick={() => submitExecution(true)}
          >
            Save + Dispatch
          </MDButton>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default OperationsTimeline;

