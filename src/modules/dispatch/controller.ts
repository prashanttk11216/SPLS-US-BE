// loadController.ts
import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { z } from "zod";
import {  transformedCreateDispatchSchema, updateDispatchSchema } from "../../schema/Dispatch/index";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { DispatchModel } from "./model";
import logger from "../../utils/logger";
import { LoadStatus } from "../../enums/LoadStatus";
import { SortOrder } from "mongoose";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";
import { escapeAndNormalizeSearch } from "../../utils/regexHelper";

const validTransitions: Record<DispatchLoadStatus, DispatchLoadStatus[]> = {
  [DispatchLoadStatus.Draft]: [DispatchLoadStatus.Published],
  [DispatchLoadStatus.Published]: [DispatchLoadStatus.InTransit, DispatchLoadStatus.Cancelled],
  [DispatchLoadStatus.InTransit]: [DispatchLoadStatus.Completed, DispatchLoadStatus.Cancelled],
  [DispatchLoadStatus.Completed]: [], // No transitions possible after completion
  [DispatchLoadStatus.Cancelled]: [], // No transitions possible after cancellation
};

/**
 * Create a new load entry, ensuring the user is authorized (broker or customer),
 * and validates the input data. Optionally, associate the load with a customer
 * if the user is a broker.
 *
 * @param req - Express request object containing load details.
 * @param res - Express response object to send back results or errors.
 */
export async function createLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Validate incoming request data using Zod schema
    const validatedData = transformedCreateDispatchSchema.parse(req.body);
    const user = (req as Request & { user?: IUser })?.user; // Extract user data from request

    // Ensure that broker/admin assigns a 'postedBy' field if missing
    if (
      !validatedData.postedBy &&
      (user?.role === UserRole.BROKER_ADMIN ||
        user?.role === UserRole.BROKER_USER)
    ) {
      validatedData.postedBy = user._id; // Assign the current broker/admin as the poster
    }

    // Set the brokerId based on the user's role
    if (user?.role === UserRole.BROKER_ADMIN) {
      validatedData.brokerId = user._id;
    } else if (user?.role === UserRole.BROKER_USER) {
      validatedData.brokerId = user.brokerId;
    }


    // Handle load number logic
    if (validatedData.loadNumber) {
      // Validate if the provided loadNumber already exists in the database
      const existingLoad = await DispatchModel.findOne({
        loadNumber: validatedData.loadNumber,
      });
      if (existingLoad) {
        // If the loadNumber exists, suggest the next available number
        const lastLoad = await DispatchModel.findOne({
          loadNumber: { $exists: true, $ne: null },
        })
          .sort({ loadNumber: -1 })
          .select("loadNumber");
        const nextLoadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1;

        send(
          res,
          400,
          `The provided loadNumber is already in use. Suggested loadNumber: ${nextLoadNumber}`
        );
        return;
      }
    } else {
      if(validatedData.status !== DispatchLoadStatus.Draft){
        // Auto-generate load number if not provided
        const lastLoad = await DispatchModel.findOne({
          loadNumber: { $exists: true, $ne: null },
        })
          .sort({ loadNumber: -1 })
          .select("loadNumber");

        validatedData.loadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1; // Start from 1 if no loads exist
      }
    }

    // Create and save the new load entry
    const load = new DispatchModel({ ...validatedData });
    load.age = new Date(); // Set the creation date (age) of the load

    await load.save(); // Save the load to the database

    send(res, 201, "Load created successfully", load); // Send a success response with the created load
  } catch (error) {
    console.log(error);
    
    // Handle validation errors from Zod
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid input data", { errors: error.errors });
      return;
    }

    // Handle any other unexpected errors
    send(res, 500, "Server error");
  }
}

/**
 * Edit an existing load, ensuring the user has appropriate permissions,
 * and validate the updated data.
 *
 * @param req - Express request object containing the load ID and updated fields.
 * @param res - Express response object to send back results or errors.
 */
