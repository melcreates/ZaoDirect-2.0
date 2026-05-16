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

import { useState, useEffect, useMemo } from "react";

// react-router components
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// @mui material components
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Icon from "@mui/material/Icon";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDAvatar from "components/MDAvatar";

// Material Dashboard 3 PRO React examples
import Sidenav from "examples/Sidenav";
import Configurator from "examples/Configurator";

// Material Dashboard 3 PRO React themes
import theme from "assets/theme";
import themeRTL from "assets/theme/theme-rtl";

// Material Dashboard 3 PRO React Dark Mode themes
import themeDark from "assets/theme-dark";
import themeDarkRTL from "assets/theme-dark/theme-rtl";

// RTL plugins
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

// Material Dashboard 3 PRO React routes
import routes from "routes";

// Material Dashboard 3 PRO React contexts
import {
  useMaterialUIController,
  setMiniSidenav,
  setOpenConfigurator,
} from "context";

// Images
import zaodirectBrand from "assets/images/ZaoDirectLogo.svg";

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    direction,
    layout,
    openConfigurator,
    sidenavColor,
    transparentSidenav,
    whiteSidenav,
    darkMode,
  } = controller;
  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const [userRouteProfile, setUserRouteProfile] = useState({
    name: "ZaoDirect Ops",
    photoUrl: "",
    initial: "Z",
  });
  const { pathname } = useLocation();
  const isAuthenticated = Boolean(localStorage.getItem("token"));

  const readUserProfile = () => {
    try {
      const rawUser = localStorage.getItem("user");
      const user = rawUser ? JSON.parse(rawUser) : null;

      const name =
        user?.full_name ||
        user?.name ||
        user?.username ||
        user?.email ||
        "ZaoDirect Ops";

      const photoUrl =
        user?.profilePhotoUrl ||
        user?.profile_photo_url ||
        user?.avatar_url ||
        user?.image_url ||
        user?.photo_url ||
        "";

      const initial = String(name).trim().charAt(0).toUpperCase() || "Z";
      return { name, photoUrl, initial };
    } catch (_error) {
      return { name: "ZaoDirect Ops", photoUrl: "", initial: "Z" };
    }
  };

  // Cache for the rtl
  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });

    setRtlCache(cacheRtl);
  }, []);

  // Open sidenav when mouse enter on mini sidenav
  const handleOnMouseEnter = () => {
    if (miniSidenav && !onMouseEnter) {
      setMiniSidenav(dispatch, false);
      setOnMouseEnter(true);
    }
  };

  // Close sidenav when mouse leave mini sidenav
  const handleOnMouseLeave = () => {
    if (onMouseEnter) {
      setMiniSidenav(dispatch, true);
      setOnMouseEnter(false);
    }
  };

  // Change the openConfigurator state
  const handleConfiguratorOpen = () =>
    setOpenConfigurator(dispatch, !openConfigurator);

  // Setting the dir attribute for the body element
  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  // Setting page scroll to 0 when changing the route
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  useEffect(() => {
    setUserRouteProfile(readUserProfile());
  }, [pathname, isAuthenticated]);

  const routesWithLiveUser = useMemo(
    () =>
      routes.map((route) => {
        if (route?.key !== "brooklyn-alice") return route;
        return {
          ...route,
          name: userRouteProfile.name,
          icon: userRouteProfile.photoUrl ? (
            <MDAvatar src={userRouteProfile.photoUrl} alt={userRouteProfile.name} size="sm" />
          ) : (
            <MDAvatar alt={userRouteProfile.name} size="sm" bgColor="light" sx={{ color: "#000000" }}>
              {userRouteProfile.initial}
            </MDAvatar>
          ),
        };
      }),
    [userRouteProfile]
  );

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) {
        return getRoutes(route.collapse);
      }

      if (route.route) {
        const isAuthRoute = route.route.startsWith("/authentication/");
        const isLogoutRoute = route.route === "/authentication/logout";
        let routeElement = route.component;

        if (!isAuthenticated && !isAuthRoute) {
          routeElement = <Navigate to="/authentication/sign-in/basic" replace />;
        }

        if (isAuthenticated && isAuthRoute && !isLogoutRoute) {
          routeElement = <Navigate to="/dashboards/analytics" replace />;
        }

        return (
          <Route
            exact
            path={route.route}
            element={routeElement}
            key={route.key}
          />
        );
      }

      return null;
    });

  const configsButton = (
    <MDBox
      display="flex"
      justifyContent="center"
      alignItems="center"
      width="3.25rem"
      height="3.25rem"
      bgColor="white"
      shadow="sm"
      borderRadius="50%"
      position="fixed"
      right="2rem"
      bottom="2rem"
      zIndex={99}
      color="dark"
      sx={{ cursor: "pointer" }}
      onClick={handleConfiguratorOpen}
    >
      <Icon fontSize="small" color="inherit">
        settings
      </Icon>
    </MDBox>
  );

  return direction === "rtl" ? (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={darkMode ? themeDarkRTL : themeRTL}>
        <CssBaseline />
        {layout === "dashboard" && isAuthenticated && (
          <>
            <Sidenav
              color={sidenavColor}
              brand={zaodirectBrand}
              brandName=""
              routes={routesWithLiveUser}
              onMouseEnter={handleOnMouseEnter}
              onMouseLeave={handleOnMouseLeave}
            />
            <Configurator />
            {configsButton}
          </>
        )}
        {layout === "vr" && <Configurator />}
        <Routes>
        {getRoutes(routesWithLiveUser)}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboards/analytics" : "/authentication/sign-in/basic"} replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboards/analytics" : "/authentication/sign-in/basic"} replace />} />
      </Routes>
      </ThemeProvider>
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {layout === "dashboard" && isAuthenticated && (
        <>
          <Sidenav
            color={sidenavColor}
            brand={zaodirectBrand}
            brandName=""
            routes={routesWithLiveUser}
            onMouseEnter={handleOnMouseEnter}
            onMouseLeave={handleOnMouseLeave}
          />
          <Configurator />
          {configsButton}
        </>
      )}
      {layout === "vr" && <Configurator />}
      <Routes>
        {getRoutes(routesWithLiveUser)}
        <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboards/analytics" : "/authentication/sign-in/basic"} replace />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboards/analytics" : "/authentication/sign-in/basic"} replace />} />
      </Routes>
    </ThemeProvider>
  );
}
