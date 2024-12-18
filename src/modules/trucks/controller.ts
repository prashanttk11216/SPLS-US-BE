import { Request, Response } from "express";
import { UserRole } from "../../enums/UserRole";
import send from "../../utils/apiResponse";
import { IUser } from "../../types/User";
import { TruckModal } from "./model";
import { z } from "zod";
import { SortOrder } from "mongoose";
import { createTruckSchema, updateTruckSchema } from "../../schema/Truck";
import { LoadModel } from "../load/model";

// Create Truck API
export async function createTruck(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser }).user;

    // Ensure the user is a carrier
    if (user?.role !== UserRole.CARRIER) {
      send(res, 403, "Only carriers can create trucks");
      return;
    }

    // Validate request body with Zod schema
    const validatedData = createTruckSchema.parse(req.body);
    validatedData.postedBy = user._id;
    validatedData.brokerId = user.brokerId;

    // Handle `referenceNumber` logic
    if (validatedData.referenceNumber) {
      // Check if the provided referenceNumber already exists
      const existingTruck = await TruckModal.findOne({
        referenceNumber: validatedData.referenceNumber,
      });

      if (existingTruck) {
        // Fetch the next available referenceNumber
        const lastTruck = await TruckModal.findOne({
          referenceNumber: { $exists: true, $ne: null },
        })
          .sort({ referenceNumber: -1 })
          .select("referenceNumber");

        const nextReferenceNumber = lastTruck
          ? lastTruck.referenceNumber! + 1
          : 1;

        send(
          res,
          400,
          `The provided referenceNumber is already in use. Suggested referenceNumber: ${nextReferenceNumber}`
        );
        return;
      }
    } else {
      // Auto-generate referenceNumber if not provided
      const lastTruck = await TruckModal.findOne({
        referenceNumber: { $exists: true, $ne: null },
      })
        .sort({ referenceNumber: -1 })
        .select("referenceNumber");

      validatedData.referenceNumber = lastTruck
        ? lastTruck.referenceNumber! + 1
        : 1; // Start from 1 if no trucks exist
    }

    // Create and save the new truck
    const truck = new TruckModal({ ...validatedData, age: new Date() });
    await truck.save();

    send(res, 201, "Truck created successfully", truck);
  } catch (error) {
    console.log(error);

    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid input data", { errors: error.errors });
      return;
    }

    send(res, 500, "Server error");
  }
}

// Get Truck API
export async function getTrucks(req: Request, res: Response): Promise<void> {
  try {
    const { truckId } = req.params;

    if (truckId) {
      // Fetch a single truck by its ID
      const truck = await TruckModal.findOne({ _id: truckId })
        .populate("brokerId", "company")
        .populate("postedBy", "firstName lastName email");

      if (!truck) {
        send(res, 404, "Truck not found");
        return;
      }

      send(res, 200, "Truck retrieved successfully", truck);
      return;
    }

    const user = (req as Request & { user?: IUser }).user;
    const filters: any = {};

    // Default pagination values
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Role-based query conditions
    if (user?.role === UserRole.CARRIER) {
      filters.postedBy = user._id;
    } else if (user?.role === UserRole.BROKER_ADMIN) {
      filters.brokerId = user._id;
    }

    // Date range filters
    if (req.query.fromDate || req.query.toDate) {
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : undefined;
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : undefined;

      filters.createdAt = {};

      if (fromDate) {
        filters.createdAt.$gte = fromDate; // Records on or after fromDate
      }

      if (toDate) {
        filters.createdAt.$lte = toDate; // Records on or before toDate
      }
    }

    // Additional query parameters
    const excludedFields = ["page", "limit", "sort", "fromDate", "toDate"];
    for (const [key, value] of Object.entries(req.query)) {
      if (!excludedFields.includes(key)) {
        filters[key] = value;
      }
    }

    // Sorting functionality
    const sortQuery = req.query.sort as string | undefined;
    const sortOptions: Record<string, SortOrder> = {};

    if (sortQuery) {
      const validFields = [
        "age",
        "referenceNumber",
        "origin.str",
        "destination.str",
        "originEarlyPickupDate",
        "createdAt",
        "miles",
        "allInRate",
      ];

      sortQuery.split(",").forEach((field) => {
        const [key, order] = field.split(":");
        if (validFields.includes(key)) {
          sortOptions[key] = order === "desc" ? -1 : 1;
        }
      });
    }

    // Execute the query with pagination, sorting, and populating relevant fields
    const trucks = await TruckModal.find(filters)
      .populate("brokerId", "company")
      .populate("postedBy", "firstName lastName company email primaryNumber")
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    // Total count for pagination metadata
    const totalCount = await TruckModal.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / limit);

    const pagination = {
      page,
      limit,
      totalPages,
      totalCount,
    };

    send(res, 200, "Trucks retrieved successfully", trucks, pagination);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid filter parameters", { errors: error.errors });
    } else {
      send(res, 500, "Server error");
    }
  }
}

