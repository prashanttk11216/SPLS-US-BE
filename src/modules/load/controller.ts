// loadController.ts
import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { z } from "zod";
import {
  createLoadSchema,
  updateLoadSchema,
} from "../../schema/Load/Load";
import { IUser } from "../../types/User";
import { UserModel } from "../user/model";
import { UserRole } from "../../enums/UserRole";
import { sendEmail } from "../../utils/emailHelper";
import { LoadModel } from "./model";
import logger from "../../utils/logger";

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
      validatedData.isDaft = true;
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
      user?.role === UserRole.BROKER_ADMIN ||
      user?.role === UserRole.BROKER_USER
    ) {
      validatedData.postedBy = user._id;
    }

    if (user?.role === UserRole.BROKER_ADMIN) {
      validatedData.brokerId = user._id;
    }

    if (user?.role === UserRole.BROKER_USER) {
      validatedData.brokerId = user.brokerId;
    }

    // console.log(validatedData);

    const load = new LoadModel({ ...validatedData });

    await load.save();
    send(res, 201, "Load created successfully", load);
  } catch (error) {
    if (error instanceof z.ZodError) {
      send(res, 400, "Invalid input data", { errors: error.errors });
      return;
    }
    console.log(error);

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
    const {   loadId } = req.params;

    if (loadId) {
      // Fetch a single load by its ID
      const load = await LoadModel.findOne({ _id: loadId })
        .populate("brokerId", "company");

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
    } else if (user?.role === UserRole.CARRIER) {
      // Add any additional conditions for the carrier role here if needed
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit'].includes(key)) {
        filters[key] = value;
      }
    }

    console.log(filters);

    // Execute the query with pagination, populate relevant fields
    const loads = await LoadModel.find(filters)
      .populate("brokerId", "company")
      .skip(skip)
      .limit(limit);

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

    const { loadId } = req.body;
    const load = await LoadModel.findById(loadId).populate<{ brokerId: IUser }>(
      "brokerId",
      "email"
    );
    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    if (load.status !== "pending") {
      send(res, 400, "Only pending loads can be chosen by carriers");
      return;
    }

    // Send email notification to broker
    // await sendEmail({
    //   to: load?.brokerId?.email,
    //   subject: "Carrier Interested in Load",
    //   text: `Carrier ${user.company} is interested in Load ${load.title}. Details: ${load.origin.city} to ${load.destination.city}.`,
    // });

    send(res, 200, "Interest in load submitted successfully. Broker notified.");
  } catch (error) {
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
export async function updateLoadStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    if (user?.role !== UserRole.CARRIER) {
      send(res, 403, "Only carriers can update the status of a load");
      return;
    }

    const { loadId, status } = req.body;

    // Validate status
    if (!["in_transit", "completed"].includes(status)) {
      send(res, 400, "Invalid load status");
      return;
    }

    const load = await LoadModel.findById(loadId)
      .populate<{ brokerId: IUser }>("brokerId", "email")
      .populate<{ customerId: IUser }>("customerId", "email");

    if (!load || load.carrierId?.toString() !== user._id.toString()) {
      send(res, 404, "Load not found or not assigned to this carrier");
      return;
    }

    load.status = status;
    await load.save();

    // Notify broker and customer about the status update
    // await Promise.all([
    //   sendEmail({
    //     to: load.brokerId.email,
    //     subject: "Load Status Update",
    //     text: `The status of Load ${load.title} has been updated to ${status} by carrier ${user.company}.`,
    //   }),
    //   sendEmail({
    //     to: load.customerId.email,
    //     subject: "Load Status Update",
    //     text: `The status of your Load ${load.title} has been updated to ${status}.`,
    //   }),
    // ]);

    send(res, 200, "Load status updated successfully. Notifications sent.");
  } catch (error) {
    send(res, 500, "Server error");
  }
}


export async function deleteLoad(req: Request, res: Response): Promise<void> {
  try {
    const user = await LoadModel.findOneAndDelete({ _id: req.params.loadId});

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
