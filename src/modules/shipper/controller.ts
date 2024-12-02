import { Request, Response } from "express";
import { ShipperModel } from "./model";
import { createShipperSchema, updateShipperSchema } from "../../schema/Shipper";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { SortOrder } from "mongoose";


/**
 * Create a new Shipper.
 */
export const createShipper = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createShipperSchema.parse(req.body);

    // Check for duplicate email
    const existingShipper = await ShipperModel.findOne({
      email: validatedData.email,
    });
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


// Get Shipper
export async function getShipper(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const user = await ShipperModel.findOne({
        _id,
        isDeleted: false,
      });

      if (!user) {
        send(res, 404, "Shipper not found");
        return;
      }

      send(res, 200, "Retrieved successfully", user);
      return;
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Role filter
    const filters: any = { isDeleted: false };

    const brokerId = req.query.brokerId;
    if (brokerId) {
      filters.brokerId = brokerId;
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'brokerId', 'sortBy', 'sortOrder', 'search'].includes(key)) {
        filters[key] = value;
      }
    }

    // Search functionality
    const search = req.query.search as string;
    if (search) {
      filters.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Sorting parameters
    const sortBy = (req.query.sortBy as string) || "createdAt"; // Default to sorting by createdAt
    const sortOrder: SortOrder = req.query.sortOrder === "desc" ? -1 : 1; // Default to ascending order

    const sortOptions: { [key: string]: SortOrder } = { [sortBy]: sortOrder };

    // Total count and user retrieval with pagination and sorting
    const totalItems = await ShipperModel.countDocuments(filters);
    const users = await ShipperModel.find(filters)
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort(sortOptions); // Apply sorting

    const totalPages = Math.ceil(totalItems / limit);

    send(res, 200, "Retrieved successfully", users, {
      page,
      limit,
      totalPages,
      totalItems,
    });
  } catch (error) {
    send(res, 500, "Server error");
  }
}


/**
 * Edit an existing Shipper.
 */
export const editShipper = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const validatedData = updateShipperSchema.parse(req.body);

    // Find and update the shipper
    const updatedShipper = await ShipperModel.findByIdAndUpdate(
      req.params.shipperId,
      validatedData,
      {
        new: true,
        runValidators: true,
      }
    );

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
export const deleteShipper = async (
  req: Request,
  res: Response
): Promise<void> => {
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
export const toggleActiveShipper = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const shipper = await ShipperModel.findById(req.params.shipperId);

    if (!shipper) {
      send(res, 404, "Shipper not found.");
      return;
    }

    shipper.isActive = !shipper.isActive;
    await shipper.save();

    send(
      res,
      200,
      `Shipper ${shipper.isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    logger.error("Unexpected error during active status toggle:", error);
    send(res, 500, "Server error");
  }
};
