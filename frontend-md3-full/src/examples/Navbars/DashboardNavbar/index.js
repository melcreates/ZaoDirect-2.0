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

import { useState, useEffect } from "react";

// react-router components
import { useLocation, useNavigate } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @material-ui core components
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Icon from "@mui/material/Icon";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDBadge from "components/MDBadge";

// Material Dashboard 3 PRO React examples
import Breadcrumbs from "examples/Breadcrumbs";
import NotificationItem from "examples/Items/NotificationItem";

// Custom styles for DashboardNavbar
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarDesktopMenu,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

// Material Dashboard 3 PRO React context
import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
} from "context";

function DashboardNavbar({ absolute = false, light = false, isMini = false }) {
  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    transparentNavbar,
    fixedNavbar,
    darkMode,
  } = controller;
  const navigate = useNavigate();
  const [openNotificationsMenu, setOpenNotificationsMenu] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState(null);
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const route = useLocation().pathname.split("/").slice(1);

  useEffect(() => {
    // Setting the navbar type
    if (fixedNavbar) {
      setNavbarType("sticky");
    } else {
      setNavbarType("static");
    }

    // A function that sets the transparent state of the navbar.
    function handleTransparentNavbar() {
      setTransparentNavbar(
        dispatch,
        (fixedNavbar && window.scrollY === 0) || !fixedNavbar
      );
    }

    /** 
     The event listener that's calling the handleTransparentNavbar function when 
     scrolling the window.
    */
    window.addEventListener("scroll", handleTransparentNavbar);

    // Call the handleTransparentNavbar function to set the state with the initial value.
    handleTransparentNavbar();

    // Remove event listener on cleanup
    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);
  const handleOpenNotificationsMenu = (event) => setOpenNotificationsMenu(event.currentTarget);
  const handleCloseNotificationsMenu = () => setOpenNotificationsMenu(false);
  const handleOpenProfileMenu = (event) => setProfileAnchor(event.currentTarget);
  const handleCloseProfileMenu = () => setProfileAnchor(null);
  const handleOpenSettingsMenu = (event) => setSettingsAnchor(event.currentTarget);
  const handleCloseSettingsMenu = () => setSettingsAnchor(null);

  const goTo = (path) => {
    navigate(path);
  };

  // Render the notifications menu
  const renderNotificationsMenu = () => (
    <Menu
      anchorEl={openNotificationsMenu}
      anchorReference={null}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      open={Boolean(openNotificationsMenu)}
      onClose={handleCloseNotificationsMenu}
      sx={{ mt: 2 }}
    >
      <NotificationItem icon={<Icon>email</Icon>} title="Check new messages" />
      <NotificationItem
        icon={<Icon>podcasts</Icon>}
        title="Manage Podcast sessions"
      />
      <NotificationItem
        icon={<Icon>shopping_cart</Icon>}
        title="Payment successfully completed"
      />
    </Menu>
  );

  const renderProfileMenu = () => (
    <Menu
      anchorEl={profileAnchor}
      open={Boolean(profileAnchor)}
      onClose={handleCloseProfileMenu}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ mt: 1 }}
      PaperProps={{
        sx: {
          minWidth: 170,
          borderRadius: 1.25,
          boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
          py: 0.25,
        },
      }}
    >
      <MenuItem
        sx={{ py: 0.75, px: 1.25, minHeight: 34 }}
        onClick={() => {
          handleCloseProfileMenu();
          goTo("/pages/profile/profile-overview");
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "#344767" }}>
          <Icon sx={{ fontSize: "1rem" }}>person</Icon>
        </ListItemIcon>
        <ListItemText
          primary="My Profile"
          primaryTypographyProps={{
            fontSize: "0.875rem",
            fontWeight: 400,
            color: "#344767",
          }}
        />
      </MenuItem>
      <MenuItem
        sx={{ py: 0.75, px: 1.25, minHeight: 34 }}
        onClick={() => {
          handleCloseProfileMenu();
          goTo("/authentication/logout");
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "#344767" }}>
          <Icon sx={{ fontSize: "1rem" }}>logout</Icon>
        </ListItemIcon>
        <ListItemText
          primary="Logout"
          primaryTypographyProps={{
            fontSize: "0.875rem",
            fontWeight: 400,
            color: "#344767",
          }}
        />
      </MenuItem>
    </Menu>
  );

  const renderSettingsMenu = () => (
    <Menu
      anchorEl={settingsAnchor}
      open={Boolean(settingsAnchor)}
      onClose={handleCloseSettingsMenu}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ mt: 1 }}
      PaperProps={{
        sx: {
          minWidth: 170,
          borderRadius: 1.25,
          boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
          py: 0.25,
        },
      }}
    >
      <MenuItem
        sx={{ py: 0.75, px: 1.25, minHeight: 34 }}
        onClick={() => {
          handleCloseSettingsMenu();
          goTo("/pages/account/settings");
        }}
      >
        <ListItemIcon sx={{ minWidth: 28, color: "#344767" }}>
          <Icon sx={{ fontSize: "1rem" }}>settings</Icon>
        </ListItemIcon>
        <ListItemText
          primary="Settings"
          primaryTypographyProps={{
            fontSize: "0.875rem",
            fontWeight: 400,
            color: "#344767",
          }}
        />
      </MenuItem>
    </Menu>
  );

  // Styles for the navbar icons
  const iconsStyle = ({
    palette: { dark, white, text },
    functions: { rgba },
  }) => ({
    color: () => {
      let colorValue = light || darkMode ? white.main : dark.main;

      if (transparentNavbar && !light) {
        colorValue = darkMode ? rgba(text.main, 0.6) : text.main;
      }

      return colorValue;
    },
  });

  const persistentTopIconSx = {
    color: "#344767 !important",
  };

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) =>
        navbar(theme, { transparentNavbar, absolute, light, darkMode })
      }
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        <MDBox color="inherit" sx={(theme) => navbarRow(theme, { isMini })}>
          <IconButton
            sx={navbarDesktopMenu}
            onClick={handleMiniSidenav}
            size="small"
            disableRipple
          >
            <Icon fontSize="medium" sx={iconsStyle}>
              {miniSidenav ? "menu_open" : "menu"}
            </Icon>
          </IconButton>
          <Breadcrumbs
            icon="home"
            title={route[route.length - 1]}
            route={route}
            light={light}
          />
        </MDBox>
        {isMini ? null : (
          <MDBox sx={(theme) => navbarRow(theme, { isMini })}>
            <MDBox pr={1}>
              <MDInput label="Search here" />
            </MDBox>
            <MDBox color={light ? "white" : "inherit"}>
              <IconButton sx={navbarIconButton} size="small" disableRipple onClick={handleOpenProfileMenu}>
                <Icon sx={[iconsStyle, persistentTopIconSx]}>account_circle</Icon>
              </IconButton>
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarMobileMenu}
                onClick={handleMiniSidenav}
              >
                <Icon sx={[iconsStyle, persistentTopIconSx]} fontSize="medium">
                  {miniSidenav ? "menu_open" : "menu"}
                </Icon>
              </IconButton>
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                onClick={handleOpenSettingsMenu}
              >
                <Icon sx={[iconsStyle, persistentTopIconSx]}>settings</Icon>
              </IconButton>
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton}
                aria-controls="notification-menu"
                aria-haspopup="true"
                variant="contained"
                onClick={handleOpenNotificationsMenu}
              >
                <MDBadge badgeContent={9} color="error" size="xs" circular>
                  <Icon sx={[iconsStyle, persistentTopIconSx]}>notifications</Icon>
                </MDBadge>
              </IconButton>
              {renderProfileMenu()}
              {renderSettingsMenu()}
              {renderNotificationsMenu()}
            </MDBox>
          </MDBox>
        )}
      </Toolbar>
    </AppBar>
  );
}



// Typechecking props for the DashboardNavbar
DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;
