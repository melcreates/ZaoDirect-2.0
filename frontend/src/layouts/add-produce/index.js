import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import HttpService from "services/htttp.service";
import { CROP_OPTIONS, inferCropCategory } from "constants/cropOptions";

const initialForm = {
  title: "",
  category: "",
  quantity: "",
  unit: "kg",
  pricePerUnit: "",
  currency: "USD",
  county: "",
  availableFrom: "",
};

const maxPhotos = 8;
const uniformFieldSx = {
  "& .MuiInputBase-root": {
    minHeight: "56px",
  },
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function AddProduce() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const listingId = searchParams.get("listingId");
  const [form, setForm] = useState(initialForm);
  const [photoUrls, setPhotoUrls] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [draftId, setDraftId] = useState("");
  const [listingStatus, setListingStatus] = useState("");
  const [viewOnly, setViewOnly] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState("");
  const savingDraftRef = useRef(false);
  const canManagePhotos = !initializing;

  const onChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onSelectPhotos = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setError("");
    const currentCount = photoUrls.length;
    const allowedFiles = files.slice(0, Math.max(0, maxPhotos - currentCount));

    if (!allowedFiles.length) {
      setError(`You can upload up to ${maxPhotos} photos per listing.`);
      return;
    }

    try {
      const urls = await Promise.all(allowedFiles.map((file) => fileToDataUrl(file)));
      setPhotoUrls((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e?.message || "Could not process selected photo(s).");
    } finally {
      // Allow selecting the same file again if removed.
      event.target.value = "";
    }
  };

  const removePhoto = (indexToRemove) => {
    setPhotoUrls((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (viewOnly) {
      if (!draftId) {
        setError("Published listing not found.");
        return;
      }
      try {
        setSubmitting(true);
        await HttpService.patch(`/api/listings/${draftId}`, {
          photoUrls,
          status: "PUBLISHED",
        });
        setSuccess("Photos updated successfully.");
      } catch (e) {
        setError(e?.message || "Failed to update listing photos.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const quantity = Number(form.quantity);
    const pricePerUnit = Number(form.pricePerUnit);

    if (!form.title.trim()) {
      setError("Produce name is required.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than zero.");
      return;
    }
    if (!Number.isFinite(pricePerUnit) || pricePerUnit < 0) {
      setError("Price per unit must be zero or higher.");
      return;
    }

    const payload = {
      ...form,
      title: form.title.trim(),
      category: form.category.trim() || undefined,
      county: form.county.trim() || undefined,
      quantity,
      pricePerUnit,
      availableFrom: form.availableFrom || undefined,
      status: "PUBLISHED",
      photoUrls,
    };

    try {
      setSubmitting(true);
      if (draftId) {
        await HttpService.patch(`/api/listings/${draftId}`, payload);
      } else {
        const created = await HttpService.post("/api/listings", payload);
        if (created?.id) setDraftId(created.id);
      }
      setSuccess("Produce listing created successfully.");
      setTimeout(() => navigate("/my-produce"), 700);
    } catch (e) {
      setError(e?.message || "Failed to create produce listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const canAutoSaveDraft = useMemo(() => {
    const quantity = Number(form.quantity);
    const pricePerUnit = Number(form.pricePerUnit);
    return (
      form.title.trim().length >= 2 &&
      Number.isFinite(quantity) &&
      quantity > 0 &&
      Number.isFinite(pricePerUnit) &&
      pricePerUnit >= 0
    );
  }, [form]);

  useEffect(() => {
    if (!canAutoSaveDraft || submitting || viewOnly || initializing) return undefined;

    const timeout = setTimeout(async () => {
      if (savingDraftRef.current) return;
      savingDraftRef.current = true;
      try {
        const payload = {
          title: form.title.trim(),
          category: form.category.trim() || undefined,
          quantity: Number(form.quantity),
          unit: form.unit,
          pricePerUnit: Number(form.pricePerUnit),
          currency: form.currency,
          county: form.county.trim() || undefined,
          availableFrom: form.availableFrom || undefined,
          status: "DRAFT",
          photoUrls,
        };

        if (draftId) {
          await HttpService.patch(`/api/listings/${draftId}`, payload);
        } else {
          const created = await HttpService.post("/api/listings", payload);
          if (created?.id) setDraftId(created.id);
        }
        setDraftSavedAt(new Date().toLocaleTimeString());
      } catch (_e) {
        // Keep silent during background draft autosave to avoid noisy UX.
      } finally {
        savingDraftRef.current = false;
      }
    }, 1200);

    return () => clearTimeout(timeout);
  }, [form, photoUrls, draftId, canAutoSaveDraft, submitting, viewOnly, initializing]);

  useEffect(() => {
    let mounted = true;
    async function loadListingForOpen() {
      if (!listingId) return;
      setInitializing(true);
      setError("");
      try {
        const listing = await HttpService.get(`/api/listings/${listingId}`);
        if (!mounted || !listing) return;
        setDraftId(listing.id);
        setForm({
          title: listing.title || "",
          category: listing.category || "",
          quantity: listing.quantity ?? "",
          unit: listing.unit || "kg",
          pricePerUnit: listing.price_per_unit ?? "",
          currency: listing.currency || "USD",
          county: listing.county || "",
          availableFrom: listing.available_from
            ? new Date(listing.available_from).toISOString().slice(0, 10)
            : "",
        });
        setPhotoUrls(Array.isArray(listing.photo_urls) ? listing.photo_urls : []);
        setListingStatus(String(listing.status || ""));
        setViewOnly(listing.status === "PUBLISHED");
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || "Failed to open listing.");
      } finally {
        if (mounted) setInitializing(false);
      }
    }
    loadListingForOpen();
    return () => {
      mounted = false;
    };
  }, [listingId]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card>
          <MDBox p={3}>
            <MDTypography variant="h4" fontWeight="bold" mb={1}>
              {viewOnly ? "View Produce" : listingId ? "Continue Draft" : "Add Produce"}
            </MDTypography>
            <MDTypography variant="button" color="text">
              {viewOnly
                ? "Published listing view."
                : "Add your produce details and photos so Consynair operations can match demand faster."}
            </MDTypography>
          </MDBox>
          <MDBox component="form" px={3} pb={3} onSubmit={onSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={CROP_OPTIONS}
                  value={form.title}
                  disabled={viewOnly}
                  onChange={(_event, value) =>
                    setForm((prev) => {
                      const title = typeof value === "string" ? value : value || "";
                      return { ...prev, title, category: inferCropCategory(title) || prev.category };
                    })
                  }
                  onInputChange={(_event, value) =>
                    setForm((prev) => {
                      const title = value || "";
                      return { ...prev, title, category: inferCropCategory(title) || prev.category };
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      name="title"
                      label="Produce Name"
                      placeholder="Search or type crop name"
                      fullWidth
                      required
                      disabled={viewOnly}
                      sx={uniformFieldSx}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  name="category"
                  label="Category"
                  placeholder="e.g. Fruits"
                  value={form.category}
                  onChange={onChange}
                  fullWidth
                  disabled={viewOnly}
                  sx={uniformFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  name="quantity"
                  label="Quantity"
                  type="number"
                  placeholder="0"
                  value={form.quantity}
                  onChange={onChange}
                  fullWidth
                  required
                  inputProps={{ min: 0.01, step: "0.01" }}
                  disabled={viewOnly}
                  sx={uniformFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  name="unit"
                  label="Unit"
                  value={form.unit}
                  onChange={onChange}
                  fullWidth
                  disabled={viewOnly}
                  sx={uniformFieldSx}
                >
                  <MenuItem value="kg">kg</MenuItem>
                  <MenuItem value="ton">ton</MenuItem>
                  <MenuItem value="crate">crate</MenuItem>
                  <MenuItem value="bag">bag</MenuItem>
                  <MenuItem value="piece">piece</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  name="county"
                  label="County"
                  placeholder="e.g. Nakuru"
                  value={form.county}
                  onChange={onChange}
                  fullWidth
                  disabled={viewOnly}
                  sx={uniformFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  name="pricePerUnit"
                  label="Price Per Unit"
                  type="number"
                  placeholder="0"
                  value={form.pricePerUnit}
                  onChange={onChange}
                  fullWidth
                  required
                  inputProps={{ min: 0, step: "0.01" }}
                  disabled={viewOnly}
                  sx={uniformFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  name="currency"
                  label="Currency"
                  value={form.currency}
                  onChange={onChange}
                  fullWidth
                  disabled={viewOnly}
                  sx={uniformFieldSx}
                >
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="KES">KES</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  name="availableFrom"
                  label="Available From"
                  type="date"
                  value={form.availableFrom}
                  onChange={onChange}
                  fullWidth
                  disabled={viewOnly}
                  InputLabelProps={{ shrink: true }}
                  sx={uniformFieldSx}
                />
              </Grid>
              <Grid item xs={12}>
                <MDBox mb={1}>
                  <MDTypography variant="button" fontWeight="medium" color="text">
                    Photos ({photoUrls.length}/{maxPhotos})
                  </MDTypography>
                  <MDTypography variant="caption" color="text" display="block">
                    You can upload photos for drafts and published listings.
                  </MDTypography>
                </MDBox>
                <MDButton component="label" variant="outlined" color="info" disabled={!canManagePhotos}>
                  Upload Photos
                  <input type="file" accept="image/*" multiple hidden onChange={onSelectPhotos} />
                </MDButton>
              </Grid>
              {photoUrls.length > 0 && (
                <Grid item xs={12}>
                  <Grid container spacing={2}>
                    {photoUrls.map((url, index) => (
                      <Grid item xs={6} sm={4} md={3} key={`photo-${index}`}>
                        <Card>
                          <MDBox p={1}>
                            <MDBox
                              component="img"
                              src={url}
                              alt={`produce-${index + 1}`}
                              width="100%"
                              borderRadius="lg"
                              mb={1}
                            />
                            {canManagePhotos && (
                              <MDButton
                                color="error"
                                variant="text"
                                size="small"
                                onClick={() => removePhoto(index)}
                              >
                                Remove
                              </MDButton>
                            )}
                          </MDBox>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              )}
            </Grid>

            {error && (
              <MDBox mt={2}>
                <MDTypography variant="button" color="error" fontWeight="medium">
                  {error}
                </MDTypography>
              </MDBox>
            )}

            {success && (
              <MDBox mt={2}>
                <MDTypography variant="button" color="success" fontWeight="medium">
                  {success}
                </MDTypography>
              </MDBox>
            )}

            {draftSavedAt && !success && (
              <MDBox mt={1}>
                <MDTypography variant="caption" color="text">
                  Draft autosaved at {draftSavedAt}
                </MDTypography>
              </MDBox>
            )}

            <MDBox mt={3} display="flex" justifyContent="flex-end" gap={1}>
              <MDButton variant="outlined" color="secondary" onClick={() => navigate("/my-produce")}>
                {viewOnly ? "Back" : "Cancel"}
              </MDButton>
              <MDButton type="submit" variant="gradient" color="info" disabled={submitting || initializing}>
                {submitting ? "Saving..." : viewOnly ? "Save Photos" : "Save Produce"}
              </MDButton>
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default AddProduce;
