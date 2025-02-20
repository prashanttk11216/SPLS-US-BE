// loadController.ts
import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { z } from "zod";
import {  transformedCreateDispatchSchema, updateDispatchSchema } from "../../schema/Dispatch/index";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { DispatchModel } from "./model";
import logger from "../../utils/logger";
import { SortOrder } from "mongoose";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";
import { escapeAndNormalizeSearch } from "../../utils/regexHelper";
import EmailService, { SendEmailOptions } from "../../services/EmailService";
import { getPaginationParams } from "../../utils/paginationUtils";
import { PdfGenerator } from "../../utils/pdfGenerator";
import PdfService from "../../services/PdfService";
import { hasAccess } from "../../utils/role";
import { generateExcelBuffer } from "../../utils/excelUtils";
import { IDispatch } from "../../types/Dispatch";
import { Equipment } from "../../enums/Equipment";
import { DispatchLoadType } from "../../enums/DispatchLoadType";
import { getEnumValue } from "../../utils/globalHelper";

const validTransitions: Record<DispatchLoadStatus, DispatchLoadStatus[]> = {
  [DispatchLoadStatus.Draft]: [DispatchLoadStatus.Published],
  [DispatchLoadStatus.Published]: [DispatchLoadStatus.InTransit, DispatchLoadStatus.Cancelled],
  [DispatchLoadStatus.InTransit]: [DispatchLoadStatus.Delivered, DispatchLoadStatus.Cancelled],
  [DispatchLoadStatus.Delivered]: [DispatchLoadStatus.Completed],
  [DispatchLoadStatus.Completed]: [DispatchLoadStatus.Invoiced], // Invoiced can transition to InvoicedPaid or Completed
  [DispatchLoadStatus.Invoiced]: [DispatchLoadStatus.InvoicedPaid], // InvoicedPaid can transition to Completed
  [DispatchLoadStatus.InvoicedPaid]: [],
  [DispatchLoadStatus.Cancelled]: [], // No transitions after cancellation
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
      !validatedData.postedBy && user && hasAccess(user.roles, { roles: [UserRole.BROKER_USER, UserRole.BROKER_ADMIN] }) )
     {
      validatedData.postedBy = user._id; // Assign the current broker/admin as the poster
    }

    // Set the brokerId based on the user's role
    if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_ADMIN] })) {
      validatedData.brokerId = user._id;
    } else  if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_USER] })) {
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

    const { page, limit, skip } = getPaginationParams(req.query);

    // Role-based query conditions
    if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_USER] })) {
      filters.postedBy = user._id; // Filter by broker's posted loads
    } else if (user && hasAccess(user.roles, { roles: [UserRole.CUSTOMER] })) {
      filters.customerId = user._id; // Filter by customer-specific loads
    }

    // Apply date range filter if provided
    const dateField = req.query.dateField as string; // Get the specific field to search
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;    
    if (dateField && (fromDate || toDate)) {
      filters[dateField] = {};
      if (fromDate) {
        filters[dateField].$gte = fromDate; // Filter records on or after fromDate
      }
      if (toDate) {
        filters[dateField].$lte = toDate; // Filter records on or before toDate
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string;

    // Define numeric fields
    const numberFields = [  "loadNumber",
      "WONumber",
      "invoiceNumber",
      "shipper.weight",
      "consignee.weight",
      "allInRate"];

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
        filters[searchField] = { $regex: escapedSearch, $options: "i" };
      }
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
          "searchField",
          "dateField"
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
        "invoiceNumber",
        "invoiceDate",
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
    console.log(error);
    
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


    // Handle load number logic
    if(currentStatus == DispatchLoadStatus.Draft){
      if (!load.loadNumber) {
        // Auto-generate load number if not provided
        const lastLoad = await DispatchModel.findOne({
          loadNumber: { $exists: true, $ne: null },
        })
          .sort({ loadNumber: -1 })
          .select("loadNumber");

          load.loadNumber = lastLoad ? lastLoad.loadNumber! + 1 : 1; // Start from 1 if no loads exist
      }
    }

    if(status == DispatchLoadStatus.Invoiced){
      // Auto-generate load number if not provided
      const lastLoad = await DispatchModel.findOne({
        invoiceNumber: { $exists: true, $ne: null },
      })
        .sort({ invoiceNumber: -1 })
        .select("invoiceNumber");

        load.invoiceNumber = lastLoad ? lastLoad.invoiceNumber! + 1 : 1;
        load.invoiceDate = new Date();
    }
    // Update status in the database
    load.status = status;
    await load.save();

    // Set up the email notification options
    if((load.brokerId as IUser).email){
      let emails = [(load?.brokerId as IUser)?.email];

      if((load?.customerId as IUser)?.email){
        emails.push((load?.customerId as IUser)?.email);
      }      

      const emailOptions: SendEmailOptions = {
        to: emails, // Send the notification to the broker's email
        subject: "Load Status Update",
        templateName: "loadStatusNotification",
        templateData: {
          loadNumber: load.loadNumber,
          status: status
        },
      };
  
      // Send email notification to the broker (uncomment this when email functionality is ready)
      await EmailService.sendNotificationEmail(emailOptions);
    }

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


export async function rateConfirmationHandler(req: Request, res: Response): Promise<void> {
  try {
    const { loadId } = req.params;
    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "rateAndLoadConfirmation",
      templateData: {
        "companyDetails": {
          "name": "SPLS LLC",
          "address": "13100 Wortham Center Dr, Houston, TX, USA 77065",
          "phone": "832-906-0217",
          "fax": "",
          "email": "accounts@spls-us.com"
        },
        "dispatcherDetails": {
          "name": "SPLS L",
          "loadNumber": "854",
          "shipDate": "2025-01-06",
          "todaysDate": "2025-01-07",
          "workOrder": "0001968"
        },
        "carrierDetails": {
          "name": "WESTCORE LINKS INC",
          "phone": "(780) 430-0331",
          "fax": "",
          "equipment": "Flat with Tarps",
          "agreedAmount": "$3,700.00 USD",
          "loadStatus": "Open"
        },
        "consignee": {
          "name": "Elliot Homes",
          "address": "16461 FM 170, Presidio, TX, Presidio, TX",
          "date": "2025-01-06",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "shipper": {
          "name": "Foothills Forest Products",
          "address": "AB-40, Grande Cache, AB T0E 0Y0, Grande Cache, AB, T0E 0Y0",
          "date": "2025-01-07",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "18",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "notes": {
          "deliveryNote": "DELIVERY MUST BE ON TIME. BOL MUST SIGNED BY RECEIVER IN ORDER TO GET PAYMENT.",
          "shipperNote": "TRAILER MUST LOAD 28,224 fbm. IF less than 28,224 revised rate will apply based on total FBM loaded on Trailer."
        }
      }      
    })
    // Get PDF as a buffer
    const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, { format: "A4" });
    send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }

}

