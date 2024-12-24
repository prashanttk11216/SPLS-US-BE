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
import { formatDate } from "../../utils/dateFormat";
import { ILoad } from "../../types/Load";

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
export async function createLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Validate incoming request data using Zod schema
    const validatedData = createLoadSchema.parse(req.body);

    const user = (req as Request & { user?: IUser })?.user; // Extract user data from request

    // Handle the case where the user is a customer
    if (user?.role === UserRole.CUSTOMER) {
      // Associate the load with the customer and broker (if applicable)
      validatedData.brokerId = user.brokerId;
      validatedData.customerId = user._id;

      // Validate if the customer exists and is not deleted
      const customer = await UserModel.findById(validatedData.customerId);
      if (!customer || customer.isDeleted) {
        send(res, 404, "Customer not found");
        return;
      }
    }

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

    // Set default load status for non-customer roles
    if (user?.role !== UserRole.CUSTOMER) {
      validatedData.status = LoadStatus.Published; // Brokers/Admins can publish loads
    }

    // Handle load number logic
    if (validatedData.loadNumber) {
      // Validate if the provided loadNumber already exists in the database
      const existingLoad = await LoadModel.findOne({
        loadNumber: validatedData.loadNumber,
      });
      if (existingLoad) {
        // If the loadNumber exists, suggest the next available number
        const lastLoad = await LoadModel.findOne({
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
      // Auto-generate load number if not provided
      const lastLoad = await LoadModel.findOne({
        loadNumber: { $exists: true, $ne: null },
      })
        .sort({ loadNumber: -1 })
        .select("loadNumber");

      validatedData.loadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1; // Start from 1 if no loads exist
    }

    // Create and save the new load entry
    const load = new LoadModel({ ...validatedData });
    load.age = new Date(); // Set the creation date (age) of the load

    await load.save(); // Save the load to the database

    send(res, 201, "Load created successfully", load); // Send a success response with the created load
  } catch (error) {
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
    const validatedData = updateLoadSchema.parse(req.body); // Ensure the incoming data matches the expected format

    // Step 2: Find and update the load by its ID
    const updatedLoad = await LoadModel.findByIdAndUpdate(
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
      const load = await LoadModel.findOne({ _id: loadId })
        .populate("brokerId", "company")
        .populate("postedBy");

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

    // Show only Published Loads to the Carrier
    if (user?.role === UserRole.CARRIER) {
      filters.status = LoadStatus.Published; // Only published loads for carriers
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
          "fromDate",
          "toDate",
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
        "loadNumber",
        "origin.str",
        "destination.str",
        "originEarlyPickupDate",
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

    // Handle Deadhead Origin and Destination filters
    const dhoRadius = parseFloat(req.query.dhoRadius as string) || 0; // Radius for Deadhead Origin filter
    const dhdRadius = parseFloat(req.query.dhdRadius as string) || 0; // Radius for Deadhead Destination filter
    const originLat = parseFloat(req.query.originLat as string);
    const originLng = parseFloat(req.query.originLng as string);
    const destinationLat = parseFloat(req.query.destinationLat as string);
    const destinationLng = parseFloat(req.query.destinationLng as string);

    // Fetch all loads matching base filters
    if ((originLat && originLng) || (destinationLat && destinationLng)) {
      const allLoads = await LoadModel.find(filters)
        .populate("brokerId", "company")
        .populate("postedBy", {
          firstName: 1,
          lastName: 1,
          company: 1,
          email: 1,
          primaryNumber: 1,
        })
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

        console.log(dhoDistance, dhdDistance, dhoRadius);

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

      const pagination = {
        page,
        limit,
        totalPages,
        totalCount,
      };

      send(res, 200, "Loads retrieved successfully", enhancedLoads, pagination);
      return;
    }

    // Execute the query with pagination, sorting, and populating relevant fields
    const loads = await LoadModel.find(filters)
      .populate("brokerId", "company")
      .populate("postedBy", {
        firstName: 1,
        lastName: 1,
        company: 1,
        email: 1,
        primaryNumber: 1,
      })
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    // Get total count for pagination metadata
    const totalCount = await LoadModel.countDocuments(filters);
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
 * Allow a carrier to express interest in a pending load.
 * The broker is notified via email when a carrier expresses interest.
 *
 * @param req - Express request object containing the load ID.
 * @param res - Express response object to send back results or errors.
 */
export async function requestLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    // Ensure the user is a carrier
    if (user?.role !== UserRole.CARRIER) {
      send(res, 403, "Only carriers can choose pending loads");
      return;
    }

    // Fetch the load by its ID
    const load = await LoadModel.findById(req.params.loadId).populate<{
      brokerId: IUser;
    }>("brokerId", "email");

    // Check if the load exists
    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    // Ensure the load status is "Published" before allowing the carrier to express interest
    if (load.status !== LoadStatus.Published) {
      send(res, 400, "Only Published loads can be chosen by carriers");
      return;
    }

    // Set up the email notification options
    const emailOptions: SendEmailOptions = {
      to: "avipatel4love6@gmail.com", // Send the notification to the broker's email
      subject: "Carrier Interested in Load",
      templateName: "carrierInterestedInLoad",
      templateData: {
        loadDetails: {
          loadNumber: load.loadNumber,
          origin: load.origin.str,
          destination: load.destination.str,
          originEarlyPickupDate: formatDate(load.originEarlyPickupDate, "MM/dd/yyyy"),
          originEarlyPickupTime: formatDate(load.originEarlyPickupTime!, "h:mm aa"),
          originLatePickupDate: formatDate(load.originLatePickupDate!, "MM/dd/yyyy"),
          originLatePickupTime: formatDate(load.originLatePickupTime!, "h:mm aa"),
          destionationEarlyDropoffDate: formatDate(load.destinationEarlyDropoffDate!, "MM/dd/yyyy"),
          destionationEarlyDropoffTime: formatDate(load.destinationEarlyDropoffTime!, "h:mm aa"),
          destionationLateDropoffDate: formatDate(load.destinationLateDropoffDate!, "MM/dd/yyyy"),
          destionationLateDropoffTime: formatDate(load.destinationLateDropoffTime!, "h:mm aa"),
          equipment: load.equipment,
          mode: load.mode,
          allInRate: load.allInRate,
          miles: load.miles,
        },
        carrierDetails: {
          company: user.company,
          name: user.firstName + " " +user.lastName,
          email: user.email,
          primaryNumber: user.primaryNumber,
        }
      },
    };

    // Send email notification to the broker (uncomment this when email functionality is ready)
    await sendNotificationEmail(emailOptions);

    // Respond back to the carrier confirming their interest in the load
    send(
      res,
      200,
      "Interest in the load has been submitted successfully. The broker has been notified."
    );
  } catch (error) {
    console.error(error);
    send(res, 500, "Server error");
  }
}

/**
 * Notify a customer about rate confirmation for a load.
 * Sends an email to the customer with load details and confirmed rate information.
 *
 * @param req - Express request object containing load ID and customer email(s).
 * @param res - Express response object to send back results or errors.
 */
export async function confirmRateWithCustomerHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Fetch load details and populate broker's email
    const load = await LoadModel.findById(req.params.loadId).populate<{
      brokerId: IUser;
    }>("brokerId", "email");

    // Check if the load exists
    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    // Validate that the load is in "PendingResponse" status
    if (load.status !== LoadStatus.PendingResponse) {
      send(res, 400, "Only Pending Response loads can be chosen by a Broker");
      return;
    }

    const { emails } = req.body;

    // Validate the presence and format of email addresses
    if (!emails || !Array.isArray(emails) || !emails.length || !emails[0]) {
      send(res, 400, "Customer email is required to send a notification");
      return;
    }

    // Prepare dynamic email content for the customer
    const emailOptions: SendEmailOptions = {
      to: emails[0], // Sending to the first email in the list (can be extended to multiple)
      subject: "Load Rate Confirmation",
      templateName: "loadRateConfirmation",
      templateData: {
        loadNumber: load.loadNumber || "N/A", // Load number or default if not available
        origin: load.origin || "Unknown Origin", // Load origin or default
        destination: load.destination || "Unknown Destination", // Load destination or default
        rate: load.allInRate || "N/A", // Confirmed rate or default
      },
    };

    // Send the email notification
    await sendNotificationEmail(emailOptions);

    // Respond with success
    send(
      res,
      200,
      "Rate confirmation has been submitted successfully. The customer has been notified."
    );
  } catch (error) {
    console.error("Error notifying customer:", error);
    // Respond with a server error
    send(res, 500, "An unexpected server error occurred.");
  }
}

/**
 * Notify carriers about new loads.
 * Sends load details to the specified carrier emails or all active internal carriers.
 *
 * @param req - Express request object containing load IDs, carrier emails, and internalCarrier flag.
 * @param res - Express response object to send back results or errors.
 */
export async function notifyCarrierAboutLoadHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { loadIds, emails, internalCarrier } = req.body;

    // Validate that at least one load ID is provided
    if (!loadIds || !Array.isArray(loadIds) || !loadIds.length) {
      send(res, 400, "At least one load ID is required.");
      return;
    }

    // Validate that either emails or internalCarrier is provided
    if (
      (!emails || !Array.isArray(emails) || !emails.length) &&
      !internalCarrier
    ) {
      send(
        res,
        400,
        "At least one carrier email or the internalCarrier flag is required."
      );
      return;
    }

    // Fetch load details for the provided load IDs
    const loads = await LoadModel.find({ _id: { $in: loadIds } }).populate<{
      brokerId: IUser;
    }>("brokerId", "email");

    if (!loads.length) {
      send(res, 404, "No loads found for the provided IDs.");
      return;
    }

    // Collect carrier emails
    let carrierEmails: string[] = [];

    // Add provided emails if available
    if (emails && emails.length) {
      carrierEmails.push(...emails);
    }

    // Fetch internal carriers' emails if the flag is true
    if (internalCarrier) {
      const activeCarriers = await UserModel.find(
        { role: UserRole.CARRIER, isActive: true },
        "email"
      );

      // Add internal carriers' emails, ensuring no empty values
      const internalCarrierEmails = activeCarriers
        .map((carrier) => carrier.email)
        .filter((email) => email);

      carrierEmails.push(...internalCarrierEmails);
    }

    // Remove duplicate emails
    carrierEmails = Array.from(new Set(carrierEmails));

    if (!carrierEmails.length) {
      send(res, 400, "No valid carrier emails found to notify.");
      return;
    }

    // Prepare load details for the email template
    const loadDetails = loads.map((load) => {
      const formattedLoad: any = {};
    
      // Check for each field and add it only if it has a value
      if (load.loadNumber) formattedLoad.loadNumber = load.loadNumber;
      if (load.formattedAge) formattedLoad.formattedAge = load.formattedAge; // Virtual getter for age
      if (load.origin && load.origin.str) formattedLoad.origin = load.origin.str;
      if (load.originEarlyPickupDate) formattedLoad.originEarlyPickupDate = formatDate(load.originEarlyPickupDate, "MM/dd/yyyy");
      if (load.originEarlyPickupTime) formattedLoad.originEarlyPickupTime = formatDate(load.originEarlyPickupTime, "h:mm aa");
      if (load.originLatePickupDate) formattedLoad.originLatePickupDate = formatDate(load.originLatePickupDate, "MM/dd/yyyy");
      if (load.originLatePickupTime) formattedLoad.originLatePickupTime = formatDate(load.originLatePickupTime, "h:mm aa");
    
      if (load.originStops && load.originStops.length > 0) {
        formattedLoad.originStops = load.originStops.map((stop) => {
          const stopDetails: any = {};
          if (stop.address && stop.address.str) stopDetails.address = stop.address.str;
          if (stop.earlyPickupDate) stopDetails.earlyPickupDate = formatDate(stop.earlyPickupDate, "MM/dd/yyyy");
          if (stop.latePickupDate) stopDetails.latePickupDate = formatDate(stop.latePickupDate, "MM/dd/yyyy");
          if (stop.earlyPickupTime) stopDetails.earlyPickupTime = formatDate(stop.earlyPickupTime, "h:mm aa");
          if (stop.latePickupTime) stopDetails.latePickupTime = formatDate(stop.latePickupTime, "h:mm aa");
          return stopDetails;
        });
      }
    
      if (load.destination && load.destination.str) formattedLoad.destination = load.destination.str;
      if (load.destinationEarlyDropoffDate) formattedLoad.destinationEarlyDropoffDate = formatDate(load.destinationEarlyDropoffDate, "MM/dd/yyyy");
      if (load.destinationEarlyDropoffTime) formattedLoad.destinationEarlyDropoffTime = formatDate(load.destinationEarlyDropoffTime, "h:mm aa");
      if (load.destinationLateDropoffDate) formattedLoad.destinationLateDropoffDate = formatDate(load.destinationLateDropoffDate, "MM/dd/yyyy");
      if (load.destinationLateDropoffTime) formattedLoad.destinationLateDropoffTime = formatDate(load.destinationLateDropoffTime, "h:mm aa");
    
      if (load.destinationStops && load.destinationStops.length > 0) {
        formattedLoad.destinationStops = load.destinationStops.map((stop) => {
          const stopDetails: any = {};
          if (stop.address && stop.address.str) stopDetails.address = stop.address.str;
          if (stop.earlyDropoffDate) stopDetails.earlyDropoffDate = formatDate(stop.earlyDropoffDate, "MM/dd/yyyy");
          if (stop.lateDropoffDate) stopDetails.lateDropoffDate = formatDate(stop.lateDropoffDate, "MM/dd/yyyy");
          if (stop.earlyDropoffTime) stopDetails.earlyDropoffTime = formatDate(stop.earlyDropoffTime, "h:mm aa");
          if (stop.lateDropoffTime) stopDetails.lateDropoffTime = formatDate(stop.lateDropoffTime, "h:mm aa");
          return stopDetails;
        });
      }
    
      if (load.equipment) formattedLoad.equipment = load.equipment;
      if (load.mode) formattedLoad.mode = load.mode;
      if (load.allInRate) formattedLoad.allInRate = "$"+load.allInRate;
      if (load.weight) formattedLoad.weight = (load.weight + "lbs");
      if (load.length) formattedLoad.length = (load.length + "ft");
      if (load.width) formattedLoad.width = load.width;
      if (load.height) formattedLoad.height = load.height;
      if (load.pieces) formattedLoad.pieces = load.pieces;
      if (load.pallets) formattedLoad.pallets = load.pallets;
      if (load.miles) formattedLoad.miles = load.miles;
      if (load.commodity) formattedLoad.commodity = load.commodity;
      if (load.postedBy) formattedLoad.postedBy = load.postedBy;
      if (load.specialInstructions) formattedLoad.specialInstructions = load.specialInstructions;
    
      return formattedLoad;
    });    
    
    
    // Configure email options with combined load details
    const emailOptions: SendEmailOptions = {
      to: carrierEmails,
      subject: "New Load Notifications",
      templateName: "multipleLoadNotification", // Template for multiple loads
      templateData: {
        loads: loadDetails,
      },
    };

    // Send the email to carriers
    await sendNotificationEmail(emailOptions);

    // Respond with success
    send(
      res,
      200,
      "Load notifications have been sent successfully to the carriers."
    );
  } catch (error) {
    console.error("Error notifying carriers:", error);

    // Respond with a server error
    send(res, 500, "An unexpected server error occurred.");
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
    const load = await LoadModel.findById(req.params.loadId)
      .populate<{ brokerId: IUser }>("brokerId", "email")
      .populate<{ customerId: IUser }>("customerId", "email");

    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    const currentStatus = load.status;

    // Validate the status transition
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
    const load = await LoadModel.findOneAndDelete({ _id: loadId });

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
    const loads = await LoadModel.find({ _id: { $in: ids } });

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

/**
 * Assign a carrier to a load and update its status to 'in_transit'.
 * Only brokers (admin or user) are authorized to perform this action.
 *
 * @param req - Express request object containing load and carrier IDs.
 * @param res - Express response object to send back results or errors.
 */
export async function assignLoadToCarrierHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    // Ensure the user has a broker role
    if (
      user?.role !== UserRole.BROKER_ADMIN &&
      user?.role !== UserRole.BROKER_USER
    ) {
      send(res, 403, "Only brokers can assign loads to carriers");
      return;
    }

    const { loadId, carrierId } = req.body;

    // Validate request payload
    if (!loadId || !carrierId) {
      send(res, 400, "Both load ID and carrier ID are required");
      return;
    }

    // Fetch the load
    const load = await LoadModel.findById(loadId);

    if (!load) {
      send(res, 404, "Load not found");
      return;
    }

    // Ensure the load is in the correct status
    if (load.status !== LoadStatus.Published) {
      send(res, 400, "Only pending loads can be assigned to carriers");
      return;
    }

    // Assign carrier and update load status
    load.carrierId = carrierId;
    load.status = LoadStatus.DealClosed;

    await load.save();

    // Respond with success and updated load details
    send(res, 200, "Load assigned to carrier successfully", { load });
  } catch (error) {
    console.error("Error assigning load to carrier:", error);
    send(res, 500, "An unexpected server error occurred.");
  }
}

