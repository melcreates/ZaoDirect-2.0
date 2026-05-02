import { Navigate } from "react-router-dom";

const ProtectedRoute = ({
  isAuthenticated,
  userRole,
  allowedRoles,
  redirectPath = "/auth/login",
  forbiddenPath = "/dashboard",
  children,
}) => {
  if (!isAuthenticated) {
    return <Navigate to={redirectPath} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to={forbiddenPath} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