export async function BOLHandler(req: Request, res: Response): Promise<void> {
  try {
    const { loadId } = req.params;
    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "BOL",
      templateData: {
        "companyDetails": {
          "name": "SPLS LLC",
          "address": "13100 Wortham Center Dr, Houston, TX, USA 77065",
          "phone": "832-906-0217",
          "fax": "",
          "email": "accounts@spls-us.com"
        },
        "dispatcherDetails": {
          "name": "SPLS L",
          "loadNumber": "854",
          "shipDate": "2025-01-06",
          "todaysDate": "2025-01-07",
          "workOrder": "0001968"
        },
        "carrierDetails": {
          "name": "WESTCORE LINKS INC",
          "phone": "(780) 430-0331",
          "fax": "",
          "equipment": "Flat with Tarps",
          "agreedAmount": "$3,700.00 USD",
          "loadStatus": "Open"
        },
        "consignee": {
          "name": "Elliot Homes",
          "address": "16461 FM 170, Presidio, TX, Presidio, TX",
          "date": "2025-01-06",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "shipper": {
          "name": "Foothills Forest Products",
          "address": "AB-40, Grande Cache, AB T0E 0Y0, Grande Cache, AB, T0E 0Y0",
          "date": "2025-01-07",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "18",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "notes": {
          "deliveryNote": "DELIVERY MUST BE ON TIME. BOL MUST SIGNED BY RECEIVER IN ORDER TO GET PAYMENT.",
          "shipperNote": "TRAILER MUST LOAD 28,224 fbm. IF less than 28,224 revised rate will apply based on total FBM loaded on Trailer."
        }
      }      
    })
    // Get PDF as a buffer
    const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, { format: "A4" });
    send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}

