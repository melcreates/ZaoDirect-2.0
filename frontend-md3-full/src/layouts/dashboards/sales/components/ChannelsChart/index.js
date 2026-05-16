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

// @mui material components
import Card from "@mui/material/Card";
import Tooltip from "@mui/material/Tooltip";
import Icon from "@mui/material/Icon";
import Grid from "@mui/material/Grid";
import PropTypes from "prop-types";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadgeDot from "components/MDBadgeDot";
import PieChart from "examples/Charts/PieChart";

// Data
import channelChartData from "layouts/dashboards/sales/components/ChannelsChart/data";

// Material Dashboard 3 PRO React contexts
import { useMaterialUIController } from "context";

function ChannelsChart({
  title = "Buyer Channels",
  tooltipTitle = "See destination channel mix",
  chartData = channelChartData,
  badgeItems = [
    { color: "info", label: "EU Retail" },
    { color: "primary", label: "Middle East" },
    { color: "dark", label: "Regional Importers" },
    { color: "secondary", label: "Spot Market" },
  ],
  footerText = "Primary flow is structured buyer contracts, with spot-market demand used as balancing capacity during peak harvest windows.",
  actionLabel = "view routing",
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox display="flex" justifyContent="space-between" alignItems="center" pt={2} px={2}>
        <MDTypography variant="h6">{title}</MDTypography>
        <Tooltip title={tooltipTitle} placement="bottom" arrow>
          <MDButton variant="outlined" color="secondary" size="small" circular iconOnly>
            <Icon>priority_high</Icon>
          </MDButton>
        </Tooltip>
      </MDBox>
      <MDBox mt={3}>
        <Grid container alignItems="center">
          <Grid item xs={7}>
            <PieChart chart={chartData} height="12.5rem" />
          </Grid>
          <Grid item xs={5}>
            <MDBox pr={1}>
              {badgeItems.map((item) => (
                <MDBox mb={1} key={`${item.color}-${item.label}`}>
                  <MDBadgeDot color={item.color} size="sm" badgeContent={item.label} />
                </MDBox>
              ))}
            </MDBox>
          </Grid>
        </Grid>
      </MDBox>
      <MDBox
        pt={4}
        pb={2}
        px={2}
        display="flex"
        flexDirection={{ xs: "column", sm: "row" }}
        mt="auto"
      >
        <MDBox width={{ xs: "100%", sm: "60%" }} lineHeight={1}>
          <MDTypography variant="button" color="text" fontWeight="light">
            {footerText}
          </MDTypography>
        </MDBox>
        <MDBox width={{ xs: "100%", sm: "40%" }} textAlign="right" mt={{ xs: 2, sm: "auto" }}>
          <MDButton color={darkMode ? "white" : "light"}>{actionLabel}</MDButton>
        </MDBox>
      </MDBox>
    </Card>
  );
}

ChannelsChart.propTypes = {
  title: PropTypes.string,
  tooltipTitle: PropTypes.string,
  chartData: PropTypes.shape({
    labels: PropTypes.arrayOf(PropTypes.string),
    datasets: PropTypes.shape({
      label: PropTypes.string,
      backgroundColors: PropTypes.arrayOf(PropTypes.string),
      data: PropTypes.arrayOf(PropTypes.number),
    }),
  }),
  badgeItems: PropTypes.arrayOf(
    PropTypes.shape({
      color: PropTypes.string,
      label: PropTypes.string,
    })
  ),
  footerText: PropTypes.string,
  actionLabel: PropTypes.string,
};

export default ChannelsChart;
