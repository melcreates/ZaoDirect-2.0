/**
=========================================================
* Material Dashboard 3 PRO React - v2.4.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-pro-react
* Copyright 2024 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useRef } from "react";
import PropTypes from "prop-types";

// @mui material components
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAvatar from "components/MDAvatar";
import MDButton from "components/MDButton";

function Header({ name = "My Account", role = "", profilePhotoUrl = "", onChangePhoto, uploadingPhoto = false }) {
  const fileInputRef = useRef(null);

  const triggerPick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target?.files?.[0];
    if (!file || typeof onChangePhoto !== "function") return;
    onChangePhoto(file);
    event.target.value = "";
  };

  return (
    <Card id="profile">
      <MDBox p={2}>
        <Grid container spacing={3} alignItems="center">
          <Grid item>
            <MDAvatar src={profilePhotoUrl || ""} alt="profile-image" size="xl" shadow="sm">
              {!profilePhotoUrl ? String(name || "U").charAt(0).toUpperCase() : null}
            </MDAvatar>
          </Grid>
          <Grid item>
            <MDBox height="100%" mt={0.5} lineHeight={1}>
              <MDTypography variant="h5" fontWeight="medium">
                {name}
              </MDTypography>
              <MDTypography variant="button" color="text" fontWeight="medium">
                {role}
              </MDTypography>
            </MDBox>
          </Grid>
          <Grid item xs={12} md={6} lg={3} sx={{ ml: "auto" }}>
            <MDBox
              display="flex"
              justifyContent={{ md: "flex-end" }}
              alignItems="center"
              lineHeight={1}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <MDButton
                variant="gradient"
                color="dark"
                size="small"
                onClick={triggerPick}
                disabled={uploadingPhoto}
                sx={{
                  textTransform: "none",
                  px: 2.5,
                  py: 1.1,
                  minWidth: 170,
                  fontWeight: 700,
                }}
              >
                {uploadingPhoto ? "Uploading..." : "Change Profile Photo"}
              </MDButton>
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>
    </Card>
  );
}

Header.propTypes = {
  name: PropTypes.string,
  role: PropTypes.string,
  profilePhotoUrl: PropTypes.string,
  onChangePhoto: PropTypes.func,
  uploadingPhoto: PropTypes.bool,
};

export default Header;
