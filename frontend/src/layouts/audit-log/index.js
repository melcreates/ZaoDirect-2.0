import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/htttp.service";

const ENTITY_TYPES = [
  "international_order",
  "farmer_purchase_order",
  "batch",
  "batch_item",
  "quality_check",
  "payout",
  "cost_entry",
  "shipment_event",
  "listing",
  "order",
  "order_shipment",
  "order_document",
];

function AuditLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [limit, setLimit] = useState("200");
  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (entityType) qs.set("entityType", entityType);
      if (entityId) qs.set("entityId", entityId.trim());
      if (fromDate) qs.set("from", `${fromDate}T00:00:00.000Z`);
      if (toDate) qs.set("to", `${toDate}T23:59:59.999Z`);
      if (limit) qs.set("limit", limit);
      const data = await HttpService.get(`/api/ops/audit-events?${qs.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load audit events.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const table = useMemo(() => {
    const columns = [
      { Header: "time", accessor: "time", align: "left" },
      { Header: "actor", accessor: "actor", align: "left" },
      { Header: "entity", accessor: "entity", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
      { Header: "payload", accessor: "payload", align: "left" },
    ];

    const tableRows = rows.map((item) => ({
      time: new Date(item.created_at).toLocaleString(),
      actor: item.actor_name || item.actor_email || "System",
      entity: `${item.entity_type} / ${item.entity_id}`,
      action: item.action,
      payload: (
        <MDTypography variant="caption" color="text" sx={{ whiteSpace: "pre-wrap" }}>
          {JSON.stringify(item.payload || {}, null, 2)}
        </MDTypography>
      ),
    }));

    return { columns, rows: tableRows };
  }, [rows]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDTypography variant="h4" fontWeight="bold">Audit Log</MDTypography>
        <MDTypography variant="button" color="text">
          Complete trail of critical actions for accountability and financier due diligence.
        </MDTypography>

        <MDBox mt={2}>
          <Card>
            <MDBox p={3}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    select
                    label="Entity Type"
                    value={entityType}
                    onChange={(e) => setEntityType(e.target.value)}
                    sx={uniformFieldSx}
                  >
                    <MenuItem value="">All</MenuItem>
                    {ENTITY_TYPES.map((type) => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} md={3}>
                  <TextField
                    fullWidth
                    label="Entity ID"
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    placeholder="UUID / ID"
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="From"
                    InputLabelProps={{ shrink: true }}
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <TextField
                    fullWidth
                    type="date"
                    label="To"
                    InputLabelProps={{ shrink: true }}
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={1}>
                  <TextField
                    fullWidth
                    label="Limit"
                    type="number"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    sx={uniformFieldSx}
                  />
                </Grid>
                <Grid item xs={12} md={1}>
                  <MDButton
                    fullWidth
                    variant="gradient"
                    color="info"
                    onClick={load}
                    sx={{ minHeight: "56px", height: "56px" }}
                  >
                    Filter
                  </MDButton>
                </Grid>
              </Grid>
              {error && (
                <MDTypography color="error" variant="button" mt={2} display="block">
                  {error}
                </MDTypography>
              )}
            </MDBox>
          </Card>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">
                Events {loading ? "(Loading...)" : `(${rows.length})`}
              </MDTypography>
            </MDBox>
            <DataTable
              table={table}
              showTotalEntries={false}
              isSorted={false}
              noEndBorder
              entriesPerPage={false}
            />
          </Card>
        </MDBox>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default AuditLog;
