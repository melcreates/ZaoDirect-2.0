import { useEffect, useMemo, useState } from "react";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";
import DataTable from "examples/Tables/DataTable";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import HttpService from "services/http.service";

const roleLabelMap = {
  FARMER: "Farmer",
  ADMIN: "Admin",
};

const verificationLabelMap = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

const statusLabelMap = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    role: "FARMER",
    isActive: "true",
    verificationStatus: "UNVERIFIED",
  });
  const uniformFieldSx = {
    "& .MuiInputBase-root": {
      minHeight: "56px",
    },
  };

  const loadUsers = async () => {
    const data = await HttpService.get("/auth/users");
    setUsers(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await HttpService.get("/auth/users");
        if (!mounted) return;
        setUsers(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to load users.");
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const openEdit = (user) => {
    setSelectedUser(user);
    setForm({
      role: user.role || "FARMER",
      isActive: user.is_active === false ? "false" : "true",
      verificationStatus: user.verification_status || "UNVERIFIED",
    });
    setDialogOpen(true);
  };

  const saveUser = async () => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await HttpService.patch(`/api/auth/users/${selectedUser.id}`, {
        role: form.role,
        isActive: form.isActive === "true",
        verificationStatus: form.verificationStatus,
      });
      await loadUsers();
      setNotice("User updated successfully.");
      setDialogOpen(false);
      setSelectedUser(null);
    } catch (e) {
      setError(e?.message || "Failed to update user.");
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    const activeUsers = users.filter((u) => u.is_active !== false).length;
    const verifiedUsers = users.filter((u) => u.verification_status === "VERIFIED").length;
    const farmers = users.filter((u) => u.role === "FARMER").length;
    const admins = users.filter((u) => u.role === "ADMIN").length;
    return { total: users.length, activeUsers, verifiedUsers, farmers, admins };
  }, [users]);

  const table = useMemo(() => {
    const columns = [
      { Header: "name", accessor: "name", align: "left" },
      { Header: "email", accessor: "email", align: "left" },
      { Header: "role", accessor: "role", align: "left" },
      { Header: "status", accessor: "status", align: "left" },
      { Header: "verification", accessor: "verification", align: "left" },
      { Header: "action", accessor: "action", align: "left" },
    ];
    const rows = users.map((u) => ({
      name: u.name,
      email: u.email,
      role: roleLabelMap[u.role] || u.role,
      status: statusLabelMap[u.is_active === false ? "INACTIVE" : "ACTIVE"],
      verification: verificationLabelMap[u.verification_status] || "Unverified",
      action: (
        <MDButton size="small" variant="text" color="info" onClick={() => openEdit(u)}>
          Edit
        </MDButton>
      ),
    }));
    return { columns, rows };
  }, [users]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <MDTypography variant="h4" fontWeight="bold">User Management</MDTypography>
        <MDTypography variant="button" color="text">
          Admin controls for user roles, account access, and verification.
        </MDTypography>
        {error && <MDTypography color="error" variant="button">{error}</MDTypography>}
        {notice && <MDTypography color="success" variant="button">{notice}</MDTypography>}

        <MDBox mt={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard color="info" icon="groups" title="Total Users" count={stats.total} percentage={{ color: "info", amount: "", label: "All accounts" }} />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard color="success" icon="verified_user" title="Active Users" count={stats.activeUsers} percentage={{ color: "success", amount: "", label: "Can sign in" }} />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard color="primary" icon="task_alt" title="Verified" count={stats.verifiedUsers} percentage={{ color: "primary", amount: "", label: "KYC/KYB verified" }} />
            </Grid>
            <Grid item xs={12} md={6} lg={3}>
              <ComplexStatisticsCard color="dark" icon="agriculture" title="Farmers / Admins" count={`${stats.farmers}/${stats.admins}`} percentage={{ color: "dark", amount: "", label: "Role distribution" }} />
            </Grid>
          </Grid>
        </MDBox>

        <MDBox mt={3}>
          <Card>
            <MDBox p={3}>
              <MDTypography variant="h6">Users</MDTypography>
            </MDBox>
            <Divider />
            <DataTable table={table} showTotalEntries={false} isSorted={false} noEndBorder entriesPerPage={false} />
          </Card>
        </MDBox>
      </MDBox>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <MDBox mt={1}>
            <MDTypography variant="button" color="text">
              {selectedUser ? `${selectedUser.name} (${selectedUser.email})` : ""}
            </MDTypography>
            <TextField
              fullWidth
              select
              label="Role"
              value={form.role}
              onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
              sx={{ mt: 2, ...uniformFieldSx }}
            >
              <MenuItem value="FARMER">Farmer</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </TextField>
            <TextField
              fullWidth
              select
              label="Account Status"
              value={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value }))}
              sx={{ mt: 2, ...uniformFieldSx }}
            >
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField>
            <TextField
              fullWidth
              select
              label="Verification Status"
              value={form.verificationStatus}
              onChange={(e) => setForm((prev) => ({ ...prev, verificationStatus: e.target.value }))}
              sx={{ mt: 2, ...uniformFieldSx }}
            >
              <MenuItem value="UNVERIFIED">Unverified</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="VERIFIED">Verified</MenuItem>
              <MenuItem value="REJECTED">Rejected</MenuItem>
            </TextField>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={() => setDialogOpen(false)}>Cancel</MDButton>
          <MDButton variant="gradient" color="info" onClick={saveUser} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Footer />
    </DashboardLayout>
  );
}

export default UserManagement;

