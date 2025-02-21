import { Request, Response } from "express";
import send from "../../../utils/apiResponse";
import logger from "../../../utils/logger";
import { QuoteModel } from "./model";
import { getPaginationParams } from "../../../utils/paginationUtils";
import { applyPopulation } from "../../../utils/populateHelper";
import { buildSearchFilter } from "../../../utils/parseSearchQuerty";
import { parseSortQuery } from "../../../utils/parseSortQuery";
import { createQuoteSchema, updateQuoteSchema } from "../../../schema/Quote";

export async function createQuote(req: Request, res: Response): Promise<void> {
  try {
    // Validate request body
    const parsedBody = createQuoteSchema.safeParse(req.body);
    if (!parsedBody.success) {
      send(res, 400, "Invalid request data", parsedBody.error.format());
      return;
    }

    // Create new quote
    const { name, isActive } = parsedBody.data;
    const newQuote = await QuoteModel.create({ name, isActive });

    send(res, 201, "Quote created successfully", newQuote);
  } catch (error) {
    logger.error("Error creating quote:", error);
    send(res, 500, "Server error");
  }
}

export async function updateQuote(req: Request, res: Response): Promise<void> {
  try {
    const { quoteId } = req.params;

    // Validate request body
    const parsedBody = updateQuoteSchema.safeParse(req.body);
    if (!parsedBody.success) {
      send(res, 400, "Invalid request data", parsedBody.error.format());
      return;
    }

    // Find the quote by ID
    const quote = await QuoteModel.findById(quoteId);
    if (!quote) {
      send(res, 404, "Quote not found");
      return;
    }

    // Update quote fields if provided
    const { name, isActive } = parsedBody.data;
    if (name !== undefined) quote.name = name;
    if (isActive !== undefined) quote.isActive = isActive;

    // Save the updated quote
    await quote.save();

    send(res, 200, "Quote updated successfully", quote);
  } catch (error) {
    logger.error("Error updating quote:", error);
    send(res, 500, "Server error");
  }
}

export async function getQuotes(req: Request, res: Response): Promise<void> {
  try {
    const { quoteId } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query);
    let filters: any = {};

    // Fetch a single quote by ID
    if (quoteId) {
      let query = QuoteModel.findOne({ _id: quoteId, ...filters });
      query = applyPopulation(query, req.query.populate as string);
      const quote = await query;

      if (!quote) {
        send(res, 404, "Quote not found");
        return;
      }

      send(res, 200, "Retrieved successfully", quote);
      return;
    }

    // Apply dynamic filters based on query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (
        ![
          "page",
          "limit",
          "skip",
          "sort",
          "search",
          "searchField",
          "populate",
        ].includes(key)
      ) {
        filters[key] = value;
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string;
    const numberFields = ["isActive"]; // Define numeric fields
    const multiFieldMappings = { name: ["name"] }; // Dynamic mapping for search

    if (search && searchField) {
      filters = {
        ...filters,
        ...buildSearchFilter(
          search,
          searchField,
          numberFields,
          multiFieldMappings
        ),
      };
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    const validFields = ["name", "isActive", "createdAt", "updatedAt"];
    const sortOptions = parseSortQuery(sortQuery, validFields);

    // Get total count
    const totalItems = await QuoteModel.countDocuments(filters);

    // Retrieve multiple quotes with pagination and sorting
    let query = QuoteModel.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);
    query = applyPopulation(query, req.query.populate as string);
    const quotes = await query;

    const totalPages = Math.ceil(totalItems / limit);

    send(res, 200, "Retrieved successfully", quotes, {
      page,
      limit,
      totalPages,
      totalItems,
    });
  } catch (error) {
    logger.error("Error retrieving quotes:", error);
    send(res, 500, "Server error");
  }
}

export async function deleteQuote(req: Request, res: Response): Promise<void> {
  try {
    const { quoteId } = req.params;

    // Find and delete the quote
    const deletedQuote = await QuoteModel.findByIdAndDelete(quoteId);
    if (!deletedQuote) {
      send(res, 404, "Quote not found");
      return;
    }

    send(res, 200, "Quote deleted successfully");
  } catch (error) {
    logger.error("Error deleting quote:", error);
    send(res, 500, "Server error");
  }
}
