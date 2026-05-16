import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Alert from "@mui/material/Alert";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/http.service";
import { toStatusLabel } from "utils/statusLabel";

function FarmerProcurement() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [batches, setBatches] = useState([]);
  const [batchItems, setBatchItems] = useState([]);
  const [error, setError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [success, setSuccess] = useState("");
  const [dialogSuccess, setDialogSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [batchId, setBatchId] = useState("");
  const [allocationForm, setAllocationForm] = useState({
    allocatedQuantity: "",
  });
  const [createBatchForm, setCreateBatchForm] = useState({
    batchCode: "",
    totalQuantity: "",
    targetGrade: "",
    destinationCountry: "",
  });

  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  const loadRows = async () => {
    const data = await HttpService.get("/ops/farmer-purchase-orders");
    setRows(Array.isArray(data) ? data : []);
  };

  const loadBatchData = async () => {
    const [batchData, itemData] = await Promise.all([
      HttpService.get("/ops/batches"),
      HttpService.get("/ops/batch-items"),
    ]);
    setBatches(Array.isArray(batchData) ? batchData : []);
    setBatchItems(Array.isArray(itemData) ? itemData : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [data, batchData, itemData] = await Promise.all([
          HttpService.get("/ops/farmer-purchase-orders"),
          HttpService.get("/ops/batches"),
          HttpService.get("/ops/batch-items"),
        ]);
        if (!mounted) return;
        setRows(Array.isArray(data) ? data : []);
        setBatches(Array.isArray(batchData) ? batchData : []);
        setBatchItems(Array.isArray(itemData) ? itemData : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load procurement orders.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const openUpdateDialog = (row) => {
    setDialogError("");
    setDialogSuccess("");
    setSelectedOrder(row);
    setBatchId("");
    const alreadyAllocated = batchItems
      .filter((item) => item.farmer_purchase_order_id === row.id)
      .reduce((sum, item) => sum + Number(item.accepted_quantity || 0), 0);
    setAllocationForm({
      allocatedQuantity: Math.max(Number(row.quantity || 0) - alreadyAllocated, 0),
    });
    setDialogOpen(true);
  };

  const allocationCandidates = useMemo(() => {
    if (!selectedOrder) return [];
    const usedByBatch = new Map();
    batchItems.forEach((item) => {
      const current = Number(usedByBatch.get(item.batch_id) || 0);
      const usedQty =
        item.actual_picked_quantity === null || item.actual_picked_quantity === undefined
          ? Number(item.accepted_quantity || 0)
          : Number(item.actual_picked_quantity || 0);
      usedByBatch.set(item.batch_id, current + usedQty);
    });

    return batches
      .filter((b) => b.international_order_id === selectedOrder.international_order_id)
      .filter((b) => ["CREATED", "COLLECTING", "QA_PASSED"].includes(b.status))
      .map((b) => {
        const used = Number(usedByBatch.get(b.id) || 0);
        const capacity = Number(b.total_quantity || 0);
        const remaining = capacity > 0 ? Math.max(capacity - used, 0) : 0;
        return { ...b, used, remaining };
      })
      .filter((b) => (b.total_quantity ? b.remaining > 0 : true));
  }, [batches, batchItems, selectedOrder]);

  const remainingForSelectedOrder = useMemo(() => {
    if (!selectedOrder) return 0;
    const alreadyAllocated = batchItems
      .filter((item) => item.farmer_purchase_order_id === selectedOrder.id)
      .reduce((sum, item) => sum + Number(item.accepted_quantity || 0), 0);
    return Math.max(Number(selectedOrder.quantity || 0) - alreadyAllocated, 0);
  }, [batchItems, selectedOrder]);

  const allocateToBatch = async () => {
    if (!selectedOrder || !batchId) return;
    setSaving(true);
    setDialogError("");
    setDialogSuccess("");
    try {
      await HttpService.post("/ops/batch-items", {
        batchId,
        farmerPurchaseOrderId: selectedOrder.id,
        acceptedQuantity: Number(allocationForm.allocatedQuantity || 0),
        rejectedQuantity: 0,
      });
      setDialogOpen(false);
      setSelectedOrder(null);
      setSuccess("Order allocated successfully. Redirecting to the selected batch.");
      navigate(`/batch-quality?batchId=${encodeURIComponent(batchId)}`);
    } catch (e) {
      setDialogError(e?.message || "Failed to allocate order to batch.");
    } finally {
      setSaving(false);
    }
  };

  const createBatchAndAllocate = async () => {
    if (!selectedOrder) return;
    setSaving(true);
    setDialogError("");
    setDialogSuccess("");
    try {
      const created = await HttpService.post("/ops/batches", {
        internationalOrderId: selectedOrder.international_order_id,
        batchCode: createBatchForm.batchCode.trim(),
        cropType: selectedOrder.crop_type,
        targetGrade: createBatchForm.targetGrade.trim() || undefined,
        destinationCountry: createBatchForm.destinationCountry.trim() || undefined,
        totalQuantity: Number(createBatchForm.totalQuantity || selectedOrder.quantity || 0),
        unit: selectedOrder.unit,
        status: "CREATED",
      });
      await HttpService.post("/ops/batch-items", {
        batchId: created.id,
        farmerPurchaseOrderId: selectedOrder.id,
        acceptedQuantity: Number(allocationForm.allocatedQuantity || 0),
        rejectedQuantity: 0,
      });
      setCreateBatchOpen(false);
      setCreateBatchForm({
        batchCode: "",
        totalQuantity: "",
        targetGrade: "",
        destinationCountry: "",
      });
      setDialogOpen(false);
      setSelectedOrder(null);
      setSuccess("Batch created and allocation saved. Redirecting to batch operations.");
      navigate(`/batch-quality?batchId=${encodeURIComponent(created.id)}`);
    } catch (e) {
      setDialogError(e?.message || "Failed to create batch and allocate.");
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "farmer", accessor: "farmer", align: "left" },
      { Header: "buyer order", accessor: "buyerOrder", align: "left" },
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "order weight", accessor: "qty", align: "left" },
      { Header: "actual picked", accessor: "actualPicked", align: "left" },
      { Header: "farm-gate", accessor: "price", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    return {
      columns,
      rows: rows.map((r) => ({
        farmer: r.farmer_name,
        buyerOrder: r.buyer_name,
        crop: r.crop_type,
        qty: `${r.quantity} ${r.unit}`,
        actualPicked: r.actual_picked_quantity ? `${r.actual_picked_quantity} ${r.unit}` : "-",
        price: `${r.currency} ${r.farm_gate_price}`,
        status: toStatusLabel(r.status),
        action: (
          <MDButton variant="text" color="info" size="small" onClick={() => openUpdateDialog(r)}>
            Open
          </MDButton>
        ),
      })),
    };
  }, [rows]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDTypography variant="h4" fontWeight="bold">Farmer Procurement</MDTypography>
          <MDButton component={Link} to="/farmer-procurement/new" variant="gradient" color="info">
            Create Order
          </MDButton>
        </MDBox>
        <MDTypography variant="button" color="text">
          Confirmed farmer orders are allocated to batches from here.
        </MDTypography>
        {error && (
          <MDBox mt={1}>
            <Alert severity="error">{error}</Alert>
          </MDBox>
        )}
        {success && (
          <MDBox mt={1}>
            <Alert severity="success" onClose={() => setSuccess("")}>
              {success}
            </Alert>
          </MDBox>
        )}
        <MDBox mt={3}>
          <Card>
            <MDBox p={3}><MDTypography variant="h6">Procurement Orders</MDTypography></MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Allocate Procurement Order</DialogTitle>
      <DialogContent>
        <MDBox mt={1} display="flex" flexDirection="column" gap={2}>
            {["CONFIRMED", "ALLOCATED"].includes(selectedOrder?.status) ? (
              <>
                <MDTypography variant="button" fontWeight="medium" color="text">
                  Allocate To Batch
                </MDTypography>
                <TextField
                  fullWidth
                  select
                  label="Batch"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  sx={uniformFieldSx}
                >
                  {allocationCandidates.map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                      {`${b.batch_code} - remaining ${b.remaining} ${b.unit}`}
                    </MenuItem>
                  ))}
                </TextField>
                <MDTypography variant="caption" color="text">
                  Remaining to allocate: {remainingForSelectedOrder} {selectedOrder?.unit || "kg"}
                </MDTypography>
                <TextField
                  fullWidth
                  type="number"
                  label="Allocate Quantity"
                  value={allocationForm.allocatedQuantity}
                  onChange={(e) =>
                    setAllocationForm((prev) => ({ ...prev, allocatedQuantity: e.target.value }))
                  }
                  sx={uniformFieldSx}
                />
                <MDBox display="flex" justifyContent="space-between" gap={1}>
                  <MDButton variant="outlined" color="info" onClick={() => setCreateBatchOpen(true)}>
                    Create Batch
                  </MDButton>
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={allocateToBatch}
                    disabled={
                      saving ||
                      !batchId ||
                      Number(allocationForm.allocatedQuantity || 0) <= 0 ||
                      Number(allocationForm.allocatedQuantity || 0) > remainingForSelectedOrder
                    }
                  >
                    Allocate Order
                  </MDButton>
                </MDBox>
                {dialogError && (
                  <MDBox mt={1}>
                    <MDTypography color="error" variant="caption">
                      {dialogError}
                    </MDTypography>
                  </MDBox>
                )}
              </>
            ) : (
              <MDTypography variant="button" color="text">
                Only confirmed or allocated orders can be allocated to a batch.
              </MDTypography>
            )}
            {dialogError && !["CONFIRMED", "ALLOCATED"].includes(selectedOrder?.status) && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {dialogError}
              </Alert>
            )}
            {dialogSuccess && (
              <Alert severity="success" sx={{ mt: 1 }}>
                {dialogSuccess}
              </Alert>
            )}
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={createBatchOpen} onClose={() => setCreateBatchOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Batch For Allocation</DialogTitle>
        <DialogContent>
          <MDBox mt={1} display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Batch Code"
              value={createBatchForm.batchCode}
              onChange={(e) => setCreateBatchForm((p) => ({ ...p, batchCode: e.target.value }))}
              fullWidth
              sx={uniformFieldSx}
            />
            <TextField
              type="number"
              label="Batch Capacity (kg)"
              value={createBatchForm.totalQuantity}
              onChange={(e) => setCreateBatchForm((p) => ({ ...p, totalQuantity: e.target.value }))}
              fullWidth
              sx={uniformFieldSx}
            />
            <TextField
              label="Target Grade"
              value={createBatchForm.targetGrade}
              onChange={(e) => setCreateBatchForm((p) => ({ ...p, targetGrade: e.target.value }))}
              fullWidth
              sx={uniformFieldSx}
            />
            <TextField
              label="Destination Country"
              value={createBatchForm.destinationCountry}
              onChange={(e) => setCreateBatchForm((p) => ({ ...p, destinationCountry: e.target.value }))}
              fullWidth
              sx={uniformFieldSx}
            />
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setCreateBatchOpen(false)}>
            Cancel
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={createBatchAndAllocate}
            disabled={saving || !createBatchForm.batchCode.trim()}
          >
            Create & Allocate
          </MDButton>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default FarmerProcurement;

