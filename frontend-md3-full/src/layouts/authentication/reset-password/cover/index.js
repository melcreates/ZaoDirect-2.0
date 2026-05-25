import { useState } from "react";
import { Link } from "react-router-dom";

import Card from "@mui/material/Card";
import Alert from "@mui/material/Alert";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";

import CoverLayout from "layouts/authentication/components/CoverLayout";
import AuthService from "services/auth-service";

import bgImage from "assets/images/bg-reset-cover.jpeg";

function Cover() {
  const [form, setForm] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const placeholderSx = (hasValue) => ({
    "& input::placeholder": {
      opacity: hasValue ? 0 : 1,
      transition: "opacity 0.15s ease",
    },
  });

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const email = form.email.trim();
    if (!email) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    try {
      if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
        setError("Please fill all fields.");
        setLoading(false);
        return;
      }
      if (form.newPassword !== form.confirmPassword) {
        setError("New password and confirmation do not match.");
        setLoading(false);
        return;
      }

      await AuthService.changePasswordWithEmail({
        email,
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      setSuccess("Password changed successfully. You can now sign in.");
      setForm({ email, currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err?.message || "Unable to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CoverLayout coverHeight="50vh" image={bgImage} showNavbar={false} showFooter={false}>
      <Card>
          <MDBox
            variant="gradient"
            bgColor="info"
          borderRadius="lg"
          mx={2}
          mt={2}
          py={2}
          mb={1}
          textAlign="center"
        >
          <MDTypography variant="h3" fontWeight="medium" color="white" mt={1}>
            Forgot Password
          </MDTypography>
          <MDTypography display="block" variant="button" color="white" my={1}>
            Verify your current password, then set a new one
          </MDTypography>
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          {!!error && (
            <Alert
              severity="error"
              variant="outlined"
              sx={{
                mb: 2,
                borderRadius: 2,
                backgroundColor: "rgba(244,67,54,0.06)",
                "& .MuiAlert-message": { fontSize: "0.875rem", fontWeight: 500 },
              }}
            >
              {error}
            </Alert>
          )}
          {!!success && (
            <Alert
              severity="success"
              variant="outlined"
              sx={{
                mb: 2,
                borderRadius: 2,
                backgroundColor: "rgba(76,175,80,0.08)",
                "& .MuiAlert-message": { fontSize: "0.875rem", fontWeight: 500 },
              }}
            >
              {success}
            </Alert>
          )}
          <MDBox component="form" role="form" onSubmit={handleSubmit}>
            <MDBox mb={3}>
              <MDInput
                name="email"
                type="email"
                autoComplete="email"
                placeholder="Email"
                variant="standard"
                fullWidth
                value={form.email}
                onChange={handleChange}
                sx={placeholderSx(Boolean(form.email))}
              />
            </MDBox>
            <MDBox mb={3}>
              <MDInput
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                placeholder="Current Password"
                variant="standard"
                fullWidth
                value={form.currentPassword}
                onChange={handleChange}
                sx={placeholderSx(Boolean(form.currentPassword))}
              />
            </MDBox>
            <MDBox mb={3}>
              <MDInput
                name="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="New Password"
                variant="standard"
                fullWidth
                value={form.newPassword}
                onChange={handleChange}
                sx={placeholderSx(Boolean(form.newPassword))}
              />
            </MDBox>
            <MDBox mb={2}>
              <MDInput
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm New Password"
                variant="standard"
                fullWidth
                value={form.confirmPassword}
                onChange={handleChange}
                sx={placeholderSx(Boolean(form.confirmPassword))}
              />
            </MDBox>

            <MDBox mt={4} mb={1}>
              <MDButton type="submit" variant="gradient" color="info" fullWidth disabled={loading}>
                {loading ? "Processing..." : "Change Password"}
              </MDButton>
            </MDBox>
            <MDBox mt={2} textAlign="center">
              <MDTypography variant="button" color="text">
                Back to{" "}
                <MDTypography
                  component={Link}
                  to="/authentication/sign-in"
                  variant="button"
                  color="info"
                  fontWeight="medium"
                  textGradient
                >
                  Sign in
                </MDTypography>
              </MDTypography>
            </MDBox>
          </MDBox>
        </MDBox>
      </Card>
    </CoverLayout>
  );
}

export default Cover;

