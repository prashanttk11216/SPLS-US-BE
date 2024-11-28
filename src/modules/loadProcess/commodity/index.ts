import { Router } from "express";
import {
  getCommodity,
  createCommodity,
  editCommodity,
  deleteCommodity,
} from "./controller";

const commodityRouter = Router();

// Get all Commodity or a single Commodity by _id
commodityRouter.get("/:commodityId?", getCommodity);

// Create a new Commodity
commodityRouter.post("/", createCommodity);

// Edit an existing Commodity
commodityRouter.put("/:commodityId", editCommodity);

// Delete an Commodity (Soft delete)
commodityRouter.delete("/:commodityId", deleteCommodity);

export default commodityRouter;
