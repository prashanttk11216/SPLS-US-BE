import { Request, Response } from "express";
import { ConsigneeModel } from "./model";
import {
  createConsigneeSchema,
  updateConsigneeSchema,
} from "../../schema/Consignee";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";

/**
 * Get all Consignees with optional filters, pagination, and sorting.
 */
export const getConsignee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      isActive,
      sortBy,
      sortOrder,
    } = req.query;

    // Build the query object
    const query: any = {};

    // Filter by search term (e.g., first name, last name, or email)
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: "i" } },
        { lastName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by active status (if provided)
    if (isActive !== undefined) {
      query.isActive = isActive === "true"; // Convert string to boolean
    }

    // Sorting
    const sort: any = {};
    if (sortBy && sortOrder) {
      sort[sortBy as string] = sortOrder === "asc" ? 1 : -1; // Ascending or descending order
    }

    // Pagination
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const consignees = await ConsigneeModel.find(query)
      .skip(skip)
      .limit(parseInt(limit as string))
      .sort(sort);

    const totalItems = await ConsigneeModel.countDocuments(query);
    const totalPages = Math.ceil(totalItems / parseInt(limit as string));

    // Send the response
    send(res, 200, "Consignees fetched successfully.", consignees, {
      totalItems,
      totalPages,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
    });
  } catch (error) {
    logger.error("Unexpected error during consignee fetching:", error);
    send(res, 500, "Server error");
  }
};

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
