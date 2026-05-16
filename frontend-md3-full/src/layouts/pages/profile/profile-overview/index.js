import { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAlert from "components/MDAlert";

// Material Dashboard 3 PRO React examples
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import ProfileInfoCard from "examples/Cards/InfoCards/ProfileInfoCard";
import ProfilesList from "examples/Lists/ProfilesList";
import DefaultProjectCard from "examples/Cards/ProjectCards/DefaultProjectCard";

// Overview page components
import Header from "layouts/pages/profile/components/Header";
import PlatformSettings from "layouts/pages/profile/profile-overview/components/PlatformSettings";

import AuthService from "services/auth-service";
import HttpService from "services/http.service";

// Images
import homeDecor1 from "assets/images/home-decor-1.jpg";
import homeDecor2 from "assets/images/home-decor-2.jpg";
import homeDecor3 from "assets/images/home-decor-3.jpg";
import homeDecor4 from "assets/images/home-decor-4.jpeg";

const fallbackProjectImages = [homeDecor1, homeDecor2, homeDecor3, homeDecor4];

function normalizeRole(role) {
  if (!role) return "";
  return `${role.charAt(0)}${role.slice(1).toLowerCase()}`;
}

function normalizeStatus(status) {
  if (!status) return "Open";
  const value = String(status).toLowerCase();
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replace(/_/g, " ")}`;
}

function getListingPhoto(listing, index) {
  const photos = Array.isArray(listing?.photo_urls) ? listing.photo_urls : [];
  return photos[0] || fallbackProjectImages[index % fallbackProjectImages.length];
}

function Overview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [conversations, setConversations] = useState([]);

  const isAdmin = profile?.role === "ADMIN";
  const isFarmer = profile?.role === "FARMER";

  const displayName = profile?.name || profile?.email || "My Profile";
  const displayRole = normalizeRole(profile?.role);
  const displayPhoto = profile?.profilePhotoUrl || "";

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const me = await AuthService.getProfile();
        setProfile(me);
        localStorage.setItem("user", JSON.stringify(me));

        const listingData = await HttpService.get("/listings");
        const listingRows = Array.isArray(listingData) ? listingData : [];

        let filteredListings = listingRows;
        if (me?.role === "FARMER") {
          filteredListings = listingRows.filter((item) => {
            const ownerId = item?.owner_user_id || item?.farmer_id || item?.user_id || item?.ownerId;
            return ownerId === me?.id;
          });
        } else if (me?.role === "ADMIN") {
          filteredListings = listingRows.filter(
            (item) =>
              item?.owner_role === "FARMER" ||
              item?.ownerRole === "FARMER" ||
              item?.role === "FARMER" ||
              Boolean(item?.farmer_name) ||
              Boolean(item?.farmerName)
          );
        }
        setListings(filteredListings);

        if (me?.role === "FARMER") {
          const farmerOrders = await HttpService.get("/ops/farmer-purchase-orders/mine");
          const rows = Array.isArray(farmerOrders) ? farmerOrders : [];
          setConversations(
            rows.slice(0, 6).map((row, idx) => ({
              image: row?.coordinator_profile_photo_url || "",
              name: row?.crop_type || row?.listing_name || "Procurement Order",
              description: `Order ${normalizeStatus(row?.status)} • ${row?.allocated_kg || row?.quantity || row?.requested_kg || 0} kg`,
              action: {
                type: "internal",
                route: "/pages/profile/profile-overview",
                color: "info",
                label: "view",
              },
            }))
          );
        } else if (me?.role === "ADMIN") {
          const intlOrders = await HttpService.get("/ops/international-orders");
          const rows = Array.isArray(intlOrders) ? intlOrders : [];
          setConversations(
            rows.slice(0, 6).map((row, idx) => ({
              image: row?.buyer_photo_url || "",
              name: row?.buyer_name || "International Order",
              description: `${row?.crop_type || "Crop"} • ${normalizeStatus(row?.status)} • ${row?.quantity_kg || row?.required_quantity || 0} kg`,
              action: {
                type: "internal",
                route: "/pages/profile/profile-overview",
                color: "info",
                label: "view",
              },
            }))
          );
        } else {
          setConversations([]);
        }
      } catch (err) {
        setError(err?.message || "Unable to load profile overview.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const projectCards = useMemo(
    () =>
      listings.slice(0, 8).map((listing, index) => ({
        image: getListingPhoto(listing, index),
        label: (listing?.status || "draft").toLowerCase(),
        title: listing?.title || listing?.name || listing?.crop_type || "Produce Listing",
        description:
          listing?.description ||
          `${listing?.quantity_kg || listing?.quantity || 0} ${listing?.unit || "kg"} • ${listing?.county || "Kenya"}`,
        action: {
          type: "internal",
          route: "/pages/profile/profile-overview",
          color: "info",
          label: "view listing",
        },
        authors: [
          { image: listing?.farmer_profile_photo_url || "", name: listing?.farmer_name || displayName },
          { image: "", name: "ZaoDirect QA" },
        ],
      })),
    [listings, displayName]
  );

  const infoCardData = useMemo(
    () => ({
      fullName: profile?.name || "-",
      mobile: profile?.phone || "-",
      email: profile?.email || "-",
      location: profile?.country || "-",
    }),
    [profile]
  );

  const projectsTitle = isAdmin ? "Farmer Products" : "My Products";
  const projectsSubtitle = isAdmin
    ? "Published produce listings from farmers"
    : "Your published and draft produce listings";
  const conversationsTitle = isFarmer ? "Orders from ZaoDirect" : "International Orders";

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox mb={2} />
      <Header name={displayName} role={displayRole} profilePhotoUrl={displayPhoto}>
        {error && (
          <MDAlert color="error" sx={{ mt: 2 }}>
            <MDTypography variant="body2" color="white">
              {error}
            </MDTypography>
          </MDAlert>
        )}

        <MDBox mt={5} mb={3}>
          <Grid container spacing={1}>
            <Grid item xs={12} md={6} xl={4}>
              <PlatformSettings />
            </Grid>
            <Grid item xs={12} md={6} xl={4} sx={{ display: "flex" }}>
              <Divider orientation="vertical" sx={{ ml: -2, mr: 1 }} />
              <ProfileInfoCard
                title="profile information"
                description={loading ? "Loading profile..." : "Your account profile and contact information."}
                info={infoCardData}
                social={[]}
                action={{ route: "/pages/account/settings", tooltip: "Edit in Settings" }}
                shadow={false}
              />
              <Divider orientation="vertical" sx={{ mx: 0 }} />
            </Grid>
            <Grid item xs={12} xl={4}>
              <ProfilesList title={conversationsTitle} profiles={conversations} shadow={false} />
            </Grid>
          </Grid>
        </MDBox>

        <MDBox pt={2} px={2} lineHeight={1.25}>
          <MDTypography variant="h6" fontWeight="medium">
            {projectsTitle}
          </MDTypography>
          <MDBox mb={1}>
            <MDTypography variant="button" color="text">
              {projectsSubtitle}
            </MDTypography>
          </MDBox>
        </MDBox>

        <MDBox p={2}>
          <Grid container spacing={6}>
            {projectCards.map((project) => (
              <Grid item xs={12} md={6} xl={3} key={`${project.title}-${project.label}`}>
                <DefaultProjectCard
                  image={project.image}
                  label={project.label}
                  title={project.title}
                  description={project.description}
                  action={project.action}
                  authors={project.authors}
                />
              </Grid>
            ))}
          </Grid>
          {!loading && projectCards.length === 0 && (
            <MDTypography variant="button" color="text" px={2}>
              No products found for this profile yet.
            </MDTypography>
          )}
        </MDBox>
      </Header>
      <Footer />
    </DashboardLayout>
  );
}

export default Overview;
