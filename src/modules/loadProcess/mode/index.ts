import { Router } from "express";
import { createMode, deleteMode, editMode, getMode } from "./cotroller";

const modeRouter = Router();

// Get all Mode or a single Mode by _id
modeRouter.get("/:_id?", getMode);

// Create a new Mode
modeRouter.post("/", createMode);

// Edit an existing Mode
modeRouter.put("/:modeId", editMode);

// Delete an Mode (Soft delete)
modeRouter.delete("/:modeId", deleteMode);

export default modeRouter;
