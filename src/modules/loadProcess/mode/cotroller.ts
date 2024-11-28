import { Request, Response } from "express";
import { ModeModel } from "./model";

/**
 * Get all Mode or a single Mode based on the _id.
 */
export async function getMode(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const mode = await ModeModel.findOne({ _id });

      if (!mode) {
        res.status(404).json({ message: "Mode not found" });
        return;
      }

      res.status(200).json({ message: "Retrieved successfully", data: mode });
      return;
    }

    // Fetch all mode without pagination or sorting
    const modeList = await ModeModel.find();

    res
      .status(200)
      .json({ message: "mode fetched successfully", data: modeList });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

/**
 * Create a new Mode.
 */
export const createMode = async (
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
    const existingMode = await ModeModel.findOne({ label });

    if (existingMode) {
      res.status(409).json({ message: "Mode with this label already exists." });
      return;
    }

    // Create new Equipment with the label
    const newMode = await ModeModel.create({ label });

    // Return response
    res.status(201).json({
      message: "Mode created successfully.",
      data: newMode,
    });
  } catch (error) {
    console.error("Error creating mode:", error);
    res.status(500).json({ message: "Server error during mode creation." });
  }
};

/**
 * Create multiple Modes (Bulk Insert).
 */
// export const createModes = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { modeList } = req.body; // Expecting an array of mode objects

//     // Validate the incoming data
//     if (!Array.isArray(modeList) || modeList.length === 0) {
//       res.status(400).json({
//         message: "Mode list is required and should be a non-empty array.",
//       });
//       return;
//     }

//     // Check for duplicates in the provided list and existing database records
//     const labels = modeList.map((mode) => mode.label);
//     const existingModes = await ModeModel.find({ label: { $in: labels } });

//     if (existingModes.length > 0) {
//       const existingLabels = existingModes.map((mode) => mode.label);
//       res.status(409).json({
//         message: "Some modes already exist.",
//         existingLabels,
//       });
//       return;
//     }

//     // Insert all modes in one operation
//     const newModes = await ModeModel.insertMany(modeList);

//     // Return the created modes
//     res.status(201).json({
//       message: "Modes created successfully.",
//       data: newModes,
//     });
//   } catch (error) {
//     console.error("Error creating modes:", error);
//     res.status(500).json({ message: "Server error during mode creation." });
//   }
// };

/**
 * Edit an existing Equipment.
 */
export const editMode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label } = req.body; // Destructure only the label field from the request body

    // Validate the label field (if required)
    if (!label) {
      res
        .status(400)
        .json({ message: "Label is required to update the equipment." });
      return;
    }

    // Find and update the mode
    const updatedMode = await ModeModel.findByIdAndUpdate(
      req.params.modeId,
      { label }, // Only update the label field
      { new: true, runValidators: true } // Ensure new data is returned and validators are applied
    );

    if (!updatedMode) {
      res.status(404).json({ message: "Mode not found." });
      return;
    }

    res.status(200).json({
      message: "Mode updated successfully.",
      data: updatedMode,
    });
  } catch (error) {
    console.error("Error during mode update:", error);
    res.status(500).json({ message: "Server error during mode update." });
  }
};

/**
 * Delete Mode (Soft delete).
 */

export const deleteMode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Delete the mode by _id
    const mode = await ModeModel.findByIdAndDelete(req.params.modeId);

    if (!mode) {
      res.status(404).json({ message: "Mode not found." });
      return;
    }

    res.status(200).json({ message: "Mode deleted successfully." });
  } catch (error) {
    console.error("Error during mode deletion:", error);
    res.status(500).json({ message: "Server error during mode deletion." });
  }
};
