import { Link } from "react-router-dom";
import { useRef, useState } from "react";

import Card from "@mui/material/Card";
import Checkbox from "@mui/material/Checkbox";
import GoogleIcon from "@mui/icons-material/Google";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";

import CoverLayout from "layouts/authentication/components/CoverLayout";
import AuthService from "services/auth-service";

import bgImage from "assets/images/bg-sign-up-cover.jpeg";

function Cover() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const googleInitializedRef = useRef(false);

  const handleChange = ({ target: { name, value } }) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const completeLogin = (response) => {
    if (!response?.token) {
      throw new Error("Sign up failed. Token was not returned.");
    }

    localStorage.setItem("token", response.token);
    if (response?.user) {
      localStorage.setItem("user", JSON.stringify(response.user));
    }

    window.location.replace("/dashboards/analytics");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await AuthService.signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: "FARMER",
      });
      completeLogin(response);
    } catch (err) {
      setError(err?.message || "Unable to sign up.");
    } finally {
      setLoading(false);
    }
  };

  const ensureGoogleScript = () =>
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      const existing = document.getElementById("google-identity-script");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Google script failed to load.")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.id = "google-identity-script";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google script failed to load."));
      document.head.appendChild(script);
    });

  const handleGoogleSignUp = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error("Google sign up is not configured.");
      }

      await ensureGoogleScript();

      if (!googleInitializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (googleResponse) => {
            try {
              const idToken = googleResponse?.credential;
              if (!idToken) {
                throw new Error("Google sign up did not return a token.");
              }
              const response = await AuthService.googleAuth(idToken);
              completeLogin(response);
            } catch (err) {
              setError(err?.message || "Google sign up failed.");
            } finally {
              setGoogleLoading(false);
            }
          },
          ux_mode: "popup",
          auto_select: false,
        });
        googleInitializedRef.current = true;
      }

      window.google.accounts.id.prompt((notification) => {
        if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
          setGoogleLoading(false);
        }
      });
    } catch (err) {
      setError(err?.message || "Google sign up failed.");
      setGoogleLoading(false);
    }
  };

  return (
    <CoverLayout image={bgImage} showNavbar={false} showFooter={false}>
      <Card>
        <MDBox
          variant="gradient"
          bgColor="info"
          borderRadius="lg"
          mx={2}
          mt={2}
          p={3}
          mb={1}
          textAlign="center"
        >
          <MDTypography variant="h4" fontWeight="medium" color="white" mt={1}>
            Join us today
          </MDTypography>
          <MDTypography display="block" variant="button" color="white" my={1}>
            Enter your email and password to register
          </MDTypography>
        </MDBox>
        <MDBox pt={4} pb={3} px={3}>
          {!!error && (
            <MDAlert color="error" sx={{ mb: 2 }}>
              <MDTypography variant="body2" color="white">
                {error}
              </MDTypography>
            </MDAlert>
          )}
          <MDBox component="form" role="form" onSubmit={handleSubmit}>
            <MDBox mb={2}>
              <MDInput
                name="name"
                type="text"
                label="Name"
                variant="standard"
                autoComplete="name"
                fullWidth
                value={form.name}
                onChange={handleChange}
              />
            </MDBox>
            <MDBox mb={2}>
              <MDInput
                name="email"
                type="email"
                label="Email"
                variant="standard"
                autoComplete="email"
                fullWidth
                value={form.email}
                onChange={handleChange}
              />
            </MDBox>
            <MDBox mb={2}>
              <MDInput
                name="password"
                type="password"
                label="Password"
                variant="standard"
                autoComplete="new-password"
                fullWidth
                value={form.password}
                onChange={handleChange}
              />
            </MDBox>
            <MDBox display="flex" alignItems="center" ml={-1}>
              <Checkbox />
              <MDTypography
                variant="button"
                fontWeight="regular"
                color="text"
                sx={{ cursor: "pointer", userSelect: "none", ml: -1 }}
              >
                &nbsp;&nbsp;I agree the&nbsp;
              </MDTypography>
              <MDTypography
                component="a"
                href="#"
                variant="button"
                fontWeight="bold"
                color="info"
                textGradient
              >
                Terms and Conditions
              </MDTypography>
            </MDBox>
            <MDBox mt={4} mb={1}>
              <MDButton type="submit" variant="gradient" color="info" fullWidth disabled={loading}>
                {loading ? "Creating account..." : "Sign up"}
              </MDButton>
            </MDBox>
            <MDBox mt={2} textAlign="center">
              <MDTypography variant="button" color="text">
                or sign up with
              </MDTypography>
              <MDBox mt={1}>
                <MDButton
                  variant="outlined"
                  color="info"
                  circular
                  iconOnly
                  onClick={handleGoogleSignUp}
                  disabled={googleLoading}
                >
                  <GoogleIcon />
                </MDButton>
              </MDBox>
            </MDBox>
            <MDBox mt={3} mb={1} textAlign="center">
              <MDTypography variant="button" color="text">
                Already have an account?{" "}
                <MDTypography
                  component={Link}
                  to="/authentication/sign-in/basic"
                  variant="button"
                  color="info"
                  fontWeight="medium"
                  textGradient
                >
                  Log in
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