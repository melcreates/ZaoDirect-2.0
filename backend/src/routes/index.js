import { Router } from "express";
import authRoutes from "./auth.js";
import listingsRoutes from "./listings.js";
import ordersRoutes from "./orders.js";
import mvpOperationsRoutes from "./mvp-operations.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ ok: true, service: "zaodirect-backend" });
});

router.use("/auth", authRoutes);
router.use("/listings", listingsRoutes);
router.use("/orders", ordersRoutes);
router.use("/ops", mvpOperationsRoutes);

export default router;
