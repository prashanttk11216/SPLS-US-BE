import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { z } from "zod";
import {
  transformedCreateDispatchSchema,
  updateDispatchSchema,
} from "../../schema/Dispatch/index";
import { IUser } from "../../types/User";
import { UserRole } from "../../enums/UserRole";
import { DispatchModel } from "./model";
import logger from "../../utils/logger";
import { SortOrder } from "mongoose";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";
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
import { formatDate } from "../../utils/dateFormat";
import { formatNumber } from "../../utils/numberUtils";
import { IShipper } from "../shipper/model";
import { IConsignee } from "../consignee/model";
import { formatPhoneNumber } from "../../utils/phoneUtils";
import { LoadModel } from "../load/model";
import { parseSortQuery } from "../../utils/parseSortQuery";
import { buildSearchFilter } from "../../utils/parseSearchQuerty";
import { applyPopulation } from "../../utils/populateHelper";
import { applyDateRangeFilter } from "../../utils/dateFilter";
import path from "path";
import { pathExists, remove } from "fs-extra";
import { generatePdf } from "html-pdf-node";

const validTransitions: Record<DispatchLoadStatus, DispatchLoadStatus[]> = {
  [DispatchLoadStatus.Draft]: [DispatchLoadStatus.Published],
  [DispatchLoadStatus.Published]: [
    DispatchLoadStatus.InTransit,
    DispatchLoadStatus.Cancelled,
  ],
  [DispatchLoadStatus.InTransit]: [
    DispatchLoadStatus.Delivered,
    DispatchLoadStatus.Cancelled,
  ],
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
      if (validatedData.status !== DispatchLoadStatus.Draft) {
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
    let filters: any = {}; // Parse and validate query parameters

    if (loadId) {
      // Fetch a single load by its ID
      let query = DispatchModel.findOne({ _id: loadId, ...filters });
      query = applyPopulation(query, req.query.populate as string);
      const load = await query;

      if (!load) {
        send(res, 404, "Load not found");
        return;
      }

      send(res, 200, "Load retrieved successfully", load);
      return;
    }

    const user = (req as Request & { user?: IUser })?.user;
    const { page, limit, skip } = getPaginationParams(req.query);

    // Role-based query conditions
    if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_USER] })) {
      filters.postedBy = user._id; // Filter by broker's posted loads
    }
    if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_ADMIN] })) {
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
    const searchField = req.query.searchField as string; // Get the specific field to search

    if (search && searchField) {
      const numberFields = [
        "loadNumber",
        "WONumber",
        "invoiceNumber",
        "shipper.weight",
        "consignee.weight",
        "allInRate",
      ]; // Define numeric fields
      filters = {
        ...filters,
        ...buildSearchFilter(search, searchField, numberFields),
      };
    }

    if (req.query.isExport) {
      filters.status = {
        $in: [DispatchLoadStatus.Invoiced, DispatchLoadStatus.InvoicedPaid],
      };
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
          "dateField",
          "populate",
          "isExport",
        ].includes(key)
      ) {
        filters[key] = value; // Add non-pagination, non-special filters
      }
    }

    // Handle sorting functionality
    const sortQuery = req.query.sort as string | undefined;
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
    ];
    const sortOptions = sortQuery && parseSortQuery(sortQuery, validFields);

    // Execute the query with pagination, sorting, and populating relevant fields
    let query = DispatchModel.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    query = applyPopulation(query, req.query.populate as string);

    const loads = await query;

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
    const { status } = req.body;

    // Fetch the load details and populate related broker and customer info
    const load = await DispatchModel.findById(req.params.loadId)
      .populate("brokerId", "-password")
      .populate("postedBy", "-password");

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
    if (currentStatus == DispatchLoadStatus.Draft) {
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

    // Update the Deal load status in the database
    if (
      [
        DispatchLoadStatus.InTransit,
        DispatchLoadStatus.Delivered,
        DispatchLoadStatus.Completed,
        DispatchLoadStatus.Cancelled,
      ].includes(status)
    ) {
      if (load.loadId)
        await LoadModel.findByIdAndUpdate(load.loadId, { status: status });
    }

    // Update status in the database
    load.status = status;
    await load.save();

    // Set up the email notification options
    if ((load.brokerId as IUser).email) {
      let emails = [(load?.brokerId as IUser)?.email];

      if ((load?.customerId as IUser)?.email) {
        emails.push((load?.customerId as IUser)?.email);
      }

      const emailOptions: SendEmailOptions = {
        to: emails, // Send the notification to the broker's email
        subject: "Load Status Update",
        templateName: "loadStatusNotification",
        templateData: {
          loadNumber: load.loadNumber,
          status: status,
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

export async function rateConfirmationHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { loadId } = req.params;

    const load = await DispatchModel.findById(loadId)
      .populate([
        { path: "brokerId", select: "-password" },
        { path: "postedBy", select: "-password" },
        { path: "customerId", select: "-password" },
        { path: "carrierId", select: "-password" },
        { path: "shipper.shipperId", select: "-password" },
        { path: "consignee.consigneeId", select: "-password" },
      ])
      .lean(); // Optional: Convert to plain JavaScript object

    // Handle case when no loads are found
    if (!load) {
      send(res, 404, "No matching loads found.", null, {}, true);
      return;
    }

    const broker = load?.brokerId as IUser;
    const carrier = load?.carrierId as IUser;
    const customer = load?.customerId as IUser;
    const postedBy = load?.postedBy as IUser;
    const shipper = load?.shipper.shipperId as IShipper;
    const consignee = load?.consignee.consigneeId as IConsignee;

    const today = new Date();
    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "rateAndLoadConfirmation",
      templateData: {
        brokerDetails: {
          email: broker.email || "N/A",
          address: broker.address?.str || "N/A",
          primaryNumber: formatPhoneNumber(broker.primaryNumber),
          company: broker.company || "N/A",
          billingAddress: broker.billingAddress?.str || "N/A",
        },
        dispatcherDetails: {
          name:
            broker?.firstName || broker?.lastName
              ? `${broker?.firstName || ""} ${broker?.lastName || ""}`.trim()
              : "N/A",
          loadNumber: load?.loadNumber || "N/A",
          primaryNumber: formatPhoneNumber(broker?.primaryNumber),
          email: broker?.email || "N/A",
          shipDate: formatDate(load?.shipper?.date!, "yyyy/MM/dd") || "N/A",
          todaysDate: formatDate(today, "yyyy/MM/dd") || "N/A",
          WO: load?.WONumber || "N/A",
        },

        companyDetails: {
          company: broker?.company || "N/A",
          email: broker.email || "N/A",
          address: broker?.address?.str || "N/A",
          addressLine2: broker?.addressLine2 || "N/A",
          primaryNumber: formatPhoneNumber(broker?.primaryNumber),
        },

        carrierDetails: {
          name:
            carrier?.firstName || carrier?.lastName
              ? `${carrier?.firstName || ""} ${carrier?.lastName || ""}`.trim()
              : "N/A",
          primaryNumber: formatPhoneNumber(broker?.primaryNumber),
          equipment: getEnumValue(Equipment, load?.equipment) || "N/A",
          address: carrier?.address?.str || "N/A",
          agreedAmount: formatNumber(load?.carrierFee?.totalAmount) || "0.00",
          loadStatus: getEnumValue(DispatchLoadStatus, load?.status),
        },

        consignee: {
          name:
            consignee?.firstName || consignee?.lastName
              ? `${consignee?.firstName || ""} ${
                  consignee?.lastName || ""
                }`.trim()
              : "N/A",
          address: consignee?.address?.str || "N/A",
          primaryNumber: formatPhoneNumber(consignee?.primaryNumber),
          date: formatDate(load?.consignee?.date!, "yyyy/MM/dd") || "N/A",
          time: formatDate(load?.consignee?.time!, "h:mm aa") || "N/A",
          type: load?.consignee?.type || "N/A",
          qty: load?.consignee?.qty || "N/A",
          weight: load?.consignee?.weight
            ? load?.consignee?.weight + " lbs"
            : "N/A",
          shippingHours: consignee?.shippingHours || "N/A",
          appointment: consignee?.isAppointments ? "Yes" : "No",
          description: load?.consignee?.description || "N/A",
          notes: load?.consignee?.notes || "N/A",
        },

        shipper: {
          name:
            shipper?.firstName || shipper?.lastName
              ? `${shipper?.firstName || ""} ${shipper?.lastName || ""}`.trim()
              : "N/A",
          email: shipper?.email || "N/A",
          address: shipper?.address?.str || "N/A",
          primaryNumber: formatPhoneNumber(shipper?.primaryNumber),
          date: formatDate(load?.shipper?.date!, "yyyy/MM/dd") || "N/A",
          time: formatDate(load?.shipper?.time!, "h:mm aa") || "N/A",
          type: load?.shipper?.type || "N/A",
          qty: load?.shipper?.qty || "N/A",
          weight: load?.consignee?.weight
            ? load?.consignee?.weight + " lbs"
            : "N/A",
          shippingHours: shipper?.shippingHours || "N/A",
          appointment: shipper?.isAppointments ? "Yes" : "No",
          description: load?.shipper?.description || "N/A",
          notes: load?.shipper?.notes || "N/A",
        },

        loadDetails: {
          type: getEnumValue(DispatchLoadType, load.type),
          carrierFee: load?.carrierFee?.totalAmount
            ? `$ ${formatNumber(load.carrierFee.totalAmount)} USD`
            : "N/A",
        },
      },
    });
    // Get PDF as a buffer
    // const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, {
    //   format: "A4",
    // });
    // send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);

    let options = { format: "A4" };
    let file = { content: htmlContent };
    generatePdf(file, options, (err: Error, buffer: Buffer) => {
      if (err) {
        send(res, 200, `Generated Successfully`, null!, {}, true);
        return;
      }
      send(res, 200, `Generated Successfully`, buffer!, {}, true);
      return;
    });
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
    const { codAmount, codFee, declaredValue } = req.body;
    const { loadId } = req.params;

    const load = await DispatchModel.findById(loadId)
      .populate([
        { path: "brokerId", select: "-password" },
        { path: "postedBy", select: "-password" },
        { path: "customerId", select: "-password" },
        { path: "carrierId", select: "-password" },
        { path: "shipper.shipperId", select: "-password" },
        { path: "consignee.consigneeId", select: "-password" },
      ])
      .lean(); // Optional: Convert to plain JavaScript object

    // Handle case when no loads are found
    if (!load) {
      send(res, 404, "No matching loads found.", null, {}, true);
      return;
    }
    const broker = load?.brokerId as IUser;
    const carrier = load?.carrierId as IUser;
    const customer = load?.customerId as IUser;
    const postedBy = load?.postedBy as IUser;
    const shipper = load?.shipper.shipperId as IShipper;
    const consignee = load?.consignee.consigneeId as IConsignee;

    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "BOL",
      templateData: {
        dispatcherDetails: {
          name:
            broker?.firstName || broker?.lastName
              ? `${broker?.firstName || ""} ${broker?.lastName || ""}`.trim()
              : "N/A",
          loadNumber: load?.loadNumber || "N/A",
          shipDate: formatDate(load?.shipper.date!, "yyyy/MM/dd") || "N/A",
          delDate: formatDate(load?.consignee.date!, "yyyy/MM/dd") || "N/A",
          PO: load.shipper.PO || "N/A",
          freightCharge: "Prepaid",
        },

        companyDetails: {
          company: broker.company || "N/A",
          address: broker.address?.str || "N/A",
          country: broker?.country || "N/A",
          primaryNumber: formatPhoneNumber(broker.primaryNumber),
        },

        shipper: {
          name:
            shipper?.firstName || shipper?.lastName
              ? `${shipper?.firstName || ""} ${shipper?.lastName || ""}`.trim()
              : "N/A",
          email: shipper.email || "N/A",
          address: shipper.address.str || "N/A",
          addressLine2: shipper.addressLine2 || "N/A",
          primaryNumber: formatPhoneNumber(shipper.primaryNumber),
        },

        consignee: {
          name:
            consignee?.firstName || consignee?.lastName
              ? `${consignee?.firstName || ""} ${
                  consignee?.lastName || ""
                }`.trim()
              : "N/A",
          email: consignee.email || "N/A",
          address: consignee.address.str || "N/A",
          addressLine2: consignee.addressLine2 || "N/A",
          primaryNumber: formatPhoneNumber(consignee.primaryNumber),
        },

        carrierDetails: {
          name:
            carrier?.firstName || carrier?.lastName
              ? `${carrier?.firstName || ""} ${carrier?.lastName || ""}`.trim()
              : "N/A",
          email: carrier.email || "N/A",
          primaryNumber: formatPhoneNumber(broker.primaryNumber),
          address: carrier.address?.str || "N/A",
          addressLine2: carrier.addressLine2 || "N/A",
        },

        loadItem: {
          qty: load.shipper.qty || "N/A",
          description: load.shipper.description || "N/A",
          type: load.shipper.type || "N/A",
          weight: load?.shipper?.weight
            ? load?.shipper?.weight + " lbs"
            : "N/A",
        },

        notes: {
          shippingNote: load.shipper.notes || "N/A",
          deliveryNotes: load.consignee.notes || "N/A",
        },

        codAmount: codAmount ? formatNumber(codAmount) : "0.00",
        codFee: codFee || "N/A",
        declaredValue: declaredValue ? formatNumber(declaredValue) : "N/A",
      },
    });
    // Get PDF as a buffer
    // const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, {
    //   format: "A4",
    // });
    // send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);

    let options = { format: "A4" };
    let file = { content: htmlContent };
    generatePdf(file, options, (err: Error, buffer: Buffer) => {
      if (err) {
        send(res, 200, `Generated Successfully`, null!, {}, true);
        return;
      }
      send(res, 200, `Generated Successfully`, buffer!, {}, true);
      return;
    });
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}

