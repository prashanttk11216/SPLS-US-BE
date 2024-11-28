import { Request, Response } from "express";
import { EquipmentModel } from "./model";

/**
 * Get all Equipment or a single Equipment based on the _id.
 */
export async function getEquipment(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const equipment = await EquipmentModel.findOne({ _id });
      if (!equipment) {
        res.status(404).json({ message: "Equipment not found" });
        return;
      }
      res
        .status(200)
        .json({ message: "Retrieved successfully", data: equipment });
      return;
    }
    // Fetch all equipment without pagination or sorting
    const equipmentList = await EquipmentModel.find();
    res
      .status(200)
      .json({ message: "Equipment fetched successfully", data: equipmentList });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
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
    const { label } = req.body; // Destructure the label from the request body
    // Validate the incoming data
    if (!label) {
      res.status(400).json({ message: "Label is required." });
      return;
    }
    // Check for duplicate label (if the label should be unique)
    const existingEquipment = await EquipmentModel.findOne({ label });
    if (existingEquipment) {
      res
        .status(409)
        .json({ message: "Equipment with this label already exists." });
      return;
    }
    // Create new Equipment with the label
    const newEquipment = await EquipmentModel.create({ label });
    // Return response
    res.status(201).json({
      message: "Equipment created successfully.",
      data: newEquipment,
    });
  } catch (error) {
    console.error("Error creating equipment:", error);
    res
      .status(500)
      .json({ message: "Server error during equipment creation." });
  }
};

// for Adding Multiple data in one go
/**
 * Create multiple pieces of Equipment.
 */
// export const createEquipment = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { equipmentList } = req.body; // Expecting an array of equipment objects

//     // Validate the incoming data
//     if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
//       res
//         .status(400)
//         .json({
//           message:
//             "Equipment list is required and should be a non-empty array.",
//         });
//       return;
//     }

//     // Check for duplicates in the provided list and existing database records
//     const labels = equipmentList.map((equipment) => equipment.label);
//     const existingEquipment = await EquipmentModel.find({
//       label: { $in: labels },
//     });

//     if (existingEquipment.length > 0) {
//       const existingLabels = existingEquipment.map(
//         (equipment) => equipment.label
//       );
//       res.status(409).json({
//         message: "Some equipment already exists.",
//         existingLabels,
//       });
//       return;
//     }

//     // Insert all equipment in one operation
//     const newEquipment = await EquipmentModel.insertMany(equipmentList);

//     // Return the created equipment
//     res.status(201).json({
//       message: "Equipment created successfully.",
//       data: newEquipment,
//     });
//   } catch (error) {
//     console.error("Error creating equipment:", error);
//     res
//       .status(500)
//       .json({ message: "Server error during equipment creation." });
//   }
// };

/**
 * Edit an existing Equipment.
 */
export const editEquipment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body; // Destructure only the label field from the request body
    // Validate the label field (if required)
    if (!label) {
      res
        .status(400)
        .json({ message: "Label is required to update the equipment." });
      return;
    }
    // Find and update the equipment
    const updatedEquipment = await EquipmentModel.findByIdAndUpdate(
      req.params.equipmentId,
      { label }, // Only update the label field
      { new: true, runValidators: true } // Ensure new data is returned and validators are applied
    );
    if (!updatedEquipment) {
      res.status(404).json({ message: "Equipment not found." });
      return;
    }
    res.status(200).json({
      message: "Equipment updated successfully.",
      data: updatedEquipment,
    });
  } catch (error) {
    console.error("Error during equipment update:", error);
    res.status(500).json({ message: "Server error during equipment update." });
  }
};

/**
 * Delete Equipment (Soft delete).
 */

export const deleteEquipment = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Delete the equipment by _id
    const equipment = await EquipmentModel.findByIdAndDelete(
      req.params.equipmentId
    );
    if (!equipment) {
      res.status(404).json({ message: "Equipment not found." });
      return;
    }
    res.status(200).json({ message: "Equipment deleted successfully." });
  } catch (error) {
    console.error("Error during equipment deletion:", error);
    res
      .status(500)
      .json({ message: "Server error during equipment deletion." });
  }
};
