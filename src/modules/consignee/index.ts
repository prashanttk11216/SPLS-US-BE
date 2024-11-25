import { Router } from "express";
import {
  createConsignee,
  editConsignee,
  deleteConsignee,
  toggleActiveConsignee,
} from "./controller";

const consigneeRouter = Router();

// Create a new consignee
consigneeRouter.post("/", createConsignee);

// Edit an existing consignee
consigneeRouter.put("/:consigneeId", editConsignee);

// Delete a consignee (soft delete)
consigneeRouter.delete("/:consigneeId", deleteConsignee);

// Toggle active status
consigneeRouter.patch("/:consigneeId/toggle-active", toggleActiveConsignee);

export default consigneeRouter;
