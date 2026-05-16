import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function BatchQuality() {
  const [searchParams] = useSearchParams();
  const [batches, setBatches] = useState([]);
  const [batchItems, setBatchItems] = useState([]);
  const [shipmentLots, setShipmentLots] = useState([]);
  const [qualityChecks, setQualityChecks] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [autoOpenedBatchId, setAutoOpenedBatchId] = useState("");
  const [batchStatus, setBatchStatus] = useState("CREATED");
  const [qualityForm, setQualityForm] = useState({
    stage: "AGGREGATION",
    moistureLevel: "",
    pesticidePassed: "true",
    sizeGrade: "",
    batchItemId: "",
    hasRejection: "false",
    rejectedQuantity: "",
    gradeResult: "",
    notes: "",
    photoUrl: "",
  });
  const [lotForm, setLotForm] = useState({
    quantity: "",
    flightNumber: "",
    awbNumber: "",
    eta: "",
    notes: "",
  });
  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };
  const loadBatches = async () => {
    const data = await HttpService.get("/ops/batches");
    setBatches(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const batchData = await HttpService.get("/ops/batches");
        if (!mounted) return;
        setBatches(Array.isArray(batchData) ? batchData : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load batches.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const queryBatchId = searchParams.get("batchId");
    if (!queryBatchId || !batches.length || autoOpenedBatchId === queryBatchId) return;
    const targetBatch = batches.find((batch) => String(batch.id) === String(queryBatchId));
    if (!targetBatch) return;
    openBatch(targetBatch);
    setAutoOpenedBatchId(queryBatchId);
  }, [searchParams, batches, autoOpenedBatchId]);

  const openBatch = async (batch) => {
    try {
      setError("");
      setSuccess("");
      setSelectedBatch(batch);
      setBatchStatus(batch.status || "CREATED");
      setDialogOpen(true);
      const [items, checks, lots] = await Promise.all([
        HttpService.get(`/api/ops/batch-items?batchId=${batch.id}`),
        HttpService.get(`/api/ops/quality-checks?batchId=${batch.id}`),
        HttpService.get(`/api/ops/batch-shipment-lots?batchId=${batch.id}`),
      ]);
      setBatchItems(Array.isArray(items) ? items : []);
      setQualityChecks(Array.isArray(checks) ? checks : []);
      setShipmentLots(Array.isArray(lots) ? lots : []);
    } catch (e) {
      setError(e?.message || "Failed to open batch details.");
    }
  };

  const dispatchBatch = async () => {
    if (!selectedBatch) return;
    setStatusSaving(true);
    setError("");
    setSuccess("");
    try {
      const acceptedTotal = batchItems.reduce((sum, item) => sum + Number(item.accepted_quantity || 0), 0);
      const target = Number(selectedBatch.total_quantity || 0);
      if (target > 0 && acceptedTotal < target) {
        setError(`Cannot dispatch yet. Batch is ${acceptedTotal}/${target} ${selectedBatch.unit || "kg"}.`);
        return;
      }
      if (batchStatus !== "QA_PASSED") {
        await HttpService.patch(`/api/ops/batches/${selectedBatch.id}/status`, { status: "QA_PASSED" });
      }
      await HttpService.patch(`/api/ops/batches/${selectedBatch.id}/status`, { status: "DISPATCHED" });
      await loadBatches();
      setBatchStatus("DISPATCHED");
      setSelectedBatch((prev) => (prev ? { ...prev, status: "DISPATCHED" } : prev));
      setSuccess("Batch dispatched successfully. Linked payouts and shipment timeline were updated.");
    } catch (e) {
      setError(e?.message || "Failed to dispatch batch.");
    } finally {
      setStatusSaving(false);
    }
  };

  const markBatchShipped = async () => {
    if (!selectedBatch) return;
    setStatusSaving(true);
    setError("");
    setSuccess("");
    try {
      await HttpService.patch(`/api/ops/batches/${selectedBatch.id}/status`, { status: "SHIPPED" });
      await loadBatches();
      setBatchStatus("SHIPPED");
      setSelectedBatch((prev) => (prev ? { ...prev, status: "SHIPPED" } : prev));
      setSuccess("Batch marked as shipped. International order fulfillment has been synced.");
    } catch (e) {
      setError(e?.message || "Failed to mark batch as shipped.");
    } finally {
      setStatusSaving(false);
    }
  };

  const markBatchDelivered = async () => {
    if (!selectedBatch) return;
    setStatusSaving(true);
    setError("");
    setSuccess("");
    try {
      await HttpService.patch(`/api/ops/batches/${selectedBatch.id}/status`, { status: "DELIVERED" });
      await loadBatches();
      setBatchStatus("DELIVERED");
      setSelectedBatch((prev) => (prev ? { ...prev, status: "DELIVERED" } : prev));
      setSuccess("Batch marked as delivered. Shipment timeline and order fulfillment are now synced.");
    } catch (e) {
      setError(e?.message || "Failed to mark batch as delivered.");
    } finally {
      setStatusSaving(false);
    }
  };

  const submitQuality = async () => {
    if (!selectedBatch) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await HttpService.post("/ops/quality-checks", {
        batchId: selectedBatch.id,
        stage: qualityForm.stage,
        moistureLevel: qualityForm.moistureLevel ? Number(qualityForm.moistureLevel) : undefined,
        pesticidePassed: qualityForm.pesticidePassed === "true",
        sizeGrade: qualityForm.sizeGrade || undefined,
        notes: qualityForm.notes || undefined,
        photoUrl: qualityForm.photoUrl || undefined,
      });
      if (qualityForm.batchItemId) {
        const selectedAllocation = batchItems.find((bi) => bi.id === qualityForm.batchItemId);
        const currentAccepted = Number(selectedAllocation?.accepted_quantity || 0);
        const rejectedQty =
          qualityForm.hasRejection === "true" ? Number(qualityForm.rejectedQuantity || 0) : 0;
        const adjustedAccepted = Math.max(currentAccepted - rejectedQty, 0);
        await HttpService.patch(`/api/ops/batch-items/${qualityForm.batchItemId}`, {
          actualPickedQuantity: adjustedAccepted,
          rejectedQuantity: rejectedQty,
          acceptedQuantity: adjustedAccepted,
          gradeResult: qualityForm.gradeResult || undefined,
        });
        if (selectedAllocation?.farmer_purchase_order_id) {
          await HttpService.patch(`/api/ops/farmer-purchase-orders/${selectedAllocation.farmer_purchase_order_id}`, {
            actualPickedQuantity: adjustedAccepted,
            status: "PICKED_UP",
          });
        }
      }
      const checks = await HttpService.get(`/api/ops/quality-checks?batchId=${selectedBatch.id}`);
      const items = await HttpService.get(`/api/ops/batch-items?batchId=${selectedBatch.id}`);
      setQualityChecks(Array.isArray(checks) ? checks : []);
      setBatchItems(Array.isArray(items) ? items : []);

      const refreshedItems = Array.isArray(items) ? items : [];
      const refreshedAcceptedTotal = refreshedItems.reduce(
        (sum, item) => sum + Number(item.accepted_quantity || 0),
        0
      );
      const targetQty = Number(selectedBatch?.total_quantity || 0);
      if (targetQty > 0 && refreshedAcceptedTotal >= targetQty && batchStatus === "COLLECTING") {
        await HttpService.patch(`/api/ops/batches/${selectedBatch.id}/status`, { status: "QA_PASSED" });
        setBatchStatus("QA_PASSED");
        setSelectedBatch((prev) => (prev ? { ...prev, status: "QA_PASSED" } : prev));
      }

      setQualityForm({
        stage: "AGGREGATION",
        moistureLevel: "",
        pesticidePassed: "true",
        sizeGrade: "",
        batchItemId: "",
        hasRejection: "false",
        rejectedQuantity: "",
        gradeResult: "",
        notes: "",
        photoUrl: "",
      });
      setSuccess("QA check saved successfully.");
    } catch (e) {
      setError(e?.message || "Failed to add quality check.");
    } finally {
      setSaving(false);
    }
  };

  const onSelectQaPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const dataUrl = await fileToDataUrl(file);
      setQualityForm((p) => ({ ...p, photoUrl: dataUrl }));
    } catch (e) {
      setError(e?.message || "Could not process selected QA photo.");
    } finally {
      event.target.value = "";
    }
  };

  const acceptedTotal = useMemo(
    () => batchItems.reduce((sum, item) => sum + Number(item.accepted_quantity || 0), 0),
    [batchItems]
  );

  const lotsTotal = useMemo(
    () => shipmentLots.reduce((sum, lot) => sum + Number(lot.quantity || 0), 0),
    [shipmentLots]
  );

  const availableForLots = Math.max(acceptedTotal - lotsTotal, 0);
  const normalizedLotQty = Number(String(lotForm.quantity || "").replace(/,/g, "").trim());
  const isValidLotQty = Number.isFinite(normalizedLotQty) && normalizedLotQty > 0;

  const createShipmentLot = async () => {
    if (!selectedBatch) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!isValidLotQty) {
        setError("Enter a valid numeric lot quantity.");
        return;
      }
      await HttpService.post("/ops/batch-shipment-lots", {
        batchId: selectedBatch.id,
        quantity: normalizedLotQty,
        unit: selectedBatch.unit || "kg",
        flightNumber: lotForm.flightNumber || undefined,
        awbNumber: lotForm.awbNumber || undefined,
        eta: lotForm.eta || undefined,
        notes: lotForm.notes || undefined,
      });
      const lots = await HttpService.get(`/api/ops/batch-shipment-lots?batchId=${selectedBatch.id}`);
      setShipmentLots(Array.isArray(lots) ? lots : []);
      setLotForm({
        quantity: "",
        flightNumber: "",
        awbNumber: "",
        eta: "",
        notes: "",
      });
      setSuccess("Shipment lot created successfully.");
    } catch (e) {
      const detailText = Array.isArray(e?.details)
        ? e.details.map((d) => `${d.path?.join(".") || "field"}: ${d.message}`).join(" | ")
        : "";
      setError(detailText ? `${e?.message || "Failed to create shipment lot."} (${detailText})` : (e?.message || "Failed to create shipment lot."));
    } finally {
      setSaving(false);
    }
  };

  const updateLotStatus = async (lotId, status) => {
    if (!selectedBatch) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await HttpService.patch(`/api/ops/batch-shipment-lots/${lotId}/status`, { status });
      const [lots, batchData] = await Promise.all([
        HttpService.get(`/api/ops/batch-shipment-lots?batchId=${selectedBatch.id}`),
        HttpService.get("/ops/batches"),
      ]);
      setShipmentLots(Array.isArray(lots) ? lots : []);
      setBatches(Array.isArray(batchData) ? batchData : []);
      const refreshed = (Array.isArray(batchData) ? batchData : []).find((b) => b.id === selectedBatch.id);
      if (refreshed) {
        setSelectedBatch(refreshed);
        setBatchStatus(refreshed.status || batchStatus);
      }
      setSuccess(`Lot status updated to ${toStatusLabel(status)}.`);
    } catch (e) {
      setError(e?.message || "Failed to update lot status.");
    } finally {
      setSaving(false);
    }
  };

  const table = useMemo(() => {
    const columns = [
      { Header: "batch", accessor: "batch", align: "left" },
      { Header: "buyer", accessor: "buyer", align: "left" },
      { Header: "crop", accessor: "crop", align: "left" },
      { Header: "grade", accessor: "grade", align: "left" },
      { Header: "qty", accessor: "qty", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    return {
      columns,
      rows: batches.map((b) => ({
        batch: b.batch_code,
        buyer: b.buyer_name || "-",
        crop: b.crop_type,
        grade: b.target_grade || "-",
        qty: b.total_quantity ? `${b.total_quantity} ${b.unit}` : "-",
        status: toStatusLabel(b.status),
        action: (
          <MDButton variant="text" color="info" size="small" onClick={() => openBatch(b)}>
            Open
          </MDButton>
        ),
      })),
    };
  }, [batches]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDBox display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <MDTypography variant="h4" fontWeight="bold">Batch & Quality</MDTypography>
          <MDButton component={Link} to="/batch-quality/new" variant="gradient" color="info">
            Create Batch
          </MDButton>
        </MDBox>
        <MDTypography variant="button" color="text">
          Open a batch to capture accepted/rejected quantities and QA checkpoints.
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
            <MDBox p={3}><MDTypography variant="h6">Batch Register</MDTypography></MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{selectedBatch ? `Batch ${selectedBatch.batch_code}` : "Batch"}</DialogTitle>
        <DialogContent>
          <Card sx={{ mb: 2 }}>
            <MDBox p={2}>
              <MDTypography variant="h6">Batch Lifecycle</MDTypography>
              <Grid container spacing={2} mt={0.5}>
                <Grid item xs={12} md={8}>
                  <MDTypography variant="button" color="text">
                    Current Status: <strong>{toStatusLabel(batchStatus)}</strong>
                  </MDTypography>
                </Grid>
              </Grid>
            </MDBox>
          </Card>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Card sx={{ height: "100%" }}>
                <MDBox p={2}>
                  <MDTypography variant="h6">Add QA Check</MDTypography>
                  <TextField fullWidth select label="Stage" value={qualityForm.stage} onChange={(e) => setQualityForm((p) => ({ ...p, stage: e.target.value }))} margin="dense" sx={uniformFieldSx}>
                    <MenuItem value="HARVEST">Harvest</MenuItem>
                    <MenuItem value="AGGREGATION">Aggregation</MenuItem>
                    <MenuItem value="PRE_EXPORT">Pre export</MenuItem>
                    <MenuItem value="DISPATCH">Dispatch</MenuItem>
                  </TextField>
                  <TextField fullWidth type="number" label="Moisture Level" value={qualityForm.moistureLevel} onChange={(e) => setQualityForm((p) => ({ ...p, moistureLevel: e.target.value }))} margin="dense" sx={uniformFieldSx} />
                  <TextField fullWidth select label="Pesticide Passed" value={qualityForm.pesticidePassed} onChange={(e) => setQualityForm((p) => ({ ...p, pesticidePassed: e.target.value }))} margin="dense" sx={uniformFieldSx}>
                    <MenuItem value="true">Yes</MenuItem>
                    <MenuItem value="false">No</MenuItem>
                  </TextField>
                  <TextField fullWidth label="Size Grade" value={qualityForm.sizeGrade} onChange={(e) => setQualityForm((p) => ({ ...p, sizeGrade: e.target.value }))} margin="dense" sx={uniformFieldSx} />
                  <TextField
                    fullWidth
                    select
                    label="Allocated Order"
                    value={qualityForm.batchItemId}
                    onChange={(e) =>
                      setQualityForm((p) => ({
                        ...p,
                        batchItemId: e.target.value,
                        hasRejection: "false",
                        rejectedQuantity: "",
                      }))
                    }
                    margin="dense"
                    sx={uniformFieldSx}
                  >
                    {batchItems.map((bi) => (
                      <MenuItem key={bi.id} value={bi.id}>
                        {`${bi.farmer_name} - accepted ${bi.accepted_quantity}`}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    select
                    label="Any Rejection?"
                    value={qualityForm.hasRejection}
                    onChange={(e) =>
                      setQualityForm((p) => ({
                        ...p,
                        hasRejection: e.target.value,
                        rejectedQuantity: e.target.value === "true" ? p.rejectedQuantity : "",
                      }))
                    }
                    margin="dense"
                    sx={uniformFieldSx}
                  >
                    <MenuItem value="false">No</MenuItem>
                    <MenuItem value="true">Yes</MenuItem>
                  </TextField>
                  <TextField
                    fullWidth
                    type="number"
                    label="Rejected Qty (QA)"
                    value={qualityForm.rejectedQuantity}
                    onChange={(e) => setQualityForm((p) => ({ ...p, rejectedQuantity: e.target.value }))}
                    margin="dense"
                    sx={uniformFieldSx}
                    disabled={qualityForm.hasRejection !== "true"}
                  />
                  <TextField
                    fullWidth
                    label="Grade Result (QA)"
                    value={qualityForm.gradeResult}
                    onChange={(e) => setQualityForm((p) => ({ ...p, gradeResult: e.target.value }))}
                    margin="dense"
                    sx={uniformFieldSx}
                  />
                  <TextField fullWidth label="Photo URL (optional)" value={qualityForm.photoUrl} onChange={(e) => setQualityForm((p) => ({ ...p, photoUrl: e.target.value }))} margin="dense" sx={uniformFieldSx} />
                  <MDBox mt={1} display="flex" alignItems="center" gap={1} flexWrap="wrap">
                    <MDButton component="label" size="small" variant="outlined" color="info">
                      Upload QA Photo
                      <input type="file" accept="image/*" hidden onChange={onSelectQaPhoto} />
                    </MDButton>
                    {qualityForm.photoUrl && (
                      <MDButton
                        size="small"
                        variant="text"
                        color="error"
                        onClick={() => setQualityForm((p) => ({ ...p, photoUrl: "" }))}
                      >
                        Remove Photo
                      </MDButton>
                    )}
                  </MDBox>
                  {qualityForm.photoUrl && (
                    <MDBox mt={1}>
                      <MDBox
                        component="img"
                        src={qualityForm.photoUrl}
                        alt="qa-preview"
                        width="100%"
                        maxWidth="240px"
                        borderRadius="lg"
                      />
                    </MDBox>
                  )}
                  <MDBox mt={1}>
                    <MDButton size="small" variant="gradient" color="info" onClick={submitQuality} disabled={saving}>Add QA Check</MDButton>
                  </MDBox>
                </MDBox>
              </Card>
            </Grid>
          </Grid>

          <MDBox mt={2}>
            <MDTypography variant="h6">Current Allocations</MDTypography>
            {batchItems.length > 0 ? (
              batchItems.map((bi) => (
                <MDTypography key={bi.id} variant="button" display="block" color="text">
                  {bi.farmer_name}: accepted {bi.accepted_quantity}, rejected {bi.rejected_quantity}, grade {bi.grade_result || "-"}
                </MDTypography>
              ))
            ) : (
              <MDTypography variant="button" color="text">No allocations yet.</MDTypography>
            )}
          </MDBox>

          <MDBox mt={2}>
            <Card>
              <MDBox p={2}>
                <MDTypography variant="h6">Shipment Lots (Partial Dispatch)</MDTypography>
                <MDTypography variant="caption" color="text">
                  Accepted: {acceptedTotal} {selectedBatch?.unit || "kg"} | Already in lots: {lotsTotal}{" "}
                  {selectedBatch?.unit || "kg"} | Available: {availableForLots} {selectedBatch?.unit || "kg"}
                </MDTypography>
                <Grid container spacing={2} mt={0.5}>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Quantity (kg)"
                      value={lotForm.quantity}
                      onChange={(e) => setLotForm((p) => ({ ...p, quantity: e.target.value }))}
                      sx={uniformFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="Flight No."
                      value={lotForm.flightNumber}
                      onChange={(e) => setLotForm((p) => ({ ...p, flightNumber: e.target.value }))}
                      sx={uniformFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={2}>
                    <TextField
                      fullWidth
                      label="AWB No."
                      value={lotForm.awbNumber}
                      onChange={(e) => setLotForm((p) => ({ ...p, awbNumber: e.target.value }))}
                      sx={uniformFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      fullWidth
                      type="date"
                      label="ETA"
                      value={lotForm.eta}
                      onChange={(e) => setLotForm((p) => ({ ...p, eta: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      sx={uniformFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Notes"
                      value={lotForm.notes}
                      onChange={(e) => setLotForm((p) => ({ ...p, notes: e.target.value }))}
                      sx={uniformFieldSx}
                    />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      fullWidth
                      sx={{ height: "56px" }}
                      onClick={createShipmentLot}
                      disabled={
                        saving ||
                        !isValidLotQty ||
                        normalizedLotQty > availableForLots
                      }
                    >
                      Create Lot
                    </MDButton>
                  </Grid>
                </Grid>

                <MDBox mt={2}>
                  {shipmentLots.length > 0 ? (
                    shipmentLots.map((lot) => (
                      <MDBox
                        key={lot.id}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        flexWrap="wrap"
                        gap={1}
                        py={1}
                      >
                        <MDTypography variant="button" color="text">
                          {lot.lot_code}: {lot.quantity} {lot.unit} - {toStatusLabel(lot.status)}
                        </MDTypography>
                        <MDBox display="flex" gap={1}>
                          <MDButton
                            size="small"
                            variant="outlined"
                            color="info"
                            onClick={() => updateLotStatus(lot.id, "DISPATCHED")}
                            disabled={saving || lot.status !== "CREATED"}
                          >
                            Dispatch
                          </MDButton>
                          <MDButton
                            size="small"
                            variant="outlined"
                            color="info"
                            onClick={() => updateLotStatus(lot.id, "SHIPPED")}
                            disabled={saving || !["DISPATCHED", "SHIPPED"].includes(lot.status)}
                          >
                            Mark Shipped
                          </MDButton>
                          <MDButton
                            size="small"
                            variant="outlined"
                            color="success"
                            onClick={() => updateLotStatus(lot.id, "DELIVERED")}
                            disabled={saving || !["SHIPPED", "DELIVERED"].includes(lot.status)}
                          >
                            Delivered
                          </MDButton>
                        </MDBox>
                      </MDBox>
                    ))
                  ) : (
                    <MDTypography variant="button" color="text">
                      No shipment lots yet.
                    </MDTypography>
                  )}
                </MDBox>
              </MDBox>
            </Card>
          </MDBox>

          <MDBox mt={2}>
            <MDTypography variant="h6">Quality Checks</MDTypography>
            {qualityChecks.length > 0 ? (
              qualityChecks.map((qc) => (
                <MDTypography key={qc.id} variant="button" display="block" color="text">
                  {toStatusLabel(qc.stage)}: moisture {qc.moisture_level ?? "-"}, pesticide {qc.pesticide_passed === null ? "-" : qc.pesticide_passed ? "Pass" : "Fail"}, size {qc.size_grade || "-"}
                </MDTypography>
              ))
            ) : (
              <MDTypography variant="button" color="text">No quality checks yet.</MDTypography>
            )}
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="info"
            onClick={dispatchBatch}
            disabled={
              statusSaving ||
              !selectedBatch ||
              (Number(selectedBatch?.total_quantity || 0) > 0 &&
                acceptedTotal < Number(selectedBatch?.total_quantity || 0))
            }
          >
            Dispatch Full Batch
          </MDButton>
          <MDButton
            variant="outlined"
            color="dark"
            onClick={markBatchShipped}
            disabled={statusSaving || !selectedBatch || batchStatus !== "DISPATCHED"}
          >
            Mark Batch Shipped
          </MDButton>
          <MDButton
            variant="outlined"
            color="success"
            onClick={markBatchDelivered}
            disabled={statusSaving || !selectedBatch || batchStatus !== "SHIPPED"}
          >
            Mark Batch Delivered
          </MDButton>
          {selectedBatch && (
            <MDButton
              component={Link}
              to={`/batch-quality/${selectedBatch.id}/summary`}
              target="_blank"
              rel="noreferrer"
              variant="outlined"
              color="info"
            >
              Batch Summary
            </MDButton>
          )}
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>Close</MDButton>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default BatchQuality;

