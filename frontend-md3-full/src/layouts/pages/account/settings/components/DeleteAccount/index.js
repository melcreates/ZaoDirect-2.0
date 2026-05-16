import PropTypes from "prop-types";

// @mui material components
import Card from "@mui/material/Card";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

function DeleteAccount({ onDeactivate, onDelete, deactivating = false, deleting = false, isAdmin = false }) {
  return (
    <Card id="delete-account">
      <MDBox
        pr={3}
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        flexDirection={{ xs: "column", sm: "row" }}
      >
        <MDBox p={3} lineHeight={1}>
          <MDBox mb={1}>
            <MDTypography variant="h5">Account Controls</MDTypography>
          </MDBox>
          <MDTypography variant="button" color="text">
            Deactivate temporarily or permanently delete your account.
            {isAdmin ? " Admin accounts cannot self-deactivate/delete here." : ""}
          </MDTypography>
        </MDBox>
        <MDBox display="flex" flexDirection={{ xs: "column", sm: "row" }}>
          <MDButton variant="outlined" color="secondary" onClick={onDeactivate} disabled={deactivating || deleting || isAdmin}>
            {deactivating ? "deactivating..." : "deactivate"}
          </MDButton>
          <MDBox ml={{ xs: 0, sm: 1 }} mt={{ xs: 1, sm: 0 }}>
            <MDButton variant="gradient" color="error" sx={{ height: "100%" }} onClick={onDelete} disabled={deactivating || deleting || isAdmin}>
              {deleting ? "deleting..." : "delete account"}
            </MDButton>
          </MDBox>
        </MDBox>
      </MDBox>
    </Card>
  );
}

DeleteAccount.propTypes = {
  onDeactivate: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  deactivating: PropTypes.bool,
  deleting: PropTypes.bool,
  isAdmin: PropTypes.bool,
};

export default DeleteAccount;
