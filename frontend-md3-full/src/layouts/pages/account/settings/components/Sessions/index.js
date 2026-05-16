import PropTypes from "prop-types";
import { useMemo, useState } from "react";

// @mui material components
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Divider from "@mui/material/Divider";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";
import MDButton from "components/MDButton";

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch (_e) {
    return value;
  }
}

function Sessions({ sessions, onRevoke, revokingId = "" }) {
  const [expanded, setExpanded] = useState(false);
  const visibleSessions = useMemo(
    () => (expanded ? sessions : sessions.slice(0, 3)),
    [expanded, sessions]
  );

  return (
    <Card id="sessions">
      <MDBox p={3} lineHeight={1}>
        <MDBox mb={1}>
          <MDTypography variant="h5">Sessions</MDTypography>
        </MDBox>
        <MDTypography variant="button" color="text" fontWeight="regular">
          Devices currently signed into your account. Remove any session you do not recognize.
        </MDTypography>
      </MDBox>
      <MDBox pb={3} px={3} sx={{ overflow: "auto" }}>
        {sessions.length === 0 && (
          <MDTypography variant="button" color="text">
            No active sessions found.
          </MDTypography>
        )}
        {visibleSessions.map((session, idx) => (
          <MDBox key={session.id}>
            <MDBox
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              width={{ xs: "max-content", sm: "100%" }}
            >
              <MDBox display="flex" alignItems="center" mr={2}>
                <MDBox textAlign="center" color="text" px={{ xs: 0, md: 1.5 }} opacity={0.6}>
                  <Icon fontSize="default">{session.is_current ? "desktop_windows" : "devices"}</Icon>
                </MDBox>
                <MDBox ml={2}>
                  <MDTypography display="block" variant="body2" fontWeight="regular" color="text">
                    {session.user_agent || "Unknown device"}
                  </MDTypography>
                  <MDTypography variant="caption" color="text">
                    IP: {session.ip_address || "-"} • Last active: {formatDateTime(session.last_active_at)}
                  </MDTypography>
                </MDBox>
              </MDBox>
              <MDBox display="flex" alignItems="center" gap={1}>
                {session.is_current ? (
                  <MDBadge variant="contained" size="xs" badgeContent="current" color="success" container />
                ) : (
                  <MDButton
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={revokingId === session.id}
                    onClick={() => onRevoke(session.id)}
                  >
                    {revokingId === session.id ? "Removing..." : "Remove"}
                  </MDButton>
                )}
              </MDBox>
            </MDBox>
            {idx < visibleSessions.length - 1 && <Divider />}
          </MDBox>
        ))}
        {sessions.length > 3 && (
          <MDBox mt={2} display="flex" justifyContent="flex-end">
            <MDButton variant="text" color="info" onClick={() => setExpanded((prev) => !prev)}>
              {expanded ? "See less" : "See more"}
            </MDButton>
          </MDBox>
        )}
      </MDBox>
    </Card>
  );
}

Sessions.propTypes = {
  sessions: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      user_agent: PropTypes.string,
      ip_address: PropTypes.string,
      is_current: PropTypes.bool,
      last_active_at: PropTypes.string,
    })
  ).isRequired,
  onRevoke: PropTypes.func.isRequired,
  revokingId: PropTypes.string,
};

export default Sessions;