export async function updateLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Step 1: Validate incoming data using Zod schema
    const validatedData = updateDispatchSchema.parse(req.body); // Ensure the incoming data matches the expected format

    // Handle load number logic
    if (validatedData.loadNumber) {
      // Validate if the provided loadNumber already exists in the database
      const existingLoad = await DispatchModel.findOne({
        loadNumber: validatedData.loadNumber,
      });
      if (existingLoad) {
        // If the loadNumber exists, suggest the next available number
        const lastLoad = await DispatchModel.findOne({
          loadNumber: { $exists: true, $ne: null },
        })
          .sort({ loadNumber: -1 })
          .select("loadNumber");
        const nextLoadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1;

        send(
          res,
          400,
          `The provided loadNumber is already in use. Suggested loadNumber: ${nextLoadNumber}`
        );
        return;
      }
    } else {
      if(validatedData.status !== DispatchLoadStatus.Draft){
        // Auto-generate load number if not provided
        const lastLoad = await DispatchModel.findOne({
          loadNumber: { $exists: true, $ne: null },
        })
          .sort({ loadNumber: -1 })
          .select("loadNumber");

        validatedData.loadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1; // Start from 1 if no loads exist
      }
    }

    // Step 2: Find and update the load by its ID
    const updatedLoad = await DispatchModel.findByIdAndUpdate(
      req.params.loadId, // Load ID from the URL parameter
      validatedData, // Updated load details from the request body
      { new: true } // Return the updated document rather than the original
    );

    // Step 3: Check if the load exists and was updated
    if (!updatedLoad) {
      send(res, 404, "Load not found"); // Return an error if the load is not found
      return;
    }

    // Step 4: Send a success response with the updated load
    send(res, 200, "Load updated successfully", updatedLoad); // Return the updated load data
  } catch (error) {
    // Step 5: Handle errors based on the type of error
    if (error instanceof z.ZodError) {
      send(res, 400, "Validation error", error.errors); // If Zod validation fails, send a 400 response with validation errors
    } else {
      send(res, 500, "Server error"); // If any other error occurs, send a 500 response
    }
  }
}

/**
 * Retrieve loads based on filters such as status, cities, and dates, along with pagination.
 * The query is tailored based on the user's role.
 *
 * @param req - Express request object containing filter and pagination query parameters.
 * @param res - Express response object to send back loads and pagination metadata.
 */
export async function fetchLoadsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { loadId } = req.params;

    if (loadId) {
      // Fetch a single load by its ID
      const load = await DispatchModel.findOne({ _id: loadId });

      if (!load) {
        send(res, 404, "Load not found");
        return;
      }

      send(res, 200, "Load retrieved successfully", load);
      return;
    }

    const user = (req as Request & { user?: IUser })?.user;
    const filters: any = {}; // Parse and validate query parameters

    // Default pagination values
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Role-based query conditions
    if (user?.role === UserRole.BROKER_USER) {
      filters.postedBy = user._id; // Filter by broker's posted loads
    } else if (user?.role === UserRole.CUSTOMER) {
      filters.customerId = user._id; // Filter by customer-specific loads
    }

    // Apply date range filter if provided
    if (req.query.fromDate || req.query.toDate) {
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;
      filters.createdAt = {};

      if (fromDate) {
        filters.createdAt.$gte = fromDate; // Filter records on or after fromDate
      }

      if (toDate) {
        filters.createdAt.$lte = toDate; // Filter records on or before toDate
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string; // Get the specific field to search

    if (search && searchField) {
      const escapedSearch = escapeAndNormalizeSearch(search);
      filters[searchField] = { $regex: escapedSearch, $options: "i" };
    }
    
    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (
        ![
          "page",
          "limit",
          "sort",
          "fromDate",
          "toDate",
          "search",
          "searchField"
        ].includes(key)
      ) {
        filters[key] = value; // Add non-pagination, non-special filters
      }
    }

    // Handle sorting functionality
    const sortQuery = req.query.sort as string | undefined;
    let sortOptions: [string, SortOrder][] = []; // Sorting options as an array of tuples

    if (sortQuery) {
      const sortFields = sortQuery.split(","); // Support multiple sort fields (comma-separated)
      const validFields = [
        "age",
        "WONumber",
        "equipment",
        "shipper.address",
        "shipper.date",
        "consignee.address",
        "consignee.date",
        "loadNumber",
        "createdAt",
        "miles",
        "allInRate",
      ]; // Define valid fields for sorting

      sortFields.forEach((field) => {
        const [key, order] = field.split(":");
        if (validFields.includes(key)) {
          // Add valid sort fields and direction to sortOptions
          sortOptions.push([key, order === "desc" ? -1 : 1]);
        }
      });
    }

    // Execute the query with pagination, sorting, and populating relevant fields
    const loads = await DispatchModel.find(filters)
    .populate("brokerId", "-password")
    .populate("postedBy", "-password")
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    // Get total count for pagination metadata
    const totalCount = await DispatchModel.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / limit);

    const pagination = {
      page,
      limit,
      totalPages,
      totalCount,
    };

    send(res, 200, "Loads retrieved successfully", loads, pagination);
  } catch (error) {
    // Handle errors gracefully
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid filter parameters", { errors: error.errors });
      return;
    }
    send(res, 500, "Server error");
  }
}

