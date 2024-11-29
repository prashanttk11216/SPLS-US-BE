import { Router } from "express";
import {
  getEquipment,
  createEquipment,
  editEquipment,
  deleteEquipment,
} from "./controller";

const equipmentRouter = Router();

// Get all Equipment or a single Equipment by _id
equipmentRouter.get("/:_id?", getEquipment);

// Create a new Equipment
equipmentRouter.post("/", createEquipment);

// Edit an existing Equipment
equipmentRouter.put("/:equipmentId", editEquipment);

// Delete an Equipment (Soft delete)
equipmentRouter.delete("/:equipmentId", deleteEquipment);

export default equipmentRouter;
