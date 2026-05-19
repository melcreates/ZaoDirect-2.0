import { useEffect } from "react";

function Logout() {
  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    // Hard redirect to force a clean auth state recalculation in App guards.
    window.location.replace("/authentication/sign-in");
  }, []);

  return null;
}

export default Logout;

