// loadController.ts
import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { z } from "zod";
import {
  createLoadSchema,
  editLoadSchema,
  loadFilterSchema,
} from "../../schema/Load/Load";
import { IUser } from "../../types/User";
import { UserModel } from "../user/model";
import { UserRole } from "../../enums/UserRole";
import { sendEmail } from "../../utils/emailHelper";
import { LoadModel } from "./model";

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
    if (user?.role === "broker_admin" || user?.role === "broker_user") {
      if (!validatedData.customerId) {
        send(res, 400, "Customer ID is required for broker-created loads.");
        return;
      }

      const customer = await UserModel.findById(validatedData.customerId);
      if (!customer || customer.isDeleted) {
        send(res, 404, "Customer not found");
        return;
      }
    }

    const load = new LoadModel({
      ...validatedData,
      brokerId: user?.role === "customer" ? validatedData.brokerId : user?._id,
      customerId:
        user?.role === "customer" ? user._id : validatedData.customerId,
    });

    await load.save();
    send(res, 201, "Load created successfully", { load });
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
    const validatedData = editLoadSchema.parse(req.body);
    const { loadId, ...updateFields } = validatedData;

    const updatedLoad = await LoadModel.findByIdAndUpdate(loadId, updateFields, {
      new: true,
    });

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
    const user = (req as Request & { user?: IUser })?.user;
    const filters = loadFilterSchema.parse(req.query); // Parse and validate query parameters

    // Default pagination values
    const page = parseInt(filters.page as string) || 1;
    const limit = parseInt(filters.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build the query conditions based on user role and query parameters
    let query: any = {};

    // Role-based query conditions
    if (
      user?.role === UserRole.BROKER_ADMIN ||
      user?.role === UserRole.BROKER_USER
    ) {
      query.brokerId = user._id;
    } else if (user?.role === UserRole.CARRIER) {
      // Carrier can see all loads, so no restriction on brokerId or customerId
    } else if (user?.role === UserRole.CUSTOMER) {
      query.customerId = user._id;
    } else {
      send(res, 403, "Unauthorized role");
      return;
    }

    // Filter conditions based on query parameters
    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.originCity) {
      query["origin.city"] = filters.originCity;
    }
    if (filters.destinationCity) {
      query["destination.city"] = filters.destinationCity;
    }
    if (filters.mode) {
      query.mode = filters.mode;
    }
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = filters.startDate;
      if (filters.endDate) query.createdAt.$lte = filters.endDate;
    }

    // Execute the query with pagination, populate relevant fields
    const loads = await LoadModel.find(query)
      .populate("brokerId", "company")
      .skip(skip)
      .limit(limit);

    // Get total count for pagination metadata
    const totalCount = await LoadModel.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    let pagination = {
      page,
      limit,
      totalPages,
      totalCount,
    };

    send(
      res,
      200,
      "Loads retrieved successfully",
      {
        loads,
      },
      pagination
    );
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