/**
 * Retrieve the list of loads assigned to the carrier.
 * Supports pagination with `page` and `limit` query parameters.
 *
 * @param req - Express request object containing load ID and pagination parameters.
 * @param res - Express response object to send back results or errors.
 */
export async function getAssignedLoadsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    // Ensure the user is a carrier
    if (user?.role !== UserRole.CARRIER) {
      send(res, 403, "Only carriers can view their assigned loads");
      return;
    }

    // Parse pagination parameters from the query
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    // Ensure valid pagination parameters
    if (page < 1 || limit < 1) {
      send(res, 400, "Invalid pagination parameters");
      return;
    }

    const skip = (page - 1) * limit;

    // Fetch assigned loads for the carrier with pagination
    const loads = await LoadModel.find({ carrierId: user._id })
      .skip(skip)
      .limit(limit);

    // Fetch total count of assigned loads for the carrier
    const totalLoads = await LoadModel.countDocuments({ carrierId: user._id });

    // Prepare pagination metadata
    const totalPages = Math.ceil(totalLoads / limit);
    const pagination = {
      totalLoads,
      totalPages,
      currentPage: page,
      pageSize: loads.length,
    };

    // Send response with assigned loads and pagination metadata
    send(
      res,
      200,
      "Assigned loads retrieved successfully",
      { loads },
      pagination
    );
  } catch (error) {
    console.error("Error retrieving assigned loads:", error);
    send(res, 500, "An unexpected server error occurred.");
  }
}
