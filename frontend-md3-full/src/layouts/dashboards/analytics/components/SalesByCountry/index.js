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

import { lazy, Suspense, useEffect, useState } from "react";

// @mui material components
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import PropTypes from "prop-types";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 3 PRO React examples
import SalesTable from "examples/Tables/SalesTable";
const SalesByCountryMap = lazy(() => import("./SalesByCountryMap"));

const COUNTRY_LATLNG = {
  germany: [51.1657, 10.4515],
  "united kingdom": [55.3781, -3.436],
  uk: [55.3781, -3.436],
  "united states": [37.0902, -95.7129],
  usa: [37.0902, -95.7129],
  netherlands: [52.1326, 5.2913],
  brazil: [-14.235, -51.9253],
  australia: [-25.2744, 133.7751],
  "united arab emirates": [23.4241, 53.8478],
  uae: [23.4241, 53.8478],
  france: [46.2276, 2.2137],
  italy: [41.8719, 12.5674],
  spain: [40.4637, -3.7492],
  belgium: [50.5039, 4.4699],
  kenya: [-0.0236, 37.9062],
};

function SalesByCountry({ rows = null }) {
  const [showMap, setShowMap] = useState(false);
  const tableRows = Array.isArray(rows) ? rows : [];
  const markers = tableRows
    .map((row) => {
      const countryName = String(row?.country?.[1] || "").toLowerCase();
      const latLng = COUNTRY_LATLNG[countryName];
      if (!latLng) return null;
      return { name: row?.country?.[1] || "Unknown", latLng };
    })
    .filter(Boolean);

  useEffect(() => {
    const id = setTimeout(() => setShowMap(true), 200);
    return () => clearTimeout(id);
  }, []);

  return (
    <Card sx={{ width: "100%" }}>
      <MDBox>
        <MDTypography variant="h6" sx={{ mt: 2, ml: 2 }}>
          Buyer Destinations
        </MDTypography>
        <MDTypography
          variant="body2"
          color="text"
          sx={{ fontSize: "14px", mb: 1, ml: 2 }}
        >
          Export demand, shipped value, and concentration by destination market.
        </MDTypography>
      </MDBox>
      <MDBox p={2}>
        <Grid container>
          <Grid item xs={12} md={7} lg={6}>
            <SalesTable rows={tableRows} shadow={false} />
            {!tableRows.length && (
              <MDBox px={2} pb={1}>
                <MDTypography variant="button" color="text">
                  No destination data yet.
                </MDTypography>
              </MDBox>
            )}
          </Grid>
          <Grid item xs={12} md={5} lg={6} sx={{ mt: { xs: 5, lg: 0 } }}>
            {showMap ? (
              <Suspense fallback={<MDBox minHeight="20rem" />}>
                <SalesByCountryMap markers={markers} />
              </Suspense>
            ) : (
              <MDBox minHeight="20rem" />
            )}
          </Grid>
        </Grid>
      </MDBox>
    </Card>
  );
}

SalesByCountry.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object),
};

export default SalesByCountry;
