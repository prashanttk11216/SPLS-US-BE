import { Request, Response } from "express";
import { ShipperModel } from "./model";
import { createShipperSchema, updateShipperSchema } from "../../schema/Shipper";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";

/**
 * Create a new Shipper.
 */
export const createShipper = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createShipperSchema.parse(req.body);

    // Check for duplicate email
    const existingShipper = await ShipperModel.findOne({ email: validatedData.email });
    if (existingShipper) {
      send(res, 409, "Shipper with this Email is already registered.");
      return;
    }

    // Create new Shipper
    const newShipper = await ShipperModel.create(validatedData);

    send(res, 201, "Shipper created successfully.", newShipper);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during shipper creation:", error.errors);
      send(res, 400);
    } else {
      logger.error("Unexpected error during shipper creation:", error);
      send(res, 500, "Server error");
    }
  }
};

/**
 * Edit an existing Shipper.
 */
export const editShipper = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const validatedData = updateShipperSchema.parse(req.body);

    // Find and update the shipper
    const updatedShipper = await ShipperModel.findByIdAndUpdate(req.params.shipperId, validatedData, {
      new: true,
      runValidators: true,
    });

    if (!updatedShipper) {
      send(res, 404, "Shipper not found.");
      return;
    }

    send(res, 200, "Shipper updated successfully.", updatedShipper);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during shipper update:", error.errors);
      send(res, 400);
    } else {
      logger.error("Unexpected error during shipper update:", error);
      send(res, 500, "Server error");
    }
  }
};

/**
 * Delete a Shipper (Soft delete).
 */
export const deleteShipper = async (req: Request, res: Response): Promise<void> => {
  try {
    const shipper = await ShipperModel.findByIdAndDelete(req.params.shipperId);

    if (!shipper) {
      send(res, 404, "Shipper not found.");
      return;
    }

    send(res, 200, "Shipper deleted successfully.");
  } catch (error) {
    logger.error("Unexpected error during shipper deletion:", error);
    send(res, 500, "Server error");
  }
};

/**
 * Toggle active status for a Shipper.
 */
export const toggleActiveShipper = async (req: Request, res: Response): Promise<void> => {
  try {
    const shipper = await ShipperModel.findById(req.params.shipperId);

    if (!shipper) {
      send(res, 404, "Shipper not found.");
      return;
    }

    shipper.isActive = !shipper.isActive;
    await shipper.save();

    send(res,200,`Shipper ${shipper.isActive ? "activated" : "deactivated"} successfully`);
  } catch (error) {
    logger.error("Unexpected error during active status toggle:", error);
    send(res, 500, "Server error");
  }
};
