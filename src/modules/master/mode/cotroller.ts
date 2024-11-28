import { Request, Response } from "express";
import { ModeModel } from "./model";
import send from "../../../utils/apiResponse";

/**
 * Get all Mode or a single Mode based on the _id.
 */
export async function getMode(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const mode = await ModeModel.findOne({ _id });

      if (!mode) {
        send(res, 404, "Mode not found");
        return;
      }

      send(res, 200, "Retrieved successfully", mode);
      return;
    }

    const modeList = await ModeModel.find();

    send(res, 200, "Mode fetched successfully", modeList);
  } catch (error) {
    console.error("Error fetching mode:", error);
    send(res, 500, "Server error during mode retrieval");
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
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required.");
      return;
    }

    const existingMode = await ModeModel.findOne({ label });

    if (existingMode) {
      send(res, 409, "Mode with this label already exists.");
      return;
    }

    const newMode = await ModeModel.create({ label });

    send(res, 201, "Mode created successfully.", newMode);
  } catch (error) {
    console.error("Error creating mode:", error);
    send(res, 500, "Server error during mode creation.");
  }
};

/**
 * Edit an existing Mode.
 */
export const editMode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { label } = req.body;

    if (!label) {
      send(res, 400, "Label is required to update the mode.");
      return;
    }

    const updatedMode = await ModeModel.findByIdAndUpdate(
      req.params.modeId,
      { label },
      { new: true, runValidators: true }
    );

    if (!updatedMode) {
      send(res, 404, "Mode not found.");
      return;
    }

    send(res, 200, "Mode updated successfully.", updatedMode);
  } catch (error) {
    console.error("Error during mode update:", error);
    send(res, 500, "Server error during mode update.");
  }
};

/**
 * Delete Mode.
 */
export const deleteMode = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const mode = await ModeModel.findByIdAndDelete(req.params.modeId);

    if (!mode) {
      send(res, 404, "Mode not found.");
      return;
    }

    send(res, 200, "Mode deleted successfully.");
  } catch (error) {
    console.error("Error during mode deletion:", error);
    send(res, 500, "Server error during mode deletion.");
  }
};
