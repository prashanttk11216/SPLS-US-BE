import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { getPaginationParams } from "../../utils/paginationUtils";
import { parseSortQuery } from "../../utils/parseSortQuery";
import { buildSearchFilter } from "../../utils/parseSearchQuerty";
import { applyPopulation } from "../../utils/populateHelper";
import { ConsigneeModel } from "./model";
import { createConsigneeSchema, updateConsigneeSchema } from "../../schema/Consignee";
import { hasAccess } from "../../utils/role";

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
      email: validatedData.email.toLowerCase(),
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
 * GET Consignee and ALL Consignee.
 */
export const getConsignee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query);
    let filters: any = { isDeleted: false };
    const user = (req as Request & { user?: IUser }).user;

    if (_id) {
      let query = ConsigneeModel.findOne({ _id, ...filters });
      query = applyPopulation(query, req.query.populate as string);
      const user = await query;

      if (!user) {
        send(res, 404, "Consignee not found");
        return;
      }

      send(res, 200, "Retrieved successfully", user);
      return;
    }

    // Role-based query conditions
    // if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_USER] })) {
    //   filters.postedBy = user._id;
    // } else 
    if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_ADMIN, UserRole.BROKER_USER] })) {
      filters.brokerId = user.brokerId;
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'skip', 'sort', 'search', 'searchField', 'populate'].includes(key)) {
        filters[key] = value;
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string; // Get the specific field to search

    if (search && searchField) {
      const numberFields = ["consignee.weight", "primaryNumber"]; // Define numeric fields
      const multiFieldMappings = { name: ["firstName", "lastName"] }; // Dynamic mapping
      filters = { ...filters, ...buildSearchFilter(search, searchField, numberFields, multiFieldMappings) };
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    const validFields = ["email", "primaryNumber", "isActive", "name", "shippingHours", "createdAt"];
    const sortOptions = parseSortQuery(sortQuery, validFields);


    // Total count and user retrieval with pagination and sorting
    const totalItems = await ConsigneeModel.countDocuments(filters);

    let query = ConsigneeModel.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    query = applyPopulation(query, req.query.populate as string); // ✅ Works with `find`
    
    const consignee = await query;


    const totalPages = Math.ceil(totalItems / limit);

    send(res, 200, "Retrieved successfully", consignee, {
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
 * Delete a Consignee (Soft delete).
 */
export const deleteConsignee = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const consignee = await ConsigneeModel.findByIdAndDelete(req.params.consigneeId);

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
      `Consignee ${consignee.isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    logger.error("Unexpected error during active status toggle:", error);
    send(res, 500, "Server error");
  }
};
