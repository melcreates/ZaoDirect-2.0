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

/** 
  All of the routes for the Material Dashboard 3 PRO React are added here,
  You can add a new route, customize the routes and delete the routes here.

  Once you add a new route on this file it will be visible automatically on
  the Sidenav.

  For adding a new route you can follow the existing routes in the routes array.
  1. The `type` key with the `collapse` value is used for a route.
  2. The `type` key with the `title` value is used for a title inside the Sidenav. 
  3. The `type` key with the `divider` value is used for a divider between Sidenav items.
  4. The `name` key is used for the name of the route on the Sidenav.
  5. The `key` key is used for the key of the route (It will help you with the key prop inside a loop).
  6. The `icon` key is used for the icon of the route on the Sidenav, you have to add a node.
  7. The `collapse` key is used for making a collapsible item on the Sidenav that contains other routes
  inside (nested routes), you need to pass the nested routes inside an array as a value for the `collapse` key.
  8. The `route` key is used to store the route location which is used for the react router.
  9. The `href` key is used to store the external links location.
  10. The `title` key is only for the item with the type of `title` and its used for the title text on the Sidenav.
  10. The `component` key is used to store the component of its route.
*/

// Material Dashboard 3 PRO React layouts
import Analytics from "layouts/dashboards/analytics";
import Sales from "layouts/dashboards/sales";
import ProfileOverview from "layouts/pages/profile/profile-overview";
import AllProjects from "layouts/pages/profile/all-projects";
import NewUser from "layouts/pages/users/new-user";
import Settings from "layouts/pages/account/settings";
import Billing from "layouts/pages/account/billing";
import Invoice from "layouts/pages/account/invoice";
import Timeline from "layouts/pages/projects/timeline";
import PricingPage from "layouts/pages/pricing-page";
import Widgets from "layouts/pages/widgets";
import RTL from "layouts/pages/rtl";
import Charts from "layouts/pages/charts";
import Notifications from "layouts/pages/notifications";
import Kanban from "layouts/applications/kanban";
import Wizard from "layouts/applications/wizard";
import DataTables from "layouts/applications/data-tables";
import Calendar from "layouts/applications/calendar";
import NewProduct from "layouts/ecommerce/products/new-product";
import EditProduct from "layouts/ecommerce/products/edit-product";
import ProductPage from "layouts/ecommerce/products/product-page";
import OrderList from "layouts/ecommerce/orders/order-list";
import OrderDetails from "layouts/ecommerce/orders/order-details";
import InternationalOrders from "layouts/ops/international-orders";
import InternationalOrdersCreate from "layouts/ops/international-orders-create";
import FarmerProcurement from "layouts/ops/farmer-procurement";
import FarmerProcurementCreate from "layouts/ops/farmer-procurement-create";
import BatchQuality from "layouts/ops/batch-quality";
import BatchQualityCreate from "layouts/ops/batch-quality-create";
import BatchSummary from "layouts/ops/batch-summary";
import ShipmentTracking from "layouts/ops/shipment-tracking";
import FinanceTracker from "layouts/ops/finance-tracker";
import FinancierReadiness from "layouts/ops/financier-readiness";
import ExceptionsDisputes from "layouts/ops/exceptions-disputes";
import AuditLog from "layouts/ops/audit-log";
import UserManagement from "layouts/ops/user-management";
import OrderSummary from "layouts/ops/order-summary";
import SignInBasic from "layouts/authentication/sign-in/basic";
import SignInCover from "layouts/authentication/sign-in/cover";
import SignInIllustration from "layouts/authentication/sign-in/illustration";
import SignUpCover from "layouts/authentication/sign-up/cover";
import ResetCover from "layouts/authentication/reset-password/cover";
import Logout from "layouts/authentication/logout";

// @mui icons
import Icon from "@mui/material/Icon";

