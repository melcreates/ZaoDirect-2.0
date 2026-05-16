import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";

function ChangePassword({ form, onChange, onSubmit, saving = false }) {
  const passwordRequirements = [
    "One special character",
    "Min 6 characters",
    "One number (2 recommended)",
    "Change it often",
  ];

  return (
    <Card id="change-password">
      <MDBox p={3}>
        <MDTypography variant="h5">Change Password</MDTypography>
      </MDBox>
      <MDBox component="form" pb={3} px={3} onSubmit={onSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <MDInput
              fullWidth
              name="currentPassword"
              label="Current Password"
              inputProps={{ type: "password", autoComplete: "current-password" }}
              value={form.currentPassword}
              onChange={onChange}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              fullWidth
              name="newPassword"
              label="New Password"
              inputProps={{ type: "password", autoComplete: "new-password" }}
              value={form.newPassword}
              onChange={onChange}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              fullWidth
              name="confirmPassword"
              label="Confirm New Password"
              inputProps={{ type: "password", autoComplete: "new-password" }}
              value={form.confirmPassword}
              onChange={onChange}
            />
          </Grid>
        </Grid>
        <MDBox mt={6} mb={1}>
          <MDTypography variant="h5">Password requirements</MDTypography>
        </MDBox>
        <MDBox mb={1}>
          <MDTypography variant="body2" color="text">
            Please follow this guide for a strong password
          </MDTypography>
        </MDBox>
        <MDBox display="flex" justifyContent="space-between" alignItems="flex-end" flexWrap="wrap">
          <MDBox component="ul" m={0} pl={3.25} mb={{ xs: 8, sm: 0 }}>
            {passwordRequirements.map((item) => (
              <MDBox key={item} component="li" color="text" fontSize="1.25rem" lineHeight={1}>
                <MDTypography variant="button" color="text" fontWeight="regular" verticalAlign="middle">
                  {item}
                </MDTypography>
              </MDBox>
            ))}
          </MDBox>
          <MDBox ml="auto">
            <MDButton type="submit" variant="gradient" color="dark" size="small" disabled={saving}>
              {saving ? "Updating..." : "Update password"}
            </MDButton>
          </MDBox>
        </MDBox>
      </MDBox>
    </Card>
  );
}

ChangePassword.propTypes = {
  form: PropTypes.shape({
    currentPassword: PropTypes.string,
    newPassword: PropTypes.string,
    confirmPassword: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

export default ChangePassword;
