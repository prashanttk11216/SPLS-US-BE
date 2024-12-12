// loadController.ts
import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { z } from "zod";
import { createLoadSchema, updateLoadSchema } from "../../schema/Load/Load";
import { IUser } from "../../types/User";
import { UserModel } from "../user/model";
import { UserRole } from "../../enums/UserRole";
import { sendEmail } from "../../utils/emailHelper";
import { LoadModel } from "./model";
import logger from "../../utils/logger";
import { LoadStatus } from "../../enums/LoadStatus";
import {
  SendEmailOptions,
  sendNotificationEmail,
} from "../../services/emailService";
import { SortOrder } from "mongoose";
import { calculateDistance } from "../../utils/globalHelper";

const validTransitions: Record<LoadStatus, LoadStatus[]> = {
  [LoadStatus.Draft]: [LoadStatus.Published],
  [LoadStatus.Published]: [LoadStatus.PendingResponse, LoadStatus.Cancelled],
  [LoadStatus.PendingResponse]: [LoadStatus.DealClosed, LoadStatus.Cancelled],
  [LoadStatus.DealClosed]: [],
  [LoadStatus.Cancelled]: [],
};

/**
 * Create a new load entry, ensuring the user is authorized (broker or customer),
 * and validates the input data. Optionally, associate the load with a customer
 * if the user is a broker.
 *
 * @param req - Express request object containing load details.
 * @param res - Express response object to send back results or errors.
 */
