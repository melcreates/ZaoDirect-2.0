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

// @react-jvectormap components
import { VectorMap } from "@react-jvectormap/core";
import { worldMerc } from "@react-jvectormap/world";

// @mui material components
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 3 PRO React examples
import SalesTable from "examples/Tables/SalesTable";

// Data
import salesTableData from "layouts/dashboards/analytics/components/SalesByCountry/data/salesTableData";

function SalesByCountry() {
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
            <SalesTable rows={salesTableData} shadow={false} />
          </Grid>
          <Grid item xs={12} md={5} lg={6} sx={{ mt: { xs: 5, lg: 0 } }}>
            <VectorMap
              map={worldMerc}
              zoomOnScroll={false}
              zoomButtons={false}
              markersSelectable
              backgroundColor="transparent"
              selectedMarkers={[1, 3]}
              markers={[
                {
                  name: "United States",
                  latLng: [40.71296415909766, -74.00437720027804],
                },
                {
                  name: "Germany",
                  latLng: [51.17661451970939, 10.97947735117339],
                },
                {
                  name: "Netherlands",
                  latLng: [-7.596735421549542, -54.781694323779185],
                },
                {
                  name: "United Kingdom",
                  latLng: [54.466667, -3.2],
                },
                {
                  name: "United Arab Emirates",
                  latLng: [24.466667, 54.366669],
                },
              ]}
              regionStyle={{
                initial: {
                  fill: "#dee2e7",
                  "fill-opacity": 1,
                  stroke: "none",
                  "stroke-width": 0,
                  "stroke-opacity": 0,
                },
              }}
              markerStyle={{
                initial: {
                  fill: "#e91e63",
                  stroke: "#ffffff",
                  "stroke-width": 5,
                  "stroke-opacity": 0.5,
                  r: 7,
                },
                hover: {
                  fill: "E91E63",
                  stroke: "#ffffff",
                  "stroke-width": 5,
                  "stroke-opacity": 0.5,
                },
                selected: {
                  fill: "E91E63",
                  stroke: "#ffffff",
                  "stroke-width": 5,
                  "stroke-opacity": 0.5,
                },
              }}
              style={{
                marginTop: "-1.5rem",
              }}
              onRegionTipShow={() => false}
              onMarkerTipShow={() => false}
            />
          </Grid>
        </Grid>
      </MDBox>
    </Card>
  );
}

export default SalesByCountry;