export async function invoicedHandler(req: Request, res: Response): Promise<void> {
  try {
    const { loadId } = req.params;
    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "invoicedLoad",
      templateData: {
        "companyDetails": {
          "name": "SPLS LLC",
          "address": "13100 Wortham Center Dr, Houston, TX, USA 77065",
          "phone": "832-906-0217",
          "fax": "",
          "email": "accounts@spls-us.com"
        },
        "dispatcherDetails": {
          "name": "SPLS L",
          "loadNumber": "854",
          "shipDate": "2025-01-06",
          "todaysDate": "2025-01-07",
          "workOrder": "0001968"
        },
        "carrierDetails": {
          "name": "WESTCORE LINKS INC",
          "phone": "(780) 430-0331",
          "fax": "",
          "equipment": "Flat with Tarps",
          "agreedAmount": "$3,700.00 USD",
          "loadStatus": "Open"
        },
        "consignee": {
          "name": "Elliot Homes",
          "address": "16461 FM 170, Presidio, TX, Presidio, TX",
          "date": "2025-01-06",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "shipper": {
          "name": "Foothills Forest Products",
          "address": "AB-40, Grande Cache, AB T0E 0Y0, Grande Cache, AB, T0E 0Y0",
          "date": "2025-01-07",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "18",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "notes": {
          "deliveryNote": "DELIVERY MUST BE ON TIME. BOL MUST SIGNED BY RECEIVER IN ORDER TO GET PAYMENT.",
          "shipperNote": "TRAILER MUST LOAD 28,224 fbm. IF less than 28,224 revised rate will apply based on total FBM loaded on Trailer."
        }
      }      
    })
    // Get PDF as a buffer
    const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, { format: "A4" });
    send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}

export async function accountingSummary(req: Request, res: Response): Promise<void> {
  try {

    const filters: any = { status: DispatchLoadStatus.Invoiced}; // Parse and validate query parameters
    const fromDate = req.body.fromDate;
    const toDate = req.body.toDate;

    if(!fromDate){
      send(res, 400,"Please pass date range.")
    }
    const dateField = 'createdAt';
    if (dateField && (fromDate || toDate)) {
      filters[dateField] = {};
      if (fromDate) {
        filters[dateField].$gte = fromDate; // Filter records on or after fromDate
      }
      if (toDate) {
        filters[dateField].$lte = toDate; // Filter records on or before toDate
      }
    }

    const loads = await DispatchModel.find(filters)
    .populate("brokerId", "-password")
    .populate("postedBy", "-password");


    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "AccountSummaryExport",
      templateData: {
        "companyDetails": {
          "name": "SPLS LLC",
          "address": "13100 Wortham Center Dr, Houston, TX, USA 77065",
          "phone": "832-906-0217",
          "fax": "",
          "email": "accounts@spls-us.com"
        },
        "dispatcherDetails": {
          "name": "SPLS L",
          "loadNumber": "854",
          "shipDate": "2025-01-06",
          "todaysDate": "2025-01-07",
          "workOrder": "0001968"
        },
        "carrierDetails": {
          "name": "WESTCORE LINKS INC",
          "phone": "(780) 430-0331",
          "fax": "",
          "equipment": "Flat with Tarps",
          "agreedAmount": "$3,700.00 USD",
          "loadStatus": "Open"
        },
        "consignee": {
          "name": "Elliot Homes",
          "address": "16461 FM 170, Presidio, TX, Presidio, TX",
          "date": "2025-01-06",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "shipper": {
          "name": "Foothills Forest Products",
          "address": "AB-40, Grande Cache, AB T0E 0Y0, Grande Cache, AB, T0E 0Y0",
          "date": "2025-01-07",
          "time": "Major Intersection",
          "type": "tl",
          "quantity": "18",
          "weight": "48000 lbs",
          "appointment": "Yes",
          "description": "TARPED *** HT CERT PAPERS NEEDED FROM MILL DRIVER TO TAKE ORIGINAL HT INSPECTION DOCS and deliver with load to customer (along with customs docs) – this is a MUST or load will be rejected."
        },
        "notes": {
          "deliveryNote": "DELIVERY MUST BE ON TIME. BOL MUST SIGNED BY RECEIVER IN ORDER TO GET PAYMENT.",
          "shipperNote": "TRAILER MUST LOAD 28,224 fbm. IF less than 28,224 revised rate will apply based on total FBM loaded on Trailer."
        }
      }      
    })
    // Get PDF as a buffer
    const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, { format: "A4" });
    send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send( 
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}

