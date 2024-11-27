import { Router } from "express";
import {
  createShipper,
  editShipper,
  deleteShipper,
  toggleActiveShipper,
  getShipper,
} from "./controller";
import auth from "../../middleware/auth";

const shipperRouter = Router();

shipperRouter.get("/", auth, getShipper);

// Create a new shipper
shipperRouter.post("/", createShipper);

// Edit an existing shipper
shipperRouter.put("/:shipperId", editShipper);

// Delete a shipper (soft delete)
shipperRouter.delete("/:shipperId", deleteShipper);

// Toggle active status
shipperRouter.patch("/:shipperId/toggle-active", toggleActiveShipper);

export default shipperRouter;