const getCurrentUserProfile = () => {
  if (typeof window === "undefined") {
    return { name: "ZaoDirect Ops", photoUrl: "", initial: "Z", role: "farmer" };
  }

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
      user?.profile_photo_url || user?.avatar_url || user?.image_url || user?.photo_url || "";

    const initial = String(name).trim().charAt(0).toUpperCase() || "Z";
    const role = String(user?.role || "farmer").toLowerCase();

    return { name, photoUrl, initial, role };
  } catch (error) {
    return { name: "ZaoDirect Ops", photoUrl: "", initial: "Z", role: "farmer" };
  }
};

const currentUser = getCurrentUserProfile();
const isFarmerView = currentUser.role === "farmer";

const routes = [
  {
    type: "collapse",
    name: "Dashboards",
    key: "dashboards",
    icon: <Icon fontSize="small">dashboard</Icon>,
    collapse: [
      {
        name: "Operations Overview",
        key: "analytics",
        route: "/dashboards/analytics",
        component: <Analytics />,
      },
      {
        name: "Trade & Finance",
        key: "sales",
        route: "/dashboards/sales",
        component: <Sales />,
      },
    ],
  },
  { type: "title", title: "Pages", key: "title-pages" },
  {
    type: "collapse",
    name: "Products",
    key: "product-page",
    icon: <Icon fontSize="small">inventory_2</Icon>,
    route: "/ecommerce/products/product-page",
    component: <ProductPage />,
    activeRoutes: [
      "/ecommerce/products/product-page",
      "/ecommerce/products/new-product",
      "/ecommerce/products/edit-product",
    ],
    noCollapse: true,
  },
  isFarmerView && {
    type: "collapse",
    name: "Orders",
    key: "order-list",
    icon: <Icon fontSize="small">receipt_long</Icon>,
    route: "/ecommerce/orders/order-list",
    component: <OrderList />,
    activeRoutes: ["/ecommerce/orders/order-list", "/ecommerce/orders/order-details"],
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "International Orders",
    key: "international-orders",
    icon: <Icon fontSize="small">public</Icon>,
    route: "/international-orders",
    component: <InternationalOrders />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Farmer Procurement",
    key: "farmer-procurement",
    icon: <Icon fontSize="small">agriculture</Icon>,
    route: "/farmer-procurement",
    component: <FarmerProcurement />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Batch & Quality",
    key: "batch-quality",
    icon: <Icon fontSize="small">inventory_2</Icon>,
    route: "/batch-quality",
    component: <BatchQuality />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Shipment Tracking",
    key: "shipment-tracking",
    icon: <Icon fontSize="small">flight</Icon>,
    route: "/shipment-tracking",
    component: <ShipmentTracking />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Finance Tracker",
    key: "finance-tracker",
    icon: <Icon fontSize="small">account_balance_wallet</Icon>,
    route: "/finance-tracker",
    component: <FinanceTracker />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Financier Readiness",
    key: "financier-readiness",
    icon: <Icon fontSize="small">insights</Icon>,
    route: "/financier-readiness",
    component: <FinancierReadiness />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Exceptions & Disputes",
    key: "exceptions-disputes",
    icon: <Icon fontSize="small">report_problem</Icon>,
    route: "/exceptions-disputes",
    component: <ExceptionsDisputes />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Audit Log",
    key: "audit-log",
    icon: <Icon fontSize="small">history</Icon>,
    route: "/audit-log",
    component: <AuditLog />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "User Management",
    key: "user-management",
    icon: <Icon fontSize="small">groups</Icon>,
    route: "/user-management",
    component: <UserManagement />,
    noCollapse: true,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Pages",
    key: "pages",
    icon: <Icon fontSize="small">image</Icon>,
    collapse: [
      {
        name: "Projects",
        key: "projects",
        collapse: [
          {
            name: "Timeline",
            key: "timeline",
            route: "/pages/projects/timeline",
            component: <Timeline />,
          },
        ],
      },
      {
        name: "Pricing Page",
        key: "pricing-page",
        route: "/pages/pricing-page",
        component: <PricingPage />,
      },
      { name: "RTL", key: "rtl", route: "/pages/rtl", component: <RTL /> },
      {
        name: "Widgets",
        key: "widgets",
        route: "/pages/widgets",
        component: <Widgets />,
      },
      {
        name: "Charts",
        key: "charts",
        route: "/pages/charts",
        component: <Charts />,
      },
      {
        name: "Notfications",
        key: "notifications",
        route: "/pages/notifications",
        component: <Notifications />,
      },
    ],
  },
  !isFarmerView && {
    type: "collapse",
    name: "Account",
    key: "account",
    icon: <Icon fontSize="small">person</Icon>,
    collapse: [
      {
        name: "Settings",
        key: "settings",
        route: "/pages/account/settings",
        component: <Settings />,
      },
      {
        name: "Billing",
        key: "billing",
        route: "/pages/account/billing",
        component: <Billing />,
      },
      {
        name: "Invoice",
        key: "invoice",
        route: "/pages/account/invoice",
        component: <Invoice />,
      },
    ],
  },
  !isFarmerView && {
    type: "collapse",
    name: "Team",
    key: "team",
    icon: <Icon fontSize="small">people</Icon>,
    collapse: [
      {
        name: "All Projects",
        key: "all-projects",
        route: "/pages/profile/all-projects",
        component: <AllProjects />,
      },
      {
        name: "New User",
        key: "new-user",
        route: "/pages/users/new-user",
        component: <NewUser />,
      },
      {
        name: "Profile Overview",
        key: "profile-overview",
        route: "/pages/profile/profile-overview",
        component: <ProfileOverview />,
      },
    ],
  },
  !isFarmerView && {
    type: "collapse",
    name: "Applications",
    key: "applications",
    icon: <Icon fontSize="small">apps</Icon>,
    collapse: [
      {
        name: "Kanban",
        key: "kanban",
        route: "/applications/kanban",
        component: <Kanban />,
      },
      {
        name: "Wizard",
        key: "wizard",
        route: "/applications/wizard",
        component: <Wizard />,
      },
      {
        name: "Data Tables",
        key: "data-tables",
        route: "/applications/data-tables",
        component: <DataTables />,
      },
      {
        name: "Calendar",
        key: "calendar",
        route: "/applications/calendar",
        component: <Calendar />,
      },
    ],
  },

  {
    type: "route",
    key: "new-product-hidden",
    route: "/ecommerce/products/new-product",
    component: <NewProduct />,
  },
  {
    type: "route",
    key: "edit-product-hidden",
    route: "/ecommerce/products/edit-product",
    component: <EditProduct />,
  },
  {
    type: "route",
    key: "order-details-hidden",
    route: "/ecommerce/orders/order-details",
    component: <OrderDetails />,
  },
  {
    type: "route",
    key: "international-orders-create-hidden",
    route: "/international-orders/new",
    component: <InternationalOrdersCreate />,
  },
  {
    type: "route",
    key: "farmer-procurement-create-hidden",
    route: "/farmer-procurement/new",
    component: <FarmerProcurementCreate />,
  },
  {
    type: "route",
    key: "batch-quality-create-hidden",
    route: "/batch-quality/new",
    component: <BatchQualityCreate />,
  },
  {
    type: "route",
    key: "batch-summary-hidden",
    route: "/batch-quality/:id/summary",
    component: <BatchSummary />,
  },
  {
    type: "route",
    key: "order-summary-hidden",
    route: "/orders/:id/summary",
    component: <OrderSummary />,
  },
  !isFarmerView && {
    type: "collapse",
    name: "Authentication",
    key: "authentication",
    icon: <Icon fontSize="small">content_paste</Icon>,
    collapse: [
      {
        name: "Sign In",
        key: "sign-in",
        collapse: [
          {
            name: "Basic",
            key: "basic",
            route: "/authentication/sign-in",
            component: <SignInBasic />,
          },
          {
            name: "Cover",
            key: "cover",
            route: "/authentication/sign-in/cover",
            component: <SignInCover />,
          },
          {
            name: "Illustration",
            key: "illustration",
            route: "/authentication/sign-in/illustration",
            component: <SignInIllustration />,
          },
        ],
      },
      {
        name: "Sign Up",
        key: "sign-up",
        collapse: [
          {
            name: "Cover",
            key: "cover",
            route: "/authentication/sign-up",
            component: <SignUpCover />,
          },
        ],
      },
      {
        name: "Reset Password",
        key: "reset-password",
        collapse: [
          {
            name: "Cover",
            key: "cover",
            route: "/authentication/reset-password",
            component: <ResetCover />,
          },
        ],
      },
    ],
  },
  !isFarmerView && { type: "divider", key: "divider-1" },
  !isFarmerView && { type: "title", title: "Docs", key: "title-docs" },
  {
    type: "route",
    key: "sign-in-basic-hidden",
    route: "/authentication/sign-in",
    component: <SignInBasic />,
  },
  {
    type: "route",
    key: "sign-in-cover-hidden",
    route: "/authentication/sign-in/cover",
    component: <SignInCover />,
  },
  {
    type: "route",
    key: "sign-in-illustration-hidden",
    route: "/authentication/sign-in/illustration",
    component: <SignInIllustration />,
  },
  {
    type: "route",
    key: "sign-up-cover-hidden",
    route: "/authentication/sign-up",
    component: <SignUpCover />,
  },
  {
    type: "route",
    key: "reset-password-cover-hidden",
    route: "/authentication/reset-password",
    component: <ResetCover />,
  },
  {
    type: "route",
    key: "profile-overview-hidden",
    route: "/pages/profile/profile-overview",
    component: <ProfileOverview />,
  },
  {
    type: "route",
    key: "settings-hidden",
    route: "/pages/account/settings",
    component: <Settings />,
  },
  {
    type: "route",
    key: "logout-hidden",
    route: "/authentication/logout",
    component: <Logout />,
  },
  {
    type: "collapse",
    name: "Basic",
    key: "basic",
    icon: <Icon fontSize="small">upcoming</Icon>,
    collapse: [
      {
        name: "Getting Started",
        key: "getting-started",
        collapse: [
          {
            name: "Overview",
            key: "overview",
            href: "https://www.creative-tim.com/learning-lab/react/overview/material-dashboard/",
          },
          {
            name: "License",
            key: "license",
            href: "https://www.creative-tim.com/learning-lab/react/license/material-dashboard/",
          },
          {
            name: "Quick Start",
            key: "quick-start",
            href: "https://www.creative-tim.com/learning-lab/react/quick-start/material-dashboard/",
          },
          {
            name: "Build Tools",
            key: "build-tools",
            href: "https://www.creative-tim.com/learning-lab/react/build-tools/material-dashboard/",
          },
        ],
      },
      {
        name: "Foundation",
        key: "foundation",
        collapse: [
          {
            name: "Colors",
            key: "colors",
            href: "https://www.creative-tim.com/learning-lab/react/colors/material-dashboard/",
          },
          {
            name: "Grid",
            key: "grid",
            href: "https://www.creative-tim.com/learning-lab/react/grid/material-dashboard/",
          },
          {
            name: "Typography",
            key: "base-typography",
            href: "https://www.creative-tim.com/learning-lab/react/base-typography/material-dashboard/",
          },
          {
            name: "Borders",
            key: "borders",
            href: "https://www.creative-tim.com/learning-lab/react/borders/material-dashboard/",
          },
          {
            name: "Box Shadows",
            key: "box-shadows",
            href: "https://www.creative-tim.com/learning-lab/react/box-shadows/material-dashboard/",
          },
          {
            name: "Functions",
            key: "functions",
            href: "https://www.creative-tim.com/learning-lab/react/functions/material-dashboard/",
          },
          {
            name: "Routing System",
            key: "routing-system",
            href: "https://www.creative-tim.com/learning-lab/react/routing-system/material-dashboard/",
          },
        ],
      },
    ],
  },
  {
    type: "collapse",
    name: "Components",
    key: "components",
    icon: <Icon fontSize="small">view_in_ar</Icon>,
    collapse: [
      {
        name: "Alerts",
        key: "alerts",
        href: "https://www.creative-tim.com/learning-lab/react/alerts/material-dashboard/",
      },
      {
        name: "Avatar",
        key: "avatar",
        href: "https://www.creative-tim.com/learning-lab/react/avatar/material-dashboard/",
      },
      {
        name: "Badge",
        key: "badge",
        href: "https://www.creative-tim.com/learning-lab/react/badge/material-dashboard/",
      },
      {
        name: "Badge Dot",
        key: "badge-dot",
        href: "https://www.creative-tim.com/learning-lab/react/badge-dot/material-dashboard/",
      },
      {
        name: "Box",
        key: "box",
        href: "https://www.creative-tim.com/learning-lab/react/box/material-dashboard/",
      },
      {
        name: "Buttons",
        key: "buttons",
        href: "https://www.creative-tim.com/learning-lab/react/buttons/material-dashboard/",
      },
      {
        name: "Date Picker",
        key: "date-picker",
        href: "https://www.creative-tim.com/learning-lab/react/datepicker/material-dashboard/",
      },
      {
        name: "Dropzone",
        key: "dropzone",
        href: "https://www.creative-tim.com/learning-lab/react/dropzone/material-dashboard/",
      },
      {
        name: "Editor",
        key: "editor",
        href: "https://www.creative-tim.com/learning-lab/react/quill/material-dashboard/",
      },
      {
        name: "Input",
        key: "input",
        href: "https://www.creative-tim.com/learning-lab/react/input/material-dashboard/",
      },
      {
        name: "Pagination",
        key: "pagination",
        href: "https://www.creative-tim.com/learning-lab/react/pagination/material-dashboard/",
      },
      {
        name: "Progress",
        key: "progress",
        href: "https://www.creative-tim.com/learning-lab/react/progress/material-dashboard/",
      },
      {
        name: "Snackbar",
        key: "snackbar",
        href: "https://www.creative-tim.com/learning-lab/react/snackbar/material-dashboard/",
      },
      {
        name: "Social Button",
        key: "social-button",
        href: "https://www.creative-tim.com/learning-lab/react/social-buttons/material-dashboard/",
      },
      {
        name: "Typography",
        key: "typography",
        href: "https://www.creative-tim.com/learning-lab/react/typography/material-dashboard/",
      },
    ],
  },
  {
    type: "collapse",
    name: "Change Log",
    key: "changelog",
    href: "https://github.com/creativetimofficial/ct-material-dashboard-pro-react/blob/main/CHANGELOG.md",
    icon: <Icon fontSize="small">receipt_long</Icon>,
    noCollapse: true,
  },
].filter(Boolean);

