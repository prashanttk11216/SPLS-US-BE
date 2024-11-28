import { Request, Response } from "express";
import { LoadOptionModel } from "./model"; // Import LoadOptionModel

/**
 * Get all Load Options or a single Load Option based on the _id.
 */
export async function getLoadOptions(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const loadOption = await LoadOptionModel.findOne({ _id });

      if (!loadOption) {
        res.status(404).json({ message: "Load option not found" });
        return;
      }

      res
        .status(200)
        .json({ message: "Retrieved successfully", data: loadOption });
      return;
    }

    // Fetch all load options without pagination or sorting
    const loadOptionList = await LoadOptionModel.find();

    res.status(200).json({
      message: "Load options fetched successfully",
      data: loadOptionList,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

/**
 * Create a new Load Option.
 */
export const createLoadOption = async (
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
    const existingLoadOption = await LoadOptionModel.findOne({ label });

    if (existingLoadOption) {
      res
        .status(409)
        .json({ message: "Load option with this label already exists." });
      return;
    }

    // Create new Load Option with the label
    const newLoadOption = await LoadOptionModel.create({ label });

    // Return response
    res.status(201).json({
      message: "Load option created successfully.",
      data: newLoadOption,
    });
  } catch (error) {
    console.error("Error creating load option:", error);
    res
      .status(500)
      .json({ message: "Server error during load option creation." });
  }
};

/** *for Adding Multiple data in one go
 * Create multiple pieces of Load Options. */

// export const createLoadOption = async (
//   req: Request,
//   res: Response
// ): Promise<void> => {
//   try {
//     const { loadOptionList } = req.body; // Expecting an array of load option objects

//     // Validate the incoming data
//     if (!Array.isArray(loadOptionList) || loadOptionList.length === 0) {
//       res.status(400).json({
//         message:
//           "Load option list is required and should be a non-empty array.",
//       });
//       return;
//     }

//     // Check for duplicates in the provided list and existing database records
//     const labels = loadOptionList.map((option) => option.label);
//     const existingLoadOptions = await LoadOptionModel.find({
//       label: { $in: labels },
//     });

//     if (existingLoadOptions.length > 0) {
//       const existingLabels = existingLoadOptions.map((option) => option.label);
//       res.status(409).json({
//         message: "Some load options already exist.",
//         existingLabels,
//       });
//       return;
//     }

//     // Insert all load options in one operation
//     const newLoadOptions = await LoadOptionModel.insertMany(loadOptionList);

//     // Return the created load options
//     res.status(201).json({
//       message: "Load options created successfully.",
//       data: newLoadOptions,
//     });
//   } catch (error) {
//     console.error("Error creating load options:", error);
//     res.status(500).json({
//       message: "Server error during load option creation.",
//     });
//   }
// };

/**
 * Edit an existing Load Option.
 */
export const editLoadOption = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body; // Destructure only the label field from the request body

    // Validate the label field (if required)
    if (!label) {
      res
        .status(400)
        .json({ message: "Label is required to update the load option." });
      return;
    }

    // Find and update the load option
    const updatedLoadOption = await LoadOptionModel.findByIdAndUpdate(
      req.params.loadOptionId,
      { label }, // Only update the label field
      { new: true, runValidators: true } // Ensure new data is returned and validators are applied
    );

    if (!updatedLoadOption) {
      res.status(404).json({ message: "Load option not found." });
      return;
    }

    res.status(200).json({
      message: "Load option updated successfully.",
      data: updatedLoadOption,
    });
  } catch (error) {
    console.error("Error during load option update:", error);
    res
      .status(500)
      .json({ message: "Server error during load option update." });
  }
};

/**
 * Delete Load Option.
 */
export const deleteLoadOption = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Delete the load option by _id
    const loadOption = await LoadOptionModel.findByIdAndDelete(
      req.params.loadOptionId
    );

    if (!loadOption) {
      res.status(404).json({ message: "Load option not found." });
      return;
    }

    res.status(200).json({ message: "Load option deleted successfully." });
  } catch (error) {
    console.error("Error during load option deletion:", error);
    res
      .status(500)
      .json({ message: "Server error during load option deletion." });
  }
};
