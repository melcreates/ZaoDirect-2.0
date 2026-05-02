/**
=========================================================
* Material Dashboard 2 React - v2.1.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2022 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

/** 
  All of the routes for the Material Dashboard 2 React are added here,
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
  7. The `collapse` key is used for making a collapsible item on the Sidenav that has other routes
  inside (nested routes), you need to pass the nested routes inside an array as a value for the `collapse` key.
  8. The `route` key is used to store the route location which is used for the react router.
  9. The `href` key is used to store the external links location.
  10. The `title` key is only for the item with the type of `title` and its used for the title text on the Sidenav.
  10. The `component` key is used to store the component of its route.
*/

// Material Dashboard 2 React layouts
import Dashboard from "layouts/dashboard";
import MyProduce from "layouts/my-produce";
import AddProduce from "layouts/add-produce";
import UserManagement from "layouts/user-management";
import UserProfile from "layouts/user-profile";
import InternationalOrders from "layouts/international-orders";
import InternationalOrdersCreate from "layouts/international-orders-create";
import FarmerProcurement from "layouts/farmer-procurement";
import FarmerProcurementRequests from "layouts/farmer-procurement-requests";
import FarmerProcurementCreate from "layouts/farmer-procurement-create";
import BatchQuality from "layouts/batch-quality";
import BatchQualityCreate from "layouts/batch-quality-create";
import FinanceTracker from "layouts/finance-tracker";
import MyFinance from "layouts/my-finance";
import ShipmentTracking from "layouts/shipment-tracking";
import ExceptionsDisputes from "layouts/exceptions-disputes";
import AuditLog from "layouts/audit-log";
import FinancierReadiness from "layouts/financier-readiness";
import OrderSummary from "layouts/order-summary";
import BatchSummary from "layouts/batch-summary";

import Login from "auth/login";
import Register from "auth/register";
import ForgotPassword from "auth/forgot-password";
import ResetPassword from "auth/reset-password";

// @mui icons
import Icon from "@mui/material/Icon";

const routes = [
  {
    type: "collapse",
    name: "Dashboard",
    key: "dashboard",
    icon: <Icon fontSize="small">dashboard</Icon>,
    route: "/dashboard",
    component: <Dashboard />,
  },
  {
    type: "collapse",
    name: "International Orders",
    key: "international-orders",
    icon: <Icon fontSize="small">public</Icon>,
    route: "/international-orders",
    component: <InternationalOrders />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "route",
    name: "Create International Order",
    key: "international-orders-create",
    route: "/international-orders/new",
    component: <InternationalOrdersCreate />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Farmer Procurement",
    key: "farmer-procurement",
    icon: <Icon fontSize="small">agriculture</Icon>,
    route: "/farmer-procurement",
    component: <FarmerProcurement />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Batch & Quality",
    key: "batch-quality",
    icon: <Icon fontSize="small">inventory_2</Icon>,
    route: "/batch-quality",
    component: <BatchQuality />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Shipment Tracking",
    key: "shipment-tracking",
    icon: <Icon fontSize="small">flight</Icon>,
    route: "/shipment-tracking",
    component: <ShipmentTracking />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Finance Tracker",
    key: "finance-tracker",
    icon: <Icon fontSize="small">account_balance_wallet</Icon>,
    route: "/finance-tracker",
    component: <FinanceTracker />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Financier Readiness",
    key: "financier-readiness",
    icon: <Icon fontSize="small">insights</Icon>,
    route: "/financier-readiness",
    component: <FinancierReadiness />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Exceptions & Disputes",
    key: "exceptions-disputes",
    icon: <Icon fontSize="small">report_problem</Icon>,
    route: "/exceptions-disputes",
    component: <ExceptionsDisputes />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "Audit Log",
    key: "audit-log",
    icon: <Icon fontSize="small">history</Icon>,
    route: "/audit-log",
    component: <AuditLog />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "User Management",
    key: "user-management",
    icon: <Icon fontSize="small">groups</Icon>,
    route: "/user-management",
    component: <UserManagement />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "My Produce",
    key: "my-produce",
    icon: <Icon fontSize="small">agriculture</Icon>,
    route: "/my-produce",
    component: <MyProduce />,
    allowedRoles: ["FARMER"],
  },
  {
    type: "route",
    name: "Add Produce",
    key: "add-produce",
    route: "/produce/new",
    component: <AddProduce />,
    allowedRoles: ["FARMER"],
  },
  {
    type: "collapse",
    name: "My Procurement",
    key: "my-procurement",
    icon: <Icon fontSize="small">fact_check</Icon>,
    route: "/my-procurement",
    component: <FarmerProcurementRequests />,
    allowedRoles: ["FARMER"],
  },
  {
    type: "collapse",
    name: "My Finance",
    key: "my-finance",
    icon: <Icon fontSize="small">account_balance_wallet</Icon>,
    route: "/my-finance",
    component: <MyFinance />,
    allowedRoles: ["FARMER"],
  },
  {
    type: "route",
    name: "Create Procurement Order",
    key: "farmer-procurement-create",
    route: "/farmer-procurement/new",
    component: <FarmerProcurementCreate />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "route",
    name: "Create Batch",
    key: "batch-quality-create",
    route: "/batch-quality/new",
    component: <BatchQualityCreate />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "route",
    name: "Order Summary",
    key: "order-summary",
    route: "/orders/:id/summary",
    component: <OrderSummary />,
    allowedRoles: ["ADMIN", "FARMER"],
  },
  {
    type: "route",
    name: "Batch Summary",
    key: "batch-summary",
    route: "/batch-quality/:id/summary",
    component: <BatchSummary />,
    allowedRoles: ["ADMIN"],
  },
  {
    type: "collapse",
    name: "My Profile",
    key: "user-profile",
    icon: <Icon fontSize="small">person</Icon>,
    route: "/user-profile",
    component: <UserProfile />,
  },
  {
    type: "auth",
    name: "Login",
    key: "login",
    icon: <Icon fontSize="small">login</Icon>,
    route: "/auth/login",
    component: <Login />,
  },
  {
    type: "auth",
    name: "Register",
    key: "register",
    icon: <Icon fontSize="small">reigster</Icon>,
    route: "/auth/register",
    component: <Register />,
  },
  {
    type: "auth",
    name: "Forgot Password",
    key: "forgot-password",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/auth/forgot-password",
    component: <ForgotPassword />,
  },
  {
    type: "auth",
    name: "Reset Password",
    key: "reset-password",
    icon: <Icon fontSize="small">assignment</Icon>,
    route: "/auth/reset-password",
    component: <ResetPassword />,
  },
];

export default routes;