export async function invoicedHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { loadId } = req.params;
    const load = await DispatchModel.findById(loadId)
      .populate([
        { path: "brokerId", select: "-password" },
        { path: "postedBy", select: "-password" },
        { path: "customerId", select: "-password" },
        { path: "carrierId", select: "-password" },
        { path: "shipper.shipperId", select: "-password" },
        { path: "consignee.consigneeId", select: "-password" },
      ])
      .lean(); // Optional: Convert to plain JavaScript object

    // Handle case when no loads are found
    if (!load) {
      send(res, 404, "No matching loads found.", null, {}, true);
      return;
    }

    let newInvoiceNumber;
    let newInvoiceDate;
    if (!(load.invoiceNumber && load.invoiceDate)) {
      // Auto-generate invoice number if not provided
      const lastLoad = await DispatchModel.findOne({
        invoiceNumber: { $exists: true, $ne: null },
      })
        .sort({ invoiceNumber: -1 })
        .select("invoiceNumber")
        .lean();

      newInvoiceNumber = lastLoad?.invoiceNumber
        ? lastLoad.invoiceNumber + 1
        : 1;
      newInvoiceDate = new Date();

      // Update load with invoice details
      await DispatchModel.findByIdAndUpdate(loadId, {
        invoiceNumber: newInvoiceNumber,
        invoiceDate: newInvoiceDate,
      });
    }

    const broker = load?.brokerId as IUser;
    const carrier = load?.carrierId as IUser;
    const customer = load?.customerId as IUser;
    const postedBy = load?.postedBy as IUser;
    const shipper = load?.shipper.shipperId as IShipper;
    const consignee = load?.consignee.consigneeId as IConsignee;

    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "invoicedLoad",
      templateData: {
        invoiceDetails: {
          loadNumber: load?.loadNumber || "N/A",
          invoiceNumber: newInvoiceNumber
            ? newInvoiceNumber
            : load.invoiceNumber || "N/A",
          invoiceDate:
            formatDate(
              newInvoiceDate ? newInvoiceDate : load.invoiceDate!,
              "yyyy/MM/dd"
            ) || "N/A",
          WONumber: load.WONumber || "N/A",
          allInRate: load?.allInRate
            ? `$ ${formatNumber(load.allInRate)} USD`
            : "$ 0.00 USD",
          type: getEnumValue(DispatchLoadType, load.type),
        },

        payableTo: {
          company: broker.company || "N/A",
          address: broker.address?.str || "N/A",
          primaryNumber: formatPhoneNumber(broker.primaryNumber),
        },

        billTo: {
          name:
            customer?.firstName || customer?.lastName
              ? `${customer?.firstName || ""} ${
                  customer?.lastName || ""
                }`.trim()
              : "N/A",
          email: shipper.email || "N/A",
          address: shipper.address.str || "N/A",
          primaryNumber: formatPhoneNumber(shipper.primaryNumber),
        },

        consignee: {
          name:
            consignee?.firstName || consignee?.lastName
              ? `${consignee?.firstName || ""} ${
                  consignee?.lastName || ""
                }`.trim()
              : "N/A",
          address: consignee.address.str || "N/A",
          primaryNumber: formatPhoneNumber(consignee.primaryNumber),
          date: formatDate(load?.consignee.date!, "yyyy/MM/dd") || "N/A",
          time: formatDate(load?.consignee.time!, "h:mm aa") || "N/A",
          type: load?.consignee.type || "N/A",
          qty: load?.consignee.qty || "N/A",
          weight: load?.consignee?.weight
            ? load?.consignee?.weight + " lbs"
            : "N/A",
          shippingHours: consignee.shippingHours || "N/A",
          appointment: consignee.isAppointments ? "Yes" : "No",
          description: load?.consignee.description || "N/A",
          notes: load?.consignee.notes || "N/A",
        },

        shipper: {
          name:
            shipper?.firstName || shipper?.lastName
              ? `${shipper?.firstName || ""} ${shipper?.lastName || ""}`.trim()
              : "N/A",
          email: shipper.email || "N/A",
          address: shipper.address.str || "N/A",
          primaryNumber: formatPhoneNumber(shipper.primaryNumber),
          date: formatDate(load?.shipper.date!, "yyyy/MM/dd") || "N/A",
          time: formatDate(load?.shipper.time!, "h:mm aa") || "N/A",
          type: load?.shipper.type || "N/A",
          qty: load?.shipper.qty || "N/A",
          weight: load?.shipper?.weight
            ? load?.shipper?.weight + " lbs"
            : "N/A",
          shippingHours: shipper.shippingHours || "N/A",
          appointment: shipper.isAppointments ? "Yes" : "No",
          description: load?.shipper.description || "N/A",
          notes: load?.shipper.notes || "N/A",
        },
      },
    });
    // Get PDF as a buffer
    // const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, {
    //   format: "A4",
    // });
    // send(res, 200, `Generated Successfully`, pdfBuffer!, {}, true);

    let options = { format: "A4" };
    let file = { content: htmlContent };
    generatePdf(file, options, (err: Error, buffer: Buffer) => {
      if (err) {
        send(res, 200, `Generated Successfully`, null!, {}, true);
        return;
      }
      send(res, 200, `Generated Successfully`, buffer!, {}, true);
      return;
    });
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}

