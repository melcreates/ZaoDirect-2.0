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
import Link from "@mui/material/Link";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function Footer({
  links = [
    { href: "https://zaodirect.com/", name: "ZaoDirect" },
    { href: "https://zaodirect.com/about", name: "About Us" },
    { href: "https://zaodirect.com/products", name: "Our Products" },
    { href: "https://zaodirect.com/farmers", name: "Our Farmers" },
  ],
}) {
  const renderLinks = () =>
    links.map((link) => (
      <MDBox key={link.name} component="li" px={2} lineHeight={1}>
        <Link href={link.href} target="_blank" rel="noreferrer">
          <MDTypography variant="button" fontWeight="regular" color="text">
            {link.name}
          </MDTypography>
        </Link>
      </MDBox>
    ));

  return (
    <MDBox
      width="100%"
      display="flex"
      flexDirection={{ xs: "column", lg: "row" }}
      justifyContent="space-between"
      alignItems="center"
      px={1.5}
      mt="auto"
      pt={2}
    >
      <MDBox
        display="flex"
        justifyContent="center"
        alignItems="center"
        color="text"
        fontSize="0.875rem"
        px={1.5}
      >
        &copy; 2026 ZaoDirect
      </MDBox>

      <MDBox
        component="ul"
        sx={({ breakpoints }) => ({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          listStyle: "none",
          mt: 3,
          mb: 0,
          p: 0,

          [breakpoints.up("lg")]: {
            mt: 0,
          },
        })}
      >
        {renderLinks()}
      </MDBox>
    </MDBox>
  );
}

export default Footer;