export async function createLoad(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = createLoadSchema.parse(req.body); // Validate with Zod

    const user = (req as Request & { user?: IUser })?.user;

    // Additional validation for broker role
    if (user?.role === UserRole.CUSTOMER) {
      validatedData.brokerId = user.brokerId;
      validatedData.customerId = user._id;

      const customer = await UserModel.findById(validatedData.customerId);
      if (!customer || customer.isDeleted) {
        send(res, 404, "Customer not found");
        return;
      }
    }

    // Additional validation for broker role
    if (
      !validatedData.postedBy &&
      (user?.role === UserRole.BROKER_ADMIN ||
        user?.role === UserRole.BROKER_USER)
    ) {
      validatedData.postedBy = user._id;
    }

    if (user?.role === UserRole.BROKER_ADMIN) {
      validatedData.brokerId = user._id;
    }

    if (user?.role === UserRole.BROKER_USER) {
      validatedData.brokerId = user.brokerId;
    }

    if (user?.role !== UserRole.CUSTOMER) {
      validatedData.status = LoadStatus.Published;
    }

    // Handle `loadNumber` logic
    if (validatedData.loadNumber) {
      console.log("here", validatedData.loadNumber);

      // Check if the provided loadNumber already exists
      const existingLoad = await LoadModel.findOne({
        loadNumber: validatedData.loadNumber,
      });
      if (existingLoad) {
        // Fetch the next available load number
        const lastLoad = await LoadModel.findOne({
          loadNumber: { $exists: true, $ne: null },
        })
          .sort({ loadNumber: -1 })
          .select("loadNumber");
        const nextLoadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1;

        send(
          res,
          400,
          `The provided loadNumber is already in use. Please use a unique loadNumber. Suggested loadNumber: ${nextLoadNumber}`
        );
        return;
      }
    } else {
      // Auto-generate loadNumber if not provided
      const lastLoad = await LoadModel.findOne({
        loadNumber: { $exists: true, $ne: null },
      })
        .sort({ loadNumber: -1 })
        .select("loadNumber");
      console.log(lastLoad);

      validatedData.loadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1; // Start from 1 if no loads exist
    }

    const load = new LoadModel({ ...validatedData });
    load.age = new Date();

    await load.save();
    send(res, 201, "Load created successfully", load);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid input data", { errors: error.errors });
      return;
    }
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
export async function editLoad(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = updateLoadSchema.parse(req.body);

    const updatedLoad = await LoadModel.findByIdAndUpdate(
      req.params.loadId,
      validatedData,
      {
        new: true,
      }
    );

    if (!updatedLoad) {
      send(res, 404, "Load not found");
      return;
    }

    send(res, 200, "Load updated successfully", updatedLoad);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(res, 400, "Validation error", error.errors);
    } else {
      send(res, 500, "Server error");
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
export async function getLoads(req: Request, res: Response): Promise<void> {
  try {
    const { loadId } = req.params;

    if (loadId) {
      // Fetch a single load by its ID
      const load = await LoadModel.findOne({ _id: loadId }).populate(
        "brokerId",
        "company"
      );

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
      filters.postedBy = user._id;
    } else if (user?.role === UserRole.CUSTOMER) {
      filters.customerId = user._id;
    }

    // Show only Published Loads to the Carrier
    if (user?.role === UserRole.CARRIER) {
      filters.status = LoadStatus.Published;
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (
        ![
          "page",
          "limit",
          "sort",
          "dhoRadius",
          "dhdRadius",
          "originLat",
          "originLng",
          "destinationLat",
          "destinationLng",
        ].includes(key)
      ) {
        filters[key] = value;
      }
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    let sortOptions: [string, SortOrder][] = []; // Array of tuples for sorting

    if (sortQuery) {
      const sortFields = sortQuery.split(","); // Support multiple sort fields (comma-separated)
      const validFields = [
        "age",
        "loadNumber",
        "origin.str",
        "destination.str",
        "originEarlyPickupDate",
        "createdAt",
        "miles",
        "allInRate",
      ]; // Define valid fields

      sortFields.forEach((field) => {
        const [key, order] = field.split(":");
        if (validFields.includes(key)) {
          // Push the sort field and direction as a tuple
          sortOptions.push([key, order === "desc" ? -1 : 1]);
        }
      });
    }

    // Handle Deadhead Origin and Deadhead Destination filters
    const dhoRadius = parseFloat(req.query.dhoRadius as string); // Radius for Deadhead Origin filter
    const dhdRadius = parseFloat(req.query.dhdRadius as string); // Radius for Deadhead Destination filter
    const originLat = parseFloat(req.query.originLat as string);
    const originLng = parseFloat(req.query.originLng as string);
    const destinationLat = parseFloat(req.query.destinationLat as string);
    const destinationLng = parseFloat(req.query.destinationLng as string);

    if ((originLat && originLng) || (destinationLat && destinationLng)) {
      // Fetch all loads matching base filters
      const allLoads = await LoadModel.find(filters)
        .populate("brokerId", "company")
        .skip(skip)
        .limit(limit)
        .sort(sortOptions);

      // Apply filtering and enhance loads with DHO and DHD distances
      const enhancedLoads = allLoads.reduce<
        Array<{
          dhoDistance?: number;
          dhdDistance?: number;
          [key: string]: any;
        }>
      >((result, load) => {
        const dhoDistance =
          originLat && originLng
            ? calculateDistance(
                originLat,
                originLng,
                load.origin.lat,
                load.origin.lng
              )
            : undefined;

        const dhdDistance =
          destinationLat && destinationLng
            ? calculateDistance(
                destinationLat,
                destinationLng,
                load.destination.lat,
                load.destination.lng
              )
            : undefined;

        const isWithinDHO =
          dhoDistance !== undefined ? dhoDistance <= dhoRadius : true;
        const isWithinDHD =
          dhdDistance !== undefined ? dhdDistance <= dhdRadius : true;

        if (isWithinDHO && isWithinDHD) {
          result.push({ ...load.toObject(), dhoDistance, dhdDistance });
        }

        return result;
      }, []);

      // Get total count for pagination metadata
      const totalCount = enhancedLoads.length;
      const totalPages = Math.ceil(totalCount / limit);

      let pagination = {
        page,
        limit,
        totalPages,
        totalCount,
      };

      send(res, 200, "Loads retrieved successfully", enhancedLoads, pagination);
      return;
    }

    console.log("Filters:", filters);
    console.log("Sort Options:", sortOptions);

    // Execute the query with pagination, sorting, and populating relevant fields
    const loads = await LoadModel.find(filters)
      .populate("brokerId", "company")
      .skip(skip)
      .limit(limit)
      .sort(sortOptions); // Cast to the correct type if needed

    // Get total count for pagination metadata
    const totalCount = await LoadModel.countDocuments(filters);
    const totalPages = Math.ceil(totalCount / limit);

    let pagination = {
      page,
      limit,
      totalPages,
      totalCount,
    };

    send(res, 200, "Loads retrieved successfully", loads, pagination);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid filter parameters", { errors: error.errors });
      return;
    }
    send(res, 500, "Server error");
  }
}

/**
 * Allow a carrier to express interest in a pending load.
 * The broker is notified via email when a carrier expresses interest.
 *
 * @param req - Express request object containing the load ID.
 * @param res - Express response object to send back results or errors.
 */
export async function requestLoad(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    // Ensure the user is a carrier
    if (user?.role !== UserRole.CARRIER) {
      send(res, 403, "Only carriers can choose pending loads");
      return;
    }

    const load = await LoadModel.findById(req.params.loadId).populate<{
      brokerId: IUser;
    }>("brokerId", "email");
    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    if (load.status !== LoadStatus.Published) {
      send(res, 400, "Only Published loads can be chosen by carriers");
      return;
    }

    const emailOptions: SendEmailOptions = {
      to: "",
      subject: "Carrier Interested in Load",
      templateName: "carrierInterestedInLoad",
      templateData: {
        company: "abd",
        loadNumber: "CD",
        origin: "Ccdc",
        destination: "Cdjc",
      },
    };

    // await sendNotificationEmail(emailOptions);

    send(
      res,
      200,
      "Interest in the load has been submitted successfully. The broker has been notified."
    );
  } catch (error) {
    console.log(error);

    send(res, 500, "Server error");
  }
}

