import { Router } from "express";
import {
  getLoadOptions,
  createLoadOption,
  editLoadOption,
  deleteLoadOption,
} from "./controller";

const loadOptionsRouter = Router();

// Get all load Options or a single load Options by _id
loadOptionsRouter.get("/:loadOptionId?", getLoadOptions);

// Create a new load Options
loadOptionsRouter.post("/", createLoadOption);

// Edit an existing load Options
loadOptionsRouter.put("/:loadOptionId", editLoadOption);

// Delete an load Options (Soft delete)
loadOptionsRouter.delete("/:loadOptionId", deleteLoadOption);

export default loadOptionsRouter;
