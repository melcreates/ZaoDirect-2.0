import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDProgress from "components/MDProgress";
import MDAlert from "components/MDAlert";

import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import HttpService from "services/http.service";
import AuthService from "services/auth-service";
import ProductCell from "layouts/ecommerce/products/product-page/components/ProductCell";
import DefaultCell from "layouts/ecommerce/products/product-page/components/DefaultCell";

import blackChair from "assets/images/ecommerce/black-chair.jpeg";
import chairPink from "assets/images/ecommerce/chair-pink.jpeg";
import chairSteel from "assets/images/ecommerce/chair-steel.jpeg";
import chairWood from "assets/images/ecommerce/chair-wood.jpeg";

function ProductPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const selectedId = new URLSearchParams(location.search).get("id");

  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const me = await AuthService.getProfile();
        const role = String(me?.role || "").toUpperCase();
        const listingRows = await HttpService.get("/listings");
        const all = Array.isArray(listingRows) ? listingRows : [];
        const farmerOwned = all.filter((item) => {
          const ownerRole = String(item?.owner_role || item?.ownerRole || item?.role || "").toUpperCase();
          return ownerRole === "FARMER" || Boolean(item?.farmer_name || item?.farmerName);
        });
        const mine = all.filter((item) => {
          const ownerId = item?.owner_user_id || item?.farmer_id || item?.user_id || item?.ownerId;
          return ownerId === me?.id;
        });

        const visibleRows = role === "ADMIN" ? farmerOwned : mine;
        setRows(visibleRows);
        if (selectedId) {
          const found = visibleRows.find((x) => x.id === selectedId);
          setSelected(found || null);
        } else {
          setSelected(null);
        }
      } catch (e) {
        setError(e?.message || "Unable to load product list.");
      }
    };
    load();
  }, [selectedId]);

  const handleDelete = async (event, listingId) => {
    event.stopPropagation();
    const yes = window.confirm("Delete this product listing?");
    if (!yes) return;

    try {
      setDeletingId(String(listingId));
      setError("");
      await HttpService.delete(`/listings/${encodeURIComponent(listingId)}`);
      setRows((prev) => prev.filter((x) => String(x?.id) !== String(listingId)));
      if (String(selectedId || "") === String(listingId)) {
        navigate("/ecommerce/products/product-page");
      }
    } catch (e) {
      setError(e?.message || "Unable to delete listing.");
    } finally {
      setDeletingId("");
    }
  };

  const images = [blackChair, chairPink, chairSteel, chairWood];
  const getImage = (item, idx) =>
    (Array.isArray(item?.photo_urls) && item.photo_urls[0]) || images[idx % images.length];

  const tableData = useMemo(() => {
    const clickable = (node, id) => (
      <MDBox
        onClick={() => navigate(`/ecommerce/products/edit-product?id=${encodeURIComponent(id)}`)}
        sx={{ cursor: "pointer" }}
      >
        {node}
      </MDBox>
    );

    return {
      columns: [
        { Header: "product", accessor: "product", width: "32%" },
        { Header: "category", accessor: "category", width: "16%" },
        { Header: "quantity", accessor: "quantity", align: "center", width: "16%" },
        { Header: "price / unit", accessor: "price", align: "center", width: "16%" },
        { Header: "county", accessor: "county", align: "center", width: "12%" },
        { Header: "status", accessor: "status", align: "center", width: "12%" },
        { Header: "action", accessor: "action", align: "center", width: "10%" },
      ],
      rows: rows.map((item, idx) => {
        const status = String(item?.status || "").toUpperCase();
        const statusColor = status === "PUBLISHED" ? "success" : status === "DRAFT" ? "warning" : "error";
        return {
          product: clickable(
            <ProductCell image={getImage(item, idx)} name={item?.title || item?.category || "Produce Listing"} />,
            item.id
          ),
          category: clickable(<DefaultCell>{item?.category || "-"}</DefaultCell>, item.id),
          quantity: clickable(
            <DefaultCell>{`${Number(item?.quantity || 0).toLocaleString()} ${item?.unit || "kg"}`}</DefaultCell>,
            item.id
          ),
          price: clickable(
            <DefaultCell>{`${item?.currency || "KES"} ${Number(item?.price_per_unit || 0).toLocaleString()}`}</DefaultCell>,
            item.id
          ),
          county: clickable(<DefaultCell>{item?.county || "-"}</DefaultCell>, item.id),
          status: clickable(
            <MDBox width="7rem">
              <MDProgress variant="gradient" value={100} color={statusColor} />
              <MDTypography variant="caption" color="text">
                {String(status)
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </MDTypography>
            </MDBox>,
            item.id
          ),
          action: (
            <MDButton
              variant="text"
              color="error"
              size="small"
              onClick={(e) => handleDelete(e, item.id)}
              disabled={deletingId === String(item.id)}
            >
              {deletingId === String(item.id) ? "Deleting..." : "Delete"}
            </MDButton>
          ),
        };
      }),
    };
  }, [rows, navigate, deletingId]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Card>
          <MDBox p={3}>
            <MDBox mb={3} display="flex" justifyContent="space-between" alignItems="center">
              <MDTypography variant="h5" fontWeight="medium">
                {selected ? "Product Details" : "Product List"}
              </MDTypography>
              <MDBox display="flex" gap={1}>
                {selected && (
                  <MDButton
                    variant="outlined"
                    color="dark"
                    onClick={() => navigate("/ecommerce/products/product-page")}
                  >
                    back to list
                  </MDButton>
                )}
                {selected ? (
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={() => navigate(`/ecommerce/products/edit-product?id=${encodeURIComponent(selected.id)}`)}
                  >
                    <Icon sx={{ fontWeight: "bold" }}>edit</Icon>&nbsp;edit product
                  </MDButton>
                ) : (
                  <MDButton
                    variant="gradient"
                    color="info"
                    onClick={() => navigate("/ecommerce/products/new-product")}
                  >
                    <Icon sx={{ fontWeight: "bold" }}>add</Icon>&nbsp;add new product
                  </MDButton>
                )}
              </MDBox>
            </MDBox>

            {error && (
              <MDAlert color="error" sx={{ mb: 2 }}>
                <MDTypography variant="button" color="white">
                  {error}
                </MDTypography>
              </MDAlert>
            )}

            {!selected && (
              <MDBox mb={1}>
                <DataTable table={tableData} entriesPerPage={false} showTotalEntries={false} isSorted={false} />
              </MDBox>
            )}

            {selected && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={5}>
                  <MDBox
                    minHeight="16rem"
                    borderRadius="lg"
                    sx={{
                      backgroundImage: `url(${getImage(selected, 0)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={7}>
                  <MDTypography variant="h4">{selected?.title || "-"}</MDTypography>
                  <MDTypography variant="button" color="text" display="block" mt={1}>
                    Category: {selected?.category || "-"}
                  </MDTypography>
                  <MDTypography variant="button" color="text" display="block">
                    Quantity: {Number(selected?.quantity || 0).toLocaleString()} {selected?.unit || "kg"}
                  </MDTypography>
                  <MDTypography variant="button" color="text" display="block">
                    Price: {selected?.currency || "KES"} {Number(selected?.price_per_unit || 0).toLocaleString()} / unit
                  </MDTypography>
                  <MDTypography variant="button" color="text" display="block">
                    County: {selected?.county || "-"}
                  </MDTypography>
                  <MDTypography variant="button" color="text" display="block">
                    Available from: {selected?.available_from ? String(selected.available_from).slice(0, 10) : "-"}
                  </MDTypography>
                  <MDTypography variant="button" color="text" display="block">
                    Status: {String(selected?.status || "").toLowerCase().replace("_", " ")}
                  </MDTypography>
                </Grid>
              </Grid>
            )}
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default ProductPage;
