import { Request, Response } from "express";
import { LoadOptionModel } from "./model";
import send from "../../../utils/apiResponse";

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
        send(res, 404, "Load option not found");
        return;
      }

      send(res, 200, "Retrieved successfully", loadOption);
      return;
    }

    const loadOptionList = await LoadOptionModel.find();

    send(res, 200, "Load options fetched successfully", loadOptionList);
  } catch (error) {
    console.error("Error fetching load options:", error);
    send(res, 500, "Server error during load option retrieval");
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
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required.");
      return;
    }

    const existingLoadOption = await LoadOptionModel.findOne({ label });

    if (existingLoadOption) {
      send(res, 409, "Load option with this label already exists.");
      return;
    }

    const newLoadOption = await LoadOptionModel.create({ label });

    send(res, 201, "Load option created successfully.", newLoadOption);
  } catch (error) {
    console.error("Error creating load option:", error);
    send(res, 500, "Server error during load option creation.");
  }
};

/**
 * Edit an existing Load Option.
 */
export const editLoadOption = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required to update the load option.");
      return;
    }

    const updatedLoadOption = await LoadOptionModel.findByIdAndUpdate(
      req.params.loadOptionId,
      { label },
      { new: true, runValidators: true }
    );

    if (!updatedLoadOption) {
      send(res, 404, "Load option not found.");
      return;
    }

    send(res, 200, "Load option updated successfully.", updatedLoadOption);
  } catch (error) {
    console.error("Error during load option update:", error);
    send(res, 500, "Server error during load option update.");
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
    const loadOption = await LoadOptionModel.findByIdAndDelete(
      req.params.loadOptionId
    );

    if (!loadOption) {
      send(res, 404, "Load option not found.");
      return;
    }

    send(res, 200, "Load option deleted successfully.");
  } catch (error) {
    console.error("Error during load option deletion:", error);
    send(res, 500, "Server error during load option deletion.");
  }
};
