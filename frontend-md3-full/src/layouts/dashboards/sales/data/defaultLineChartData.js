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

const defaultLineChartData = {
  labels: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  datasets: [
    {
      label: "Shipped KG",
      color: "info",
      data: [1200, 1450, 1720, 1650, 2100, 2380, 2600, 2550, 2940],
    },
    {
      label: "Delivered KG",
      color: "dark",
      data: [600, 820, 940, 1100, 1360, 1490, 1780, 1900, 2140],
    },
  ],
};

export default defaultLineChartData;
