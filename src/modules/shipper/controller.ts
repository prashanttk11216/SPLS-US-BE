import { Request, Response } from "express";
import { ShipperModel } from "./model";
import { createShipperSchema, updateShipperSchema } from "../../schema/Shipper";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { getPaginationParams } from "../../utils/paginationUtils";
import { parseSortQuery } from "../../utils/parseSortQuery";
import { buildSearchFilter } from "../../utils/parseSearchQuerty";
import { applyPopulation } from "../../utils/populateHelper";

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

    const user = (req as Request & { user?: IUser })?.user;

    // Check for duplicate email
    const existingShipper = await ShipperModel.findOne({
      email: validatedData.email.toLowerCase(),
    });
    if (existingShipper) {
      send(res, 409, "Shipper with this Email is already registered.");
      return;
    }
    if (user?.role === UserRole.BROKER_ADMIN) {
      validatedData.brokerId = validatedData.postedBy = user?._id!;
    } else {
      validatedData.postedBy = user?._id!;
      validatedData.brokerId = user?.brokerId!;
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
 * GET Shipper and ALL Shipper.
 */
export const getShipper = async (req: Request, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query);
    let filters: any = { isDeleted: false };

    if (_id) {
      let query = ShipperModel.findOne({ _id, ...filters });
      query = applyPopulation(query, req.query.populate as string);
      const user = await query;

      if (!user) {
        send(res, 404, "Shipper not found");
        return;
      }

      send(res, 200, "Retrieved successfully", user);
      return;
    }

    const brokerId = req.query.brokerId;
    if (brokerId) {
      filters.brokerId = brokerId;
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'skip', 'brokerId', 'sort', 'search', 'searchField', 'populate'].includes(key)) {
        filters[key] = value;
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string; // Get the specific field to search

    if (search && searchField) {
      const numberFields = ["shipper.weight", "primaryNumber"]; // Define numeric fields
      const multiFieldMappings = { name: ["firstName", "lastName"] }; // Dynamic mapping
      filters = { ...filters, ...buildSearchFilter(search, searchField, numberFields, multiFieldMappings) };
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    const validFields = ["email", "primaryNumber", "isActive", "name", "shippingHours", "createdAt"];
    const sortOptions = parseSortQuery(sortQuery, validFields);


    // Total count and user retrieval with pagination and sorting
    const totalItems = await ShipperModel.countDocuments(filters);

    let query = ShipperModel.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    query = applyPopulation(query, req.query.populate as string); // ✅ Works with `find`
    
    const shipper = await query;


    const totalPages = Math.ceil(totalItems / limit);

    send(res, 200, "Retrieved successfully", shipper, {
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