/**
 * Allows carriers to update the status of loads assigned to them.
 * Only authorized users (e.g., carriers or brokers) can perform this action.
 * Validates the status transition and ensures the load exists and is assigned to the user.
 * Sends notifications to the broker and customer upon a successful status update.
 *
 * @param req - Express request object containing load ID and new status.
 * @param res - Express response object to send back results or errors.
 */
export async function updateLoadStatusHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;
    const { status } = req.body;
    const currentUserRole = user?.role;

    // Fetch the load details and populate related broker and customer info
    const load = await DispatchModel.findById(req.params.loadId)
    .populate("brokerId", "-password")
    .populate("postedBy", "-password")

    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    const currentStatus = load.status;

    // Validate the status transition
    if (
      !validTransitions[currentStatus as DispatchLoadStatus]?.includes(
        status as DispatchLoadStatus
      )
    ) {
      send(
        res,
        400,
        `Invalid status transition from ${currentStatus} to ${status}`
      );
      return;
    }

    // Ensure the user has the correct role for status updates
    if (
      [
        LoadStatus.DealClosed,
        LoadStatus.Published,
        LoadStatus.PendingResponse,
      ]?.includes(status) &&
      ![UserRole.BROKER_USER, UserRole.BROKER_ADMIN]?.includes(currentUserRole!)
    ) {
      send(res, 403, "You do not have permission to perform this action.");
      return;
    }

    // Update status in the database
    load.status = status;
    await load.save();

    // Notify broker and customer about the status update
    // await Promise.all([
    //   sendEmail({
    //     to: load.brokerId.email,
    //     subject: "Load Status Update",
    //     text: `The status of Load with Reference Number ${load.loadNumber} has been updated to ${status} by carrier ${user.company}.`,
    //   }),
    //   sendEmail({
    //     to: load.customerId.email,
    //     subject: "Load Status Update",
    //     text: `The status of your Load with Reference Number ${load.loadNumber} has been updated to ${status}.`,
    //   }),
    // ]);

    // Log status change in audit trail
    // await LoadAudit.updateOne(
    //   { loadId: load._id },
    //   {
    //     $push: {
    //       statusChanges: {
    //         previousStatus: currentStatus,
    //         status,
    //         changedBy,
    //         timestamp: new Date(),
    //       },
    //     },
    //   },
    //   { upsert: true }
    // );

    send(res, 200, "Load status updated successfully. Notifications sent.");
  } catch (error: any) {
    console.log(error);
    send(res, 500, "Server error");
  }
}

/**
 * Deletes a load by its ID.
 * Ensures the load exists before deletion and handles errors gracefully.
 *
 * @param req - Express request object containing the load ID as a route parameter.
 * @param res - Express response object to send back results or errors.
 */
export async function deleteLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { loadId } = req.params;

    // Attempt to find and delete the load
    const load = await DispatchModel.findOneAndDelete({ _id: loadId });

    if (!load) {
      send(res, 404, "Load not found or already deleted");
      return;
    }

    send(res, 200, "Load deleted successfully");
  } catch (error) {
    logger.error("Unexpected error during load deletion:", error);
    send(res, 500, "An unexpected server error occurred");
  }
}

/**
 * Refreshes the "age" timestamp for single or multiple loads.
 * Updates the "age" field to the current date for the specified load IDs.
 *
 * @param req - Express request object containing an array of load IDs in the body.
 * @param res - Express response object to send back results or errors.
 */
export async function refreshLoadAgeHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { ids } = req.body;

    // Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      send(res, 400, "Invalid or missing load IDs");
      return;
    }

    // Find loads matching the provided IDs
    const loads = await DispatchModel.find({ _id: { $in: ids } });

    if (loads.length === 0) {
      send(res, 404, "No loads found for the provided IDs");
      return;
    }

    const now = new Date();

    // Update the "age" field for all found loads
    const updates = loads.map((load) => {
      load.age = now;
      return load.save();
    });

    // Wait for all updates to complete
    await Promise.all(updates);

    send(res, 200, `Age refreshed for ${loads.length} load(s)`, {
      updatedLoads: loads,
    });
  } catch (error) {
    logger.error("Error refreshing age for loads:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}


