import { Request, Response } from "express";
import { ConsigneeModel } from "./model";
import {
  createConsigneeSchema,
  updateConsigneeSchema,
} from "../../schema/Consignee";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { SortOrder } from "mongoose";
import { escapeAndNormalizeSearch } from "../../utils/regexHelper";

/**
 * Get all Consignees with optional filters, pagination, and sorting.
 */
export async function getConsignee(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const user = await ConsigneeModel.findOne({
        _id,
        isDeleted: false,
      });

      if (!user) {
        send(res, 404, "Consignee not found");
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
      const escapedSearch = escapeAndNormalizeSearch(search);
      filters.$or = [
        { firstName: { $regex: escapedSearch, $options: "i" } },
        { lastName: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    // Sorting parameters
    const sortBy = (req.query.sortBy as string) || "createdAt"; // Default to sorting by createdAt
    const sortOrder: SortOrder = req.query.sortOrder === "desc" ? -1 : 1; // Default to ascending order

    const sortOptions: { [key: string]: SortOrder } = { [sortBy]: sortOrder };

    // Total count and user retrieval with pagination and sorting
    const totalItems = await ConsigneeModel.countDocuments(filters);
    const users = await ConsigneeModel.find(filters)
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
 * Create a new Consignee.
 */
export const createConsignee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const validatedData = createConsigneeSchema.parse(req.body);

    // Check for duplicate email
    const existingConsignee = await ConsigneeModel.findOne({
      email: validatedData.email,
    });
    if (existingConsignee) {
      send(res, 409, "Consignee with this Email is already registered.");
      return;
    }

    // Create new Consignee
    const newConsignee = await ConsigneeModel.create(validatedData);

    send(res, 201, "Consignee created successfully.", newConsignee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during consignee creation:", error.errors);
      send(res, 400);
    } else {
      logger.error("Unexpected error during consignee creation:", error);
      send(res, 500, "Server error");
    }
  }
};

/**
 * Edit an existing Consignee.
 */
export const editConsignee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Validate request body
    const validatedData = updateConsigneeSchema.parse(req.body);

    // Find and update the consignee
    const updatedConsignee = await ConsigneeModel.findByIdAndUpdate(
      req.params.consigneeId,
      validatedData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedConsignee) {
      send(res, 404, "Consignee not found.");
      return;
    }

    send(res, 200, "Consignee updated successfully.", updatedConsignee);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during consignee update:", error.errors);
      send(res, 400);
    } else {
      logger.error("Unexpected error during consignee update:", error);
      send(res, 500, "Server error");
    }
  }
};

/**
 * Delete a Consignee (Soft delete).
 */
export const deleteConsignee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const consignee = await ConsigneeModel.findByIdAndDelete(
      req.params.consigneeId
    );

    if (!consignee) {
      send(res, 404, "Consignee not found.");
      return;
    }

    send(res, 200, "Consignee deleted successfully.");
  } catch (error) {
    logger.error("Unexpected error during consignee deletion:", error);
    send(res, 500, "Server error");
  }
};

/**
 * Toggle active status for a Consignee.
 */
export const toggleActiveConsignee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const consignee = await ConsigneeModel.findById(req.params.consigneeId);

    if (!consignee) {
      send(res, 404, "Consignee not found.");
      return;
    }

    consignee.isActive = !consignee.isActive;
    await consignee.save();

    send(
      res,
      200,
      `Consignee ${
        consignee.isActive ? "activated" : "deactivated"
      } successfully`
    );
  } catch (error) {
    logger.error("Unexpected error during active status toggle:", error);
    send(res, 500, "Server error");
  }
};
