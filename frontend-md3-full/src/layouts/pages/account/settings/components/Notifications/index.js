import PropTypes from "prop-types";

// @mui material components
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableRow from "@mui/material/TableRow";
import TableBody from "@mui/material/TableBody";
import Switch from "@mui/material/Switch";

// Material Dashboard 3 PRO React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Setting pages components
import TableCell from "layouts/pages/account/settings/components/TableCell";

function Notifications({ settings, onToggle, onSave, saving = false }) {
  return (
    <Card id="notifications">
      <MDBox p={3} lineHeight={1}>
        <MDBox mb={1}>
          <MDTypography variant="h5">Notifications</MDTypography>
        </MDBox>
        <MDTypography variant="button" color="text">
          Choose how you receive notifications. These settings are saved to your account.
        </MDTypography>
      </MDBox>
      <MDBox pb={3} px={3}>
        <MDBox minWidth="auto" sx={{ overflow: "scroll" }}>
          <Table sx={{ minWidth: "36rem" }}>
            <MDBox component="thead">
              <TableRow>
                <TableCell width="100%" padding={[1.5, 3, 1.5, 0.5]} noBorder>
                  Activity
                </TableCell>
                <TableCell align="center" padding={[1.5, 6, 1.5, 6]} noBorder>
                  Email
                </TableCell>
                <TableCell align="center" padding={[1.5, 6, 1.5, 6]} noBorder>
                  Push
                </TableCell>
                <TableCell align="center" padding={[1.5, 6, 1.5, 6]} noBorder>
                  SMS
                </TableCell>
              </TableRow>
            </MDBox>
            <TableBody>
              <TableRow>
                <TableCell padding={[1, 1, 1, 0.5]} noBorder>
                  <MDBox lineHeight={1.4}>
                    <MDTypography display="block" variant="button" fontWeight="regular">
                      Mentions
                    </MDTypography>
                    <MDTypography variant="caption" color="text" fontWeight="regular">
                      Notify when another user mentions you in a comment.
                    </MDTypography>
                  </MDBox>
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.mentionsEmail} onChange={() => onToggle("mentionsEmail")} />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.mentionsPush} onChange={() => onToggle("mentionsPush")} />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.mentionsSms} onChange={() => onToggle("mentionsSms")} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell padding={[1, 1, 1, 0.5]} noBorder>
                  <MDBox lineHeight={1.4}>
                    <MDTypography display="block" variant="button" fontWeight="regular">
                      Comments
                    </MDTypography>
                    <MDTypography variant="caption" color="text" fontWeight="regular">
                      Notify when another user comments on your item.
                    </MDTypography>
                  </MDBox>
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.commentsEmail} onChange={() => onToggle("commentsEmail")} />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.commentsPush} onChange={() => onToggle("commentsPush")} />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.commentsSms} onChange={() => onToggle("commentsSms")} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell padding={[1, 1, 1, 0.5]} noBorder>
                  <MDBox lineHeight={1.4}>
                    <MDTypography display="block" variant="button" fontWeight="regular">
                      Follows
                    </MDTypography>
                    <MDTypography variant="caption" color="text" fontWeight="regular">
                      Notify when another user follows you.
                    </MDTypography>
                  </MDBox>
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.followsEmail} onChange={() => onToggle("followsEmail")} />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.followsPush} onChange={() => onToggle("followsPush")} />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch checked={settings.followsSms} onChange={() => onToggle("followsSms")} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell padding={[1, 1, 1, 0.5]} noBorder>
                  <MDTypography display="block" variant="button" color="text">
                    Log in from a new device
                  </MDTypography>
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch
                    checked={settings.loginNewDeviceEmail}
                    onChange={() => onToggle("loginNewDeviceEmail")}
                  />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch
                    checked={settings.loginNewDevicePush}
                    onChange={() => onToggle("loginNewDevicePush")}
                  />
                </TableCell>
                <TableCell align="center" padding={[1, 1, 1, 0.5]} noBorder>
                  <Switch
                    checked={settings.loginNewDeviceSms}
                    onChange={() => onToggle("loginNewDeviceSms")}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </MDBox>
        <MDBox mt={3} display="flex" justifyContent="flex-end">
          <MDButton variant="gradient" color="info" onClick={onSave} disabled={saving}>
            {saving ? "Saving..." : "Save notifications"}
          </MDButton>
        </MDBox>
      </MDBox>
    </Card>
  );
}

Notifications.propTypes = {
  settings: PropTypes.shape({
    mentionsEmail: PropTypes.bool,
    mentionsPush: PropTypes.bool,
    mentionsSms: PropTypes.bool,
    commentsEmail: PropTypes.bool,
    commentsPush: PropTypes.bool,
    commentsSms: PropTypes.bool,
    followsEmail: PropTypes.bool,
    followsPush: PropTypes.bool,
    followsSms: PropTypes.bool,
    loginNewDeviceEmail: PropTypes.bool,
    loginNewDevicePush: PropTypes.bool,
    loginNewDeviceSms: PropTypes.bool,
  }).isRequired,
  onToggle: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  saving: PropTypes.bool,
};

export default Notifications;