// Update Truck API
export async function updateTruck(req: Request, res: Response): Promise<void> {
  try {
    const { truckId } = req.params;
    const validatedData = updateTruckSchema.parse(req.body);

    const updatedTruck = await TruckModal.findByIdAndUpdate(
      truckId,
      validatedData,
      {
        new: true,
      }
    );
    if (!updatedTruck) {
      send(res, 404, "Truck not found");
      return;
    }
    send(res, 200, "Truck updated successfully", updatedTruck);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid input data", { errors: error.errors });
      return;
    }
    send(res, 500, "Server error");
  }
}

// Delete Truck API
export async function deleteTruck(req: Request, res: Response): Promise<void> {
  try {
    const { truckId } = req.params;

    const deletedTruck = await TruckModal.findByIdAndDelete(truckId);
    if (!deletedTruck) {
      send(res, 404, "Truck not found");
      return;
    }
    send(res, 200, "Truck deleted successfully");
  } catch (error) {
    send(res, 500, "Server error");
  }
}

// Get Matches Truck API
export async function getMatchingTrucks(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Extract loadId from request parameters
    const loadId = req.params.loadId;

    // Fetch the load details from the database
    const load = await LoadModel.findById(loadId);
    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    // Default pagination values
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Define radius in degrees (~11 km; can be adjusted as needed)
    const radiusInDegrees = 0.1;

    // Fetch matching trucks based on strict criteria
    let trucks = await TruckModal.find({
      // Match trucks near the load's origin within the specified radius
      "origin.lat": {
        $gte: load.origin.lat - radiusInDegrees,
        $lte: load.origin.lat + radiusInDegrees,
      },
      "origin.lng": {
        $gte: load.origin.lng - radiusInDegrees,
        $lte: load.origin.lng + radiusInDegrees,
      },

      // Match trucks near the load's destination within the specified radius
      "destination.lat": {
        $gte: load.destination.lat - radiusInDegrees,
        $lte: load.destination.lat + radiusInDegrees,
      },
      "destination.lng": {
        $gte: load.destination.lng - radiusInDegrees,
        $lte: load.destination.lng + radiusInDegrees,
      },

      // Exact match for equipment type (mandatory)
      equipment: load.equipment,

      // Date range matching: Check if truck's pickup window overlaps with load's
      $or: [
        {
          originEarlyPickupDate: { $lte: load.originLatePickupDate },
          originLatePickupDate: { $gte: load.originEarlyPickupDate },
        },
        {
          originEarlyPickupDate: { $gte: load.originEarlyPickupDate },
          originLatePickupDate: { $lte: load.originLatePickupDate },
        },
      ],

      // Ensure trucks can handle the load's weight and size
      weight: { $gte: load.weight },
      length: { $gte: load.length },

      // Optional: Match special instructions (case-insensitive)
      ...(load.specialInstructions && {
        specialInstructions: {
          $regex: load.specialInstructions,
          $options: "i",
        },
      }),
    })
      // Sort by proximity and pickup date for better ranking
      .sort({
        "origin.lat": 1,
        "destination.lat": 1,
        originEarlyPickupDate: 1,
      })
      // Limit the results to avoid overwhelming the response
      .skip(skip)
      .limit(limit);

    // Implement fallback search with relaxed criteria if no strict matches found
    if (trucks.length === 0) {
      trucks = await TruckModal.find({
        // Maintain equipment compatibility (non-negotiable)
        equipment: load.equipment,
        weight: { $gte: load.weight },
        length: { $gte: load.length },

        // Relaxed origin or destination matching
        $or: [
          {
            "origin.lat": {
              $gte: load.origin.lat - 2 * radiusInDegrees,
              $lte: load.origin.lat + 2 * radiusInDegrees,
            },
            "origin.lng": {
              $gte: load.origin.lng - 2 * radiusInDegrees,
              $lte: load.origin.lng + 2 * radiusInDegrees,
            },
          },
          {
            "destination.lat": {
              $gte: load.destination.lat - 2 * radiusInDegrees,
              $lte: load.destination.lat + 2 * radiusInDegrees,
            },
            "destination.lng": {
              $gte: load.destination.lng - 2 * radiusInDegrees,
              $lte: load.destination.lng + 2 * radiusInDegrees,
            },
          },
        ],
      })
        .sort({
          "origin.lat": 1,
          "destination.lat": 1,
          originEarlyPickupDate: 1,
        })
        .skip(skip)
        .limit(limit);
    }

    // Handle the scenario where no matches were found
    if (trucks.length === 0) {
      send(res, 404, "No matching trucks found");
      return;
    }

    // Total count for pagination metadata
    const totalCount = trucks.length;
    const totalPages = Math.ceil(totalCount / limit);

    const pagination = {
      page,
      limit,
      totalPages,
      totalCount,
    };

    // Send the matched trucks as the response
    send(res, 200, "Matching trucks found", trucks, pagination);
  } catch (error) {
    // Handle unexpected errors gracefully
    console.error("Error fetching matching trucks:", error);
    send(res, 500, "Server error");
  }
}
