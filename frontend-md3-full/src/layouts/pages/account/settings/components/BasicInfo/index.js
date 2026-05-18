import PropTypes from "prop-types";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import FormField from "layouts/pages/account/components/FormField";

function BasicInfo({ form, onChange, onSave, saving = false }) {
  return (
    <Card id="basic-info" sx={{ overflow: "visible" }}>
      <MDBox p={3}>
        <MDTypography variant="h5">Basic Info</MDTypography>
      </MDBox>
      <MDBox pb={3} px={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormField
              label="Name"
              name="name"
              placeholder="Your name"
              value={form.name}
              onChange={onChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormField
              label="Email"
              name="email"
              value={form.email}
              inputProps={{ type: "email", readOnly: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormField
              label="Phone Number"
              name="phone"
              placeholder="+254..."
              value={form.phone}
              onChange={onChange}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormField
              label="Country"
              name="country"
              placeholder="Kenya"
              value={form.country}
              onChange={onChange}
            />
          </Grid>
        </Grid>
        <MDBox mt={4} display="flex" justifyContent="flex-end">
          <MDButton type="button" variant="gradient" color="info" disabled={saving} onClick={onSave}>
            {saving ? "Saving..." : "Save changes"}
          </MDButton>
        </MDBox>
      </MDBox>
    </Card>
  );
}

BasicInfo.propTypes = {
  form: PropTypes.shape({
    name: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    country: PropTypes.string,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

export default BasicInfo;