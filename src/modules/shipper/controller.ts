import { Request, Response } from "express";
import { ShipperModel } from "./model";
import { createShipperSchema, updateShipperSchema } from "../../schema/Shipper";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { SortOrder } from "mongoose";
import { escapeAndNormalizeSearch } from "../../utils/regexHelper";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { getPaginationParams } from "../../utils/paginationUtils";


/**
 * Create a new Shipper.
 */
export const createShipper = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = (req as Request & { user?: IUser })?.user;
    // Validate request body
    const validatedData = createShipperSchema.parse(req.body);

    // Check for duplicate email
    const existingShipper = await ShipperModel.findOne({
      email: validatedData.email.toLowerCase(),
    });
    if (existingShipper) {
      send(res, 409, "Shipper with this Email is already registered.");
      return;
    }
    if(user?.role === UserRole.BROKER_ADMIN) {
      validatedData.brokerId = validatedData.postedBy = user?._id!;
    }else{
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

    const { page, limit, skip } = getPaginationParams(req.query);

    // Role filter
    const filters: any = { isDeleted: false };

    const brokerId = req.query.brokerId;
    if (brokerId) {
      filters.brokerId = brokerId;
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'brokerId', 'sort', 'search', 'searchField'].includes(key)) {
        filters[key] = value;
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string; // Get the specific field to search

    // Define numeric fields
    const numberFields = ["shipper.weight", "primaryNumber"];

    if (search && searchField) {
      const escapedSearch = escapeAndNormalizeSearch(search);

      // Validate and apply filters based on the field type
      if (numberFields.includes(searchField)) {
        // Ensure the search value is a valid number
        const parsedNumber = Number(escapedSearch);
        if (!isNaN(parsedNumber)) {
          filters[searchField] = parsedNumber;
        } else {
          throw new Error(`Invalid number provided for field ${searchField}`);
        }
      } else {
        // Apply regex for string fields
        if(searchField == "name"){
          filters.$or = [
            { firstName: { $regex: escapedSearch, $options: "i" } },
            { lastName: { $regex: escapedSearch, $options: "i" } },
          ];
        }else{
          filters[searchField] = { $regex: escapedSearch, $options: "i" };
        }
      }
    }

   // Sort functionality
   const sortQuery = req.query.sort as string | undefined;
   let sortOptions: [string, SortOrder][] = []; // Array of tuples for sorting

   if (sortQuery) {
     const sortFields = sortQuery.split(","); // Support multiple sort fields (comma-separated)
     const validFields = [
       "email",
       "primaryNumber",
       "isActive",
       "name",
       "shippingHours",
       "createdAt"
     ]; // Define valid fields

     sortFields.forEach((field) => {
       const [key, order] = field.split(":");
       if (validFields.includes(key)) {
         // Push the sort field and direction as a tuple
         sortOptions.push([key, order === "desc" ? -1 : 1]);
       }
     });
   }

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
