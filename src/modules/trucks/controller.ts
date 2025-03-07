import { Request, Response } from "express";
import { UserRole } from "../../enums/UserRole";
import send from "../../utils/apiResponse";
import { IUser } from "../../types/User";
import { TruckModal } from "./model";
import { z } from "zod";
import { createTruckSchema, updateTruckSchema } from "../../schema/Truck";
import { LoadModel } from "../load/model";
import { calculateDistance } from "../../utils/globalHelper";
import { ITruck } from "../../types/Truck";
import { getPaginationParams } from "../../utils/paginationUtils";
import { hasAccess } from "../../utils/role";
import { applyDateRangeFilter } from "../../utils/dateFilter";
import { buildSearchFilter } from "../../utils/parseSearchQuerty";
import { parseSortQuery } from "../../utils/parseSortQuery";

// Create Truck API
export async function createTruck(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser }).user;

    // Ensure the user is a carrier
    if (!(user && hasAccess(user.roles, { roles: [UserRole.CARRIER] }))) {
      send(res, 403, "Only carriers can create trucks");
      return;
    }

    // Validate request body with Zod schema
    const validatedData = createTruckSchema.parse(req.body);
    validatedData.postedBy = user._id;
    if(typeof user.brokerId === "string") validatedData.brokerId = user.brokerId;

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
      .populate("brokerId", "-password")
      .populate("postedBy", "-password")

      if (!truck) {
        send(res, 404, "Truck not found");
        return;
      }

      send(res, 200, "Truck retrieved successfully", truck);
      return;
    }

    const user = (req as Request & { user?: IUser }).user;
    let filters: any = {};

    const { page, limit, skip } = getPaginationParams(req.query);

    // Role-based query conditions
    if (user && hasAccess(user.roles, { roles: [UserRole.CARRIER] })) {
      filters.postedBy = user._id;
    } else if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_ADMIN] })) {
      filters.brokerId = user._id;
    }

  
    // Get query parameters
    const dateField = req.query.dateField as string;
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;

    // Apply the date range filter
    filters = applyDateRangeFilter(filters, dateField, fromDate, toDate);

  
    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string;
    if (search && searchField) {
      const numberFields = [
        "allInRate", "referenceNumber", "weight", "length"
      ]; // Define numeric fields
      filters = {
        ...filters,
        ...buildSearchFilter(search, searchField, numberFields),
      };
    }

    // Additional query parameters
    const excludedFields = ["page", "limit", "sort", "fromDate", "toDate", "dateField", "search", "searchField"];
    for (const [key, value] of Object.entries(req.query)) {
      if (!excludedFields.includes(key)) {
        filters[key] = value;
      }
    }

     // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    const validFields = [
      "age",
      "referenceNumber",
      "origin.str",
      "destination.str",
      "availableDate",
      "createdAt",
      "allInRate",
    ];
    let sortOptions; // Declare variable
    if (sortQuery) {
      sortOptions = parseSortQuery(sortQuery, validFields);
    }

    // Execute the query with pagination, sorting, and populating relevant fields
    const trucks = await TruckModal.find(filters)
      .populate("brokerId", "-password")
      .populate("postedBy", "-password")
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
      // Send a 404 response if the load is not found
      send(res, 404, "Load not found");
      return;
    }

    // Default pagination values (page 1 and limit 10)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Filters based on the load's strict matching criteria
    let filters: Record<string, any> = {
      equipment: load.equipment, // Compulsory match on equipment type
      availableDate: { $eq: load.originEarlyPickupDate }, // Match the exact pickup date
    };

    // Add weight and length conditions to $or if provided
    if (load.weight || load.length) {
      filters.$or = [];
      if (load.weight) {
        filters.$or.push({ weight: { $gte: load.weight } });
      }
      if (load.length) {
        filters.$or.push({ length: { $gte: load.length } });
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string;
    if (search && searchField) {
      const numberFields = [
        "allInRate", "referenceNumber", "weight", "length"
      ]; // Define numeric fields
      filters = {
        ...filters,
        ...buildSearchFilter(search, searchField, numberFields),
      };
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    const validFields = [
      "age",
      "referenceNumber",
      "origin.str",
      "destination.str",
      "availableDate",
      "createdAt",
      "weight",
      "length",
      "allInRate",
    ];
    let sortOptions; // Declare variable
    if (sortQuery) {
      sortOptions = parseSortQuery(sortQuery, validFields);
    }

    // Fetch matching trucks from the database based on filters
    let trucks = await TruckModal.find(filters)
      .populate("brokerId", "-password")
      .populate("postedBy", "-password")
      .sort(sortOptions)
      .skip(skip) // Pagination: skip records
      .limit(limit); // Pagination: limit number of results

    // Handle the case where no matching trucks are found
    if (trucks.length === 0) {
      send(res, 404, "No matching trucks found");
      return;
    }

    const dhoRadius = Number(req.query.dhoRadius) || 500; // Distance radius for origin (DHO)
    const dhdRadius = Number(req.query.dhdRadius) || 500; // Distance radius for destination (DHD)

    // Process the trucks to calculate distances and filter based on proximity
    const enhancedTrucks = trucks.reduce<ITruck[]>((result, truck) => {
      // Calculate the DHO distance (from load origin to truck origin)
      const dhoDistance =
        load.origin.lat && load.origin.lng
          ? calculateDistance(
              load.origin.lat,
              load.origin.lng,
              truck.origin.lat,
              truck.origin.lng
            )
          : undefined;

      // Calculate the DHD distance (from load destination to truck destination)
      const dhdDistance =
        load.destination.lat && load.destination.lng && truck?.destination?.lat && truck?.destination?.lng
          ? calculateDistance(
              load.destination.lat,
              load.destination.lng,
              truck.destination.lat,
              truck.destination.lng
            )
          : undefined;

      // Check if truck is within DHO and DHD radius
      const isWithinDHO = dhoDistance !== undefined ? dhoDistance <= dhoRadius : false;
      const isWithinDHD = dhdDistance !== undefined ? dhdDistance <= dhdRadius : false;

      console.log(dhoDistance, isWithinDHO, dhdDistance, isWithinDHD);

      // Add the truck to the result array if it matches the proximity criteria
      if (isWithinDHO) {
        result.push({ ...truck.toObject(), dhoDistance, dhdDistance });
      }

      return result;
    }, []);

    // Map trucks to set a default destination as 'anywhere' if missing
    const trucksWithDestination = enhancedTrucks.map((truck) => ({
      ...truck, // Ensure Mongoose object is converted to a plain JavaScript object
      destination: truck.destination ? truck.destination : "Anywhere", // Default destination as 'anywhere' if missing
    }));

    // Calculate total count for pagination metadata
    const totalCount = trucksWithDestination.length;
    const totalPages = Math.ceil(totalCount / limit);

    const pagination = {
      page,
      limit,
      totalPages,
      totalCount,
    };

    // Send the matched trucks as the response along with pagination metadata
    send(res, 200, "Matching trucks found", trucksWithDestination, pagination);
  } catch (error) {
    // Handle any unexpected errors gracefully and log them
    console.error("Error fetching matching trucks:", error);
    send(res, 500, "Server error");
  }
}