export async function accountingSummary(
  req: Request,
  res: Response
): Promise<void> {
  try {
    let filters: any = {
      status: {
        $in: [DispatchLoadStatus.Invoiced, DispatchLoadStatus.InvoicedPaid],
      },
    }; // Parse and validate query parameters

    // Get query parameters
    const dateField = (req.body.dateField as string) || "createdAt";
    const fromDate = req.body.fromDate as string;
    const toDate = req.body.toDate as string;
    if (!fromDate) {
      send(res, 400, "Please pass date range.", null, {}, true);
      return;
    }

    // Apply the date range filter
    filters = applyDateRangeFilter(filters, dateField, fromDate, toDate);

    const loads = await DispatchModel.find(filters)
      .populate([
        { path: "brokerId", select: "-password" },
        { path: "postedBy", select: "-password" },
        { path: "customerId", select: "-password" },
        { path: "carrierId", select: "-password" },
        { path: "shipper.shipperId", select: "-password" },
        { path: "consignee.consigneeId", select: "-password" },
      ])
      .lean(); // Optional: Convert to plain JavaScript object

    // Handle case when no loads are found
    if (!loads || loads.length === 0) {
      send(res, 404, "No matching loads found.", null, {}, true);
      return;
    }

    const formatedDetails: any[] = [];

    let totalAmount = 0.0;
    loads.forEach((load) => {
      const customer = load?.customerId as IUser;

      let advance = 0.0;
      let balance: number = (load.allInRate && load.allInRate - advance) || 0.0;
      totalAmount += balance;

      formatedDetails.push({
        loadNumber: load.loadNumber,
        invoiceNumber: load.invoiceNumber,
        invoiceDate: formatDate(load?.invoiceDate!, "yyyy/MM/dd") || "N/A",
        customerName: customer?.company
          ? customer.company
          : customer?.firstName || customer?.lastName
          ? `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim()
          : "N/A",

        allInRate: load?.allInRate
          ? `$ ${formatNumber(load.allInRate)}`
          : "$ 0.00",
        advance: advance ? `$ ${formatNumber(advance)}` : "$ 0.00",
        balance: balance ? `$ ${formatNumber(balance)}` : "$ 0.00",
      });
    });

    const today = new Date();
    const pdfGenerator = new PdfGenerator();
    let htmlContent = await PdfService.generateHTMLTemplate({
      templateName: "AccountSummaryExport",
      templateData: {
        todaysDate: formatDate(today, "yyyy/MM/dd") || "N/A",
        fromDate: formatDate(req.body.fromDate, "yyyy/MM/dd") || "N/A",
        toDate: formatDate(req.body.toDate, "yyyy/MM/dd") || "N/A",
        totalAmount: totalAmount ? `$ ${formatNumber(totalAmount)}` : "$ 0.00",
        loadDetails: formatedDetails,
      },
    });
    // Get PDF as a buffer
    // const pdfBuffer = await pdfGenerator.generatePdf(htmlContent, {
    //   format: "A4",
    // });
    // send(res, 200, `Generated Successfully`, null!, {}, true);


const buffer = Buffer.from(htmlContent, "utf-8");
send(res, 200, `Generated Successfully`, buffer!, {}, true);
    // let options = { format: "A4" };
    // let file = { content: htmlContent };
    // generatePdf(file, options, (err: Error, buffer: Buffer) => {
    //   if (err) {
    //     send(res, 200, `Generated Successfully`, null!, {}, true);
    //     return;
    //   }
    //   send(res, 200, `Generated Successfully`, buffer!, {}, true);
    //   return;
    // });
  } catch (error) {
    logger.error("Error generating PDF:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while refreshing load age"
    );
  }
}

export async function accountingExport(
  req: Request,
  res: Response
): Promise<void> {
  try {
    res.setHeader("Content-Disposition", `attachment; filename=report.xlsx`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const { ids } = req.body;
    let matchQuery: any = {
      _id: { $in: ids },
      status: {
        $in: [DispatchLoadStatus.Invoiced, DispatchLoadStatus.InvoicedPaid],
      },
    };

    // Fetch loads and group them
    let excelBuffer;
    const loads = await DispatchModel.find(matchQuery)
      .populate("brokerId postedBy customerId carrierId")
      .select("-password");

    if (!loads || loads.length === 0) {
      res.send(null);
      return;
    }

    let dataSheets: Record<string, any[]> = {};
    let formatedLoad: any = [];
    loads.forEach((load: IDispatch) => {
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
        Units: load.units || 0,
        CustomerRate: load.customerRate,
        PDs: load.PDs,
        FuelServiceCharge: load.fuelServiceCharge?.value,
        OtherChargesTotal: load.otherCharges?.totalAmount,
        CarrierFee: load.carrierFee?.totalAmount,
        AllInRate: load.allInRate ? `$ ${formatNumber(load.allInRate)}` : "N/A",

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
        ConsigneeType: getEnumValue(Equipment, load.consignee.type),
        ConsigneeDescription: load.consignee.description,
        ConsigneeQTY: load.consignee.qty,
        ConsigneeValue: load.consignee.value,
        ConsigneeWeight: load.consignee.weight,
        ConsigneeNotes: load.consignee.notes,
        ConsigneePO: load.consignee.PO,

        // Broker Details
        BrokerCompany: broker?.company,
        BrokerEmail: broker?.email,
        BrokerPhone: formatPhoneNumber(broker?.primaryNumber),
        BrokerAddress: broker?.address?.str,
        BrokerBillingAddress: broker?.billingAddress?.str,
        BrokerCountry: broker?.country,
        BrokerState: broker?.state,
        BrokerCity: broker?.city,
        BrokerZip: broker?.zip,

        // Carrier Details
        CarrierCompany: carrier?.company || "",
        CarrierEmail: carrier?.email || "",
        CarrierPhone: formatPhoneNumber(carrier?.primaryNumber),
        CarrierAddress: carrier?.address?.str || "",

        // Customer Details
        CustomerCompany: customer?.company || "",
        CustomerEmail: customer?.email || "",
        CustomerPhone: formatPhoneNumber(customer?.primaryNumber),
        CustomerAddress: customer?.address?.str || "",

        // Posted By Details
        PostedBy: `${postedBy?.firstName} ${postedBy?.lastName}` || "",
        PostedByEmail: postedBy?.email || "",
        PostedByPhone: formatPhoneNumber(postedBy?.primaryNumber),
        PostedByCompany: postedBy?.company || "",
        PostedByAddress: postedBy?.address?.str || "",
      });
    });
    dataSheets["Loads"] = [];

    excelBuffer = generateExcelBuffer(dataSheets);

    res.send(excelBuffer);
  } catch (error) {
    logger.error("Error generating report:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while generating the report"
    );
  }
}

export async function reportsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    res.setHeader("Content-Disposition", "attachment; filename=report.xlsx");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    const { category, categoryValue, filterBy } = req.body;
    let matchQuery: any = {
      status: {
        $in: [DispatchLoadStatus.Invoiced, DispatchLoadStatus.InvoicedPaid],
      },
    };

    if (categoryValue !== "ALL") {
      matchQuery[category === "CUSTOMER" ? "customerId" : "carrierId"] =
        categoryValue;
    }

    let sortOptions: [string, SortOrder][] = [];
    if (filterBy === "SHIP_DATE") {
      sortOptions.push(["shipper.date", 1]);
    } else if (filterBy === "DEL_DATE") {
      sortOptions.push(["consignee.date", 1]);
    } else if (filterBy === "INVOICE_DATE") {
      sortOptions.push(["invoiceDate", 1]);
    }

    // Get query parameters
    const dateField = (req.body.dateField as string) || "createdAt";
    const fromDate = req.body.fromDate as string;
    const toDate = req.body.toDate as string;

    // Apply the date range filter
    matchQuery = applyDateRangeFilter(matchQuery, dateField, fromDate, toDate);

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
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "loads.brokerId",
            foreignField: "_id",
            as: "brokerId",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "loads.postedBy",
            foreignField: "_id",
            as: "postedBy",
          },
        },
        {
          $lookup: {
            from: "customers",
            localField: "loads.customerId",
            foreignField: "_id",
            as: "customerDetails",
          },
        },
        {
          $lookup: {
            from: "carriers",
            localField: "loads.carrierId",
            foreignField: "_id",
            as: "carrierId",
          },
        },
      ]);
      // Handle case when no loads are found
      if (!loads || loads.length === 0) {
        res.send(null);
        return;
      }

      let dataSheets: Record<string, any[]> = {};
      loads.forEach((group) => {
        let formatedLoad: any = [];
        group.loads.forEach((load: IDispatch) => {
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
            AllInRate: load.allInRate
              ? `$ ${formatNumber(load.allInRate)}`
              : "N/A",

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
            ConsigneeType: getEnumValue(Equipment, load.consignee.type),
            ConsigneeDescription: load.consignee.description,
            ConsigneeQTY: load.consignee.qty,
            ConsigneeValue: load.consignee.value,
            ConsigneeWeight: load.consignee.weight,
            ConsigneeNotes: load.consignee.notes,
            ConsigneePO: load.consignee.PO,

            // Broker Details
            BrokerCompany: broker?.company,
            BrokerEmail: broker?.email,
            BrokerPhone: formatPhoneNumber(broker?.primaryNumber),
            BrokerAddress: broker?.address?.str,
            BrokerBillingAddress: broker?.billingAddress?.str,
            BrokerCountry: broker?.country,
            BrokerState: broker?.state,
            BrokerCity: broker?.city,
            BrokerZip: broker?.zip,

            // Carrier Details
            CarrierCompany: carrier?.company || "",
            CarrierEmail: carrier?.email || "",
            CarrierPhone: formatPhoneNumber(carrier?.primaryNumber),
            CarrierAddress: carrier?.address?.str || "",

            // Customer Details
            CustomerCompany: customer?.company || "",
            CustomerEmail: customer?.email || "",
            CustomerPhone: formatPhoneNumber(customer?.primaryNumber),
            CustomerAddress: customer?.address?.str || "",
          });
        });
        dataSheets[group._id] = formatedLoad; // Grouped data per sheet
      });
      excelBuffer = generateExcelBuffer(dataSheets);
    } else {
      loads = await DispatchModel.find(matchQuery)
        .populate("brokerId postedBy customerId carrierId")
        .select("-password")
        .sort(sortOptions);

      if (!loads || loads.length === 0) {
        res.send(null);
        return;
      }

      let dataSheets: Record<string, any[]> = {};
      let formatedLoad: any = [];
      loads.forEach((load: IDispatch) => {
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
          AllInRate: load.allInRate
            ? `$ ${formatNumber(load.allInRate)}`
            : "N/A",

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
          ConsigneeType: getEnumValue(Equipment, load.consignee.type),
          ConsigneeDescription: load.consignee.description,
          ConsigneeQTY: load.consignee.qty,
          ConsigneeValue: load.consignee.value,
          ConsigneeWeight: load.consignee.weight,
          ConsigneeNotes: load.consignee.notes,
          ConsigneePO: load.consignee.PO,

          // Broker Details
          BrokerCompany: broker?.company,
          BrokerEmail: broker?.email,
          BrokerPhone: formatPhoneNumber(broker?.primaryNumber),
          BrokerAddress: broker?.address?.str,
          BrokerBillingAddress: broker?.billingAddress?.str,
          BrokerCountry: broker?.country,
          BrokerState: broker?.state,
          BrokerCity: broker?.city,
          BrokerZip: broker?.zip,

          // Carrier Details
          CarrierCompany: carrier?.company || "",
          CarrierEmail: carrier?.email || "",
          CarrierPhone: formatPhoneNumber(carrier?.primaryNumber),
          CarrierAddress: carrier?.address?.str || "",

          // Customer Details
          CustomerCompany: customer?.company || "",
          CustomerEmail: customer?.email || "",
          CustomerPhone: formatPhoneNumber(customer?.primaryNumber),
          CustomerAddress: customer?.address?.str || "",
        });
      });
      dataSheets["Report"] = formatedLoad;
      excelBuffer = generateExcelBuffer(dataSheets);
    }

    res.send(excelBuffer);
  } catch (error) {
    logger.error("Error generating report:", error);
    send(
      res,
      500,
      "An unexpected server error occurred while generating the report"
    );
  }
}

export async function deleteDocumentHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { filename, loadId } = req.params; // Get filename from request params

    if (!filename) {
      send(res, 400, "Filename is required");
      return;
    }

    if (!loadId) {
      send(res, 400, "load Id is required");
      return;
    }

    // Construct the full path to the file
    const filePath = path.join(__dirname, "../../../uploads/", filename);

    // Check if the file exists
    const fileExists = await pathExists(filePath);
    if (!fileExists) {
      send(res, 404, "File not found");
      return;
    }

    // Delete the file from the uploads folder using fs-extra
    await remove(filePath);

    // Find the dispatch that contains the document
    const dispatch = await DispatchModel.findById(loadId);

    if (!dispatch) {
      send(res, 404, "Document not found");
      return;
    }

    // Find the document inside the documents array
    const document =
      dispatch.documents &&
      dispatch.documents.find((doc: any) => doc.filename === filename);

    if (!document) {
      send(res, 404, "Document not found in dispatch");
      return;
    }

    // Remove the document from the documents array
    await DispatchModel.findOneAndUpdate(
      { _id: dispatch._id },
      { $pull: { documents: { filename } } },
      { new: true }
    );

    send(res, 200, "Document deleted successfully");
    return;
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