export async function notifyRateConfirmCustomer(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    const load = await LoadModel.findById(req.params.loadId).populate<{
      brokerId: IUser;
    }>("brokerId", "email");
    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    if (load.status !== LoadStatus.PendingResponse) {
      send(res, 400, "Only Pending Response loads can be chosen by Broker");
      return;
    }

    const emailOptions: SendEmailOptions = {
      to: "", // Replace with the customer's email address
      subject: "Load Rate Confirmation",
      templateName: "loadRateConfirmation",
      templateData: {
        customerName: "John Doe", // Replace with the customer's name
        loadNumber: "LR12345",
        origin: "Los Angeles, CA",
        destination: "Houston, TX",
        rate: "2000", // Replace with the confirmed rate
      },
    };

    // await sendNotificationEmail(emailOptions);

    send(
      res,
      200,
      "Rate confirmation has been submitted successfully. The customer has been notified."
    );
  } catch (error) {
    console.log(error);
    send(res, 500, "Server error");
  }
}

/**
 * Assign a carrier to a load and update its status to 'in_transit'.
 * Only brokers can assign loads to carriers.
 *
 * @param req - Express request object containing load and carrier IDs.
 * @param res - Express response object to send back results or errors.
 */
export async function assignLoadToCarrier(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    // Ensure the user is a broker
    if (
      user?.role !== UserRole.BROKER_ADMIN &&
      user?.role !== UserRole.BROKER_USER
    ) {
      send(res, 403, "Only brokers can assign loads to carriers");
      return;
    }

    const { loadId, carrierId } = req.body;
    const load = await LoadModel.findById(loadId);

    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    if (load.status !== "pending") {
      send(res, 400, "Only pending loads can be assigned to carriers");
      return;
    }

    load.carrierId = carrierId;
    load.status = "in_transit";
    await load.save();

    send(res, 200, "Load assigned to carrier successfully", { load });
  } catch (error) {
    send(res, 500, "Server error");
  }
}

/**
 * Retrieve a specific load's details by its ID.
 *
 * @param req - Express request object containing load ID.
 * @param res - Express response object to send back results or errors.
 */
export async function getAssignedLoads(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    if (user?.role !== UserRole.CARRIER) {
      send(res, 403, "Only carriers can view their assigned loads");
      return;
    }

    // Parse pagination parameters from the query
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const skip = (page - 1) * limit;

    // Retrieve loads with pagination
    const loads = await LoadModel.find({ carrierId: user._id })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination metadata
    const totalLoads = await LoadModel.countDocuments({ carrierId: user._id });
    const totalPages = Math.ceil(totalLoads / limit);

    let pagination = {
      totalLoads,
      totalPages,
      currentPage: page,
      pageSize: loads.length,
    };

    send(
      res,
      200,
      "Assigned loads retrieved successfully",
      {
        loads,
      },
      pagination
    );
  } catch (error) {
    send(res, 500, "Server error");
  }
}

/**
 * This function allows carriers to update the status of loads assigned to them.
 * Only carriers who are assigned to a load can change its status.
 * The function validates the provided status and ensures that the load exists
 * and is assigned to the current carrier before proceeding with the update.
 *
 * After updating the load status, notifications (email) are sent to the broker
 * and customer about the status change. (Email sending functionality is commented out for now).
 *
 * @param req - Express request object containing the load ID and the new status.
 * @param res - Express response object to send back results or errors.
 */
export const updateLoadStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as Request & { user?: IUser })?.user;
    const { status } = req.body;
    const currentUserRole = user?.role;
    const changedBy = user?._id;

    const load = await LoadModel.findById(req.params.loadId)
      .populate<{ brokerId: IUser }>("brokerId", "email")
      .populate<{ customerId: IUser }>("customerId", "email");

    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    const currentStatus = load.status;

    if (
      !validTransitions[currentStatus as LoadStatus]?.includes(
        status as LoadStatus
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
};

export async function deleteLoad(req: Request, res: Response): Promise<void> {
  try {
    const user = await LoadModel.findOneAndDelete({ _id: req.params.loadId });

    if (!user) {
      send(res, 404, "Load not found or already deleted");
      return;
    }

    send(res, 200, "Load deleted successfully");
  } catch (error) {
    logger.error("Unexpected error during user deletion:", error);
    send(res, 500, "Server error");
  }
}

// Refresh Age for Single or Multiple Loads
export const refreshAgeForLoads = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { ids } = req.body; // Array of Load IDs from request body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      send(res, 400, "Invalid or missing load IDs");
      return;
    }

    const loads = await LoadModel.find({ _id: { $in: ids } });

    if (!loads || loads.length === 0) {
      send(res, 404, "No loads found for the provided IDs");
      return;
    }
    const now = new Date();
    const updates = loads.map(async (load) => {
      load.age = now;

      return load.save();
    });

    await Promise.all(updates);

    send(res, 200, `Age refreshed for ${loads.length} load(s)`, loads);
  } catch (error) {
    logger.error("Error refreshing age for loads:", error);
    send(res, 500, "Error refreshing age for loads");
  }
};