const farmerAllowedKeys = new Set([
  "dashboards",
  "title-pages",
  "product-page",
  "order-list",
  "new-product-hidden",
  "edit-product-hidden",
  "order-details-hidden",
  "sign-in-basic-hidden",
  "sign-in-cover-hidden",
  "sign-in-illustration-hidden",
  "sign-up-cover-hidden",
  "reset-password-cover-hidden",
  "profile-overview-hidden",
  "settings-hidden",
  "logout-hidden",
]);

const adminAllowedKeys = new Set([
  "dashboards",
  "title-pages",
  "product-page",
  "order-list",
  "international-orders",
  "farmer-procurement",
  "batch-quality",
  "shipment-tracking",
  "finance-tracker",
  "financier-readiness",
  "exceptions-disputes",
  "audit-log",
  "user-management",
  "new-product-hidden",
  "edit-product-hidden",
  "order-details-hidden",
  "international-orders-create-hidden",
  "farmer-procurement-create-hidden",
  "batch-quality-create-hidden",
  "batch-summary-hidden",
  "order-summary-hidden",
  "sign-in-basic-hidden",
  "sign-in-cover-hidden",
  "sign-in-illustration-hidden",
  "sign-up-cover-hidden",
  "reset-password-cover-hidden",
  "profile-overview-hidden",
  "settings-hidden",
  "logout-hidden",
]);

const visibleRoutes = isFarmerView
  ? routes.filter((route) => farmerAllowedKeys.has(route?.key))
  : routes.filter((route) => adminAllowedKeys.has(route?.key));

export default visibleRoutes;




