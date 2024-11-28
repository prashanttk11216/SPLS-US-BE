import { Request, Response } from "express";
import { EquipmentModel } from "./model";
import send from "../../../utils/apiResponse";

/**
 * Get all Equipment or a single Equipment based on the _id.
 */
export async function getEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const equipment = await EquipmentModel.findOne({ _id });
      if (!equipment) {
        send(res, 404, "Equipment not found");
        return;
      }
      send(res, 200, "Retrieved successfully", equipment);
      return;
    }

    const equipmentList = await EquipmentModel.find();
    if (!equipmentList.length) {
      send(res, 404, "No equipment found");
      return;
    }

    send(res, 200, "Equipment fetched successfully", equipmentList);
  } catch (error) {
    console.error("Error fetching equipment:", error);
    send(res, 500, "Server error during equipment retrieval");
  }
}

/**
 * Create a new Equipment.
 */
export const createEquipment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required.");
      return;
    }

    const existingEquipment = await EquipmentModel.findOne({ label });
    if (existingEquipment) {
      send(res, 409, "Equipment with this label already exists.");
      return;
    }

    const newEquipment = await EquipmentModel.create({ label });
    send(res, 201, "Equipment created successfully.", newEquipment);
  } catch (error) {
    console.error("Error creating equipment:", error);
    send(res, 500, "Server error during equipment creation.");
  }
};

/**
 * Edit an existing Equipment.
 */
export const editEquipment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required to update the equipment.");
      return;
    }

    const updatedEquipment = await EquipmentModel.findByIdAndUpdate(
      req.params.equipmentId,
      { label },
      { new: true, runValidators: true }
    );

    if (!updatedEquipment) {
      send(res, 404, "Equipment not found.");
      return;
    }

    send(res, 200, "Equipment updated successfully.", updatedEquipment);
  } catch (error) {
    console.error("Error updating equipment:", error);
    send(res, 500, "Server error during equipment update.");
  }
};

/**
 * Delete Equipment.
 */
export const deleteEquipment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const equipment = await EquipmentModel.findByIdAndDelete(
      req.params.equipmentId
    );

    if (!equipment) {
      send(res, 404, "Equipment not found.");
      return;
    }

    send(res, 200, "Equipment deleted successfully.");
  } catch (error) {
    console.error("Error deleting equipment:", error);
    send(res, 500, "Server error during equipment deletion.");
  }
};