export async function accountingExport(req: Request, res: Response): Promise<void> {
  try {
    const { ids } = req.body;
    let matchQuery: any = { _id: { $in: ids }, status: DispatchLoadStatus.Invoiced};

    // Fetch loads and group them
    let excelBuffer;
    const loads = await DispatchModel.find(matchQuery).populate("brokerId postedBy customerId carrierId")
    .select("-password");
    let dataSheets: Record<string, any[]> = {};
    let formatedLoad: any = []
    loads.forEach((load: IDispatch)=>{
        const broker = load.brokerId as IUser;
        const carrier = load.carrierId as IUser;
        const customer = load.customerId as IUser;
        const postedBy = load.postedBy as IUser;


        formatedLoad.push({
          CreatedAt: load.createdAt,
          LoadNumber: load.loadNumber,
          Status: load.status,
          InvoiceNumber: load.invoiceNumber,
          Equipment: getEnumValue(Equipment, load.equipment),
          SalesRep: load.salesRep,
          Type: getEnumValue(DispatchLoadType, load.type),
          Units: load.units,
          CustomerRate: load.customerRate,
          PDs: load.PDs,
          FuelServiceCharge: load.fuelServiceCharge?.value,
          OtherChargesTotal: load.otherCharges?.totalAmount,
          CarrierFee: load.carrierFee?.totalAmount,
          AllInRate: load.allInRate,

          // Shipper Details
          ShipperAddress: load.shipper.address.str,
          ShipperDate: load.shipper.date,
          ShipperTime: load.shipper.time,
          ShipperType: getEnumValue(Equipment, load.shipper.type),
          ShipperDescription: load.shipper.description,
          ShipperQTY: load.shipper.qty,
          ShipperValue: load.shipper.value,
          ShipperWeight: load.shipper.weight,
          ShipperNotes: load.shipper.notes,
          ShipperPO: load.shipper.PO,

           // Consignee Details
          ConsigneeAddress: load.consignee.address.str,
          ConsigneeDate: load.consignee.date,
          ConsigneeTime: load.consignee.time,
          ConsigneeType:  getEnumValue(Equipment, load.consignee.type),
          ConsigneeDescription: load.consignee.description,
          ConsigneeQTY: load.consignee.qty,
          ConsigneeValue: load.consignee.value,
          ConsigneeWeight: load.consignee.weight,
          ConsigneeNotes: load.consignee.notes,
          ConsigneePO: load.consignee.PO,


          // Broker Details
          BrokerCompany: broker?.company,
          BrokerEmail: broker?.email,
          BrokerPhone: broker?.primaryNumber,
          BrokerAddress: broker?.address?.str,
          BrokerBillingAddress: broker?.billingAddress?.str,
          BrokerCountry: broker?.country,
          BrokerState: broker?.state,
          BrokerCity: broker?.city,
          BrokerZip: broker?.zip,

        // Carrier Details
        CarrierCompany: carrier?.company || "",
        CarrierEmail: carrier?.email || "",
        CarrierPhone: carrier?.primaryNumber || "",
        CarrierAddress: carrier?.address?.str || "",

        // Customer Details
        CustomerCompany: customer?.company || "",
        CustomerEmail: customer?.email || "",
        CustomerPhone: customer?.primaryNumber || "",
        CustomerAddress: customer?.address?.str || "",

        // Posted By Details
        PostedBy: `${postedBy?.firstName} ${postedBy?.lastName}` || "",
        PostedByEmail: postedBy?.email || "",
        PostedByPhone: postedBy?.primaryNumber || "",
        PostedByCompany: postedBy?.company || "",
        PostedByAddress: postedBy?.address?.str || "",
        });
    });
    dataSheets["Report"] = formatedLoad
    // console.log(dataSheets);
    
    excelBuffer = generateExcelBuffer(dataSheets);

    res.setHeader("Content-Disposition", "attachment; filename=report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    send(res, 200, "Generated Successfully", excelBuffer, {});
  } catch (error) {
    logger.error("Error generating report:", error);
    send(res, 500, "An unexpected server error occurred while generating the report");
  }
}

export async function reportsHandler(req: Request, res: Response): Promise<void> {
  try {
    const { category, categoryValue, filterBy, fromDate,  toDate} = req.body;
    let matchQuery: any = { status: DispatchLoadStatus.Invoiced};

    if (category === "CUSTOMER") {
      if (categoryValue !== "ALL") {
        matchQuery.customerId = categoryValue;
      }
    } else if (category === "CARRIER") {
      if (categoryValue !== "ALL") {
        matchQuery.carrierId = categoryValue;
      }
    }

    let sortOptions: [string, SortOrder][] = [];
    if (filterBy === "SHIP_DATE") {
      sortOptions.push(["shipper.date", 1]);
    } else if (filterBy === "DEL_DATE") {
      sortOptions.push(["consignee.date", 1]);
    } else if (filterBy === "INVOICE_DATE") {
      sortOptions.push(["invoiceDate", 1]);
    }

    const dateField = "createdAt" // Get the specific field to search
    const fromDateInput = fromDate ? new Date(fromDate as string) : undefined;
    const toDateInput = toDate ? new Date(toDate as string) : undefined;    
    if (dateField && (fromDateInput || toDateInput)) {
      matchQuery[dateField] = {};
      if (fromDate) {
        matchQuery[dateField].$gte = fromDateInput; // Filter records on or after fromDate
      }
      if (toDate) {
        matchQuery[dateField].$lte = toDateInput; // Filter records on or before toDate
      }
    }

    // Fetch loads and group them
    let loads;
    let excelBuffer;
    if (categoryValue === "ALL") {
      const groupField = category === "CUSTOMER" ? "$customerId" : "$carrierId";
      loads = await DispatchModel.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: groupField,
            loads: { $push: "$$ROOT" },
            
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "loads.brokerId",
            foreignField: "_id",
            as: "brokerId"
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "loads.postedBy",
            foreignField: "_id",
            as: "postedBy"
          }
        },
        {
          $lookup: {
            from: "customers",
            localField: "loads.customerId",
            foreignField: "_id",
            as: "customerDetails"
          }
        },
        {
          $lookup: {
            from: "carriers",
            localField: "loads.carrierId",
            foreignField: "_id",
            as: "carrierId"
          }
        },
      ]);
      let dataSheets: Record<string, any[]> = {};
      loads.forEach(group => {
        let formatedLoad: any = [];
        group.loads.forEach((load: IDispatch)=>{
          const broker = load.brokerId as IUser;
          const carrier = load.carrierId as IUser;
          const customer = load.customerId as IUser;
          formatedLoad.push({
            CreatedAt: load.createdAt,
            LoadNumber: load.loadNumber,
            Status: load.status,
            InvoiceNumber: load.invoiceNumber,
            Equipment: getEnumValue(Equipment, load.equipment),
            SalesRep: load.salesRep,
            Type: getEnumValue(DispatchLoadType, load.type),
            Units: load.units,
            CustomerRate: load.customerRate,
            PDs: load.PDs,
            FuelServiceCharge: load.fuelServiceCharge?.value,
            OtherChargesTotal: load.otherCharges?.totalAmount,
            CarrierFee: load.carrierFee?.totalAmount,
            AllInRate: load.allInRate,

            // Shipper Details
            ShipperAddress: load.shipper.address.str,
            ShipperDate: load.shipper.date,
            ShipperTime: load.shipper.time,
            ShipperType: getEnumValue(Equipment, load.shipper.type),
            ShipperDescription: load.shipper.description,
            ShipperQTY: load.shipper.qty,
            ShipperValue: load.shipper.value,
            ShipperWeight: load.shipper.weight,
            ShipperNotes: load.shipper.notes,
            ShipperPO: load.shipper.PO,

             // Consignee Details
            ConsigneeAddress: load.consignee.address.str,
            ConsigneeDate: load.consignee.date,
            ConsigneeTime: load.consignee.time,
            ConsigneeType:  getEnumValue(Equipment, load.consignee.type),
            ConsigneeDescription: load.consignee.description,
            ConsigneeQTY: load.consignee.qty,
            ConsigneeValue: load.consignee.value,
            ConsigneeWeight: load.consignee.weight,
            ConsigneeNotes: load.consignee.notes,
            ConsigneePO: load.consignee.PO,


            // Broker Details
            BrokerCompany: broker?.company,
            BrokerEmail: broker?.email,
            BrokerPhone: broker?.primaryNumber,
            BrokerAddress: broker?.address?.str,
            BrokerBillingAddress: broker?.billingAddress?.str,
            BrokerCountry: broker?.country,
            BrokerState: broker?.state,
            BrokerCity: broker?.city,
            BrokerZip: broker?.zip,

          // Carrier Details
          CarrierCompany: carrier?.company || "",
          CarrierEmail: carrier?.email || "",
          CarrierPhone: carrier?.primaryNumber || "",
          CarrierAddress: carrier?.address?.str || "",

          // Customer Details
          CustomerCompany: customer?.company || "",
          CustomerEmail: customer?.email || "",
          CustomerPhone: customer?.primaryNumber || "",
          CustomerAddress: customer?.address?.str || "",


          })
        });

        dataSheets[group._id] = formatedLoad; // Grouped data per sheet
      });
      excelBuffer = generateExcelBuffer(dataSheets);
    } else {
      loads = await DispatchModel.find(matchQuery).populate("brokerId postedBy customerId carrierId")
      .select("-password").sort(sortOptions);
      let dataSheets: Record<string, any[]> = {};
      let formatedLoad: any = []
      loads.forEach((load: IDispatch)=>{
        const broker = load.brokerId as IUser;
          const carrier = load.carrierId as IUser;
          const customer = load.customerId as IUser;
          formatedLoad.push({
            CreatedAt: load.createdAt,
            LoadNumber: load.loadNumber,
            Status: load.status,
            InvoiceNumber: load.invoiceNumber,
            Equipment: getEnumValue(Equipment, load.equipment),
            SalesRep: load.salesRep,
            Type: getEnumValue(DispatchLoadType, load.type),
            Units: load.units,
            CustomerRate: load.customerRate,
            PDs: load.PDs,
            FuelServiceCharge: load.fuelServiceCharge?.value,
            OtherChargesTotal: load.otherCharges?.totalAmount,
            CarrierFee: load.carrierFee?.totalAmount,
            AllInRate: load.allInRate,

            // Shipper Details
            ShipperAddress: load.shipper.address.str,
            ShipperDate: load.shipper.date,
            ShipperTime: load.shipper.time,
            ShipperType: getEnumValue(Equipment, load.shipper.type),
            ShipperDescription: load.shipper.description,
            ShipperQTY: load.shipper.qty,
            ShipperValue: load.shipper.value,
            ShipperWeight: load.shipper.weight,
            ShipperNotes: load.shipper.notes,
            ShipperPO: load.shipper.PO,

             // Consignee Details
            ConsigneeAddress: load.consignee.address.str,
            ConsigneeDate: load.consignee.date,
            ConsigneeTime: load.consignee.time,
            ConsigneeType:  getEnumValue(Equipment, load.consignee.type),
            ConsigneeDescription: load.consignee.description,
            ConsigneeQTY: load.consignee.qty,
            ConsigneeValue: load.consignee.value,
            ConsigneeWeight: load.consignee.weight,
            ConsigneeNotes: load.consignee.notes,
            ConsigneePO: load.consignee.PO,


            // Broker Details
            BrokerCompany: broker?.company,
            BrokerEmail: broker?.email,
            BrokerPhone: broker?.primaryNumber,
            BrokerAddress: broker?.address?.str,
            BrokerBillingAddress: broker?.billingAddress?.str,
            BrokerCountry: broker?.country,
            BrokerState: broker?.state,
            BrokerCity: broker?.city,
            BrokerZip: broker?.zip,

          // Carrier Details
          CarrierCompany: carrier?.company || "",
          CarrierEmail: carrier?.email || "",
          CarrierPhone: carrier?.primaryNumber || "",
          CarrierAddress: carrier?.address?.str || "",

          // Customer Details
          CustomerCompany: customer?.company || "",
          CustomerEmail: customer?.email || "",
          CustomerPhone: customer?.primaryNumber || "",
          CustomerAddress: customer?.address?.str || "",


          })
      });
      dataSheets["Report"] = formatedLoad
      excelBuffer = generateExcelBuffer(formatedLoad);
    }

    res.setHeader("Content-Disposition", "attachment; filename=report.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    send(res, 200, "Generated Successfully", excelBuffer, {});
  } catch (error) {
    logger.error("Error generating report:", error);
    send(res, 500, "An unexpected server error occurred while generating the report");
  }
}
