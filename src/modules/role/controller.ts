import { Request, Response } from "express";
import { RoleModel } from "./model";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { roleSchema } from "../../schema/Role";
import { getPaginationParams } from "../../utils/paginationUtils";
import { applyPopulation } from "../../utils/populateHelper";
import { buildSearchFilter } from "../../utils/parseSearchQuerty";
import { parseSortQuery } from "../../utils/parseSortQuery";

/**
 * GET /api/roles
 * Retrieves all roles with their associated permissions.
 */
export async function getRoles(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;
    const { page, limit, skip } = getPaginationParams(req.query);
    let filters: any = {};

    if (_id) {
      let query = RoleModel.findOne({ _id });
      query = applyPopulation(query, req.query.populate as string);
      const role = await query;

      if (!role) {
        send(res, 404, "Role not found");
        return;
      }

      send(res, 200, "Retrieved successfully", role);
      return;
    }

    // Apply dynamic filters from query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'skip', 'sort', 'search', 'searchField', 'populate'].includes(key)) {
        filters[key] = value;
      }
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string;
    if (search && searchField) {
      filters = { ...filters, ...buildSearchFilter(search, searchField) };
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    const validFields = ["name", "createdAt"];
    const sortOptions = parseSortQuery(sortQuery, validFields);

    // Total count and retrieval with pagination and sorting
    const totalItems = await RoleModel.countDocuments(filters);
    let query = RoleModel.find(filters)
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);
    query = applyPopulation(query, req.query.populate as string);

    const roles = await query;
    const totalPages = Math.ceil(totalItems / limit);

    send(res, 200, "Retrieved successfully", roles, {
      page,
      limit,
      totalPages,
      totalItems,
    });
  } catch (error) {
    logger.error("Error retrieving roles:", error);
    send(res, 500, "Server error");
  }
}

/**
 * POST /api/roles
 * Creates a new role.
 */
export async function createRole(req: Request, res: Response): Promise<void> {
  try {
    // Validate request data using Zod schema
    const validatedData = roleSchema.parse(req.body);

    // Check if the role already exists
    const existingRole = await RoleModel.findOne({ name: validatedData.name });
    if (existingRole) {
      send(res, 400, "Role already exists");
      return;
    }

    // Create a new role
    const role = await RoleModel.create(validatedData);
    send(res, 201, "Role created successfully", role);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during role creation:", error.errors);
      send(res, 400, "Validation error", error.errors);
    } else {
      logger.error("Unexpected error during role creation:", error);
      send(res, 500, "Server error");
    }
  }
}

/**
 * PUT /api/roles/:id
 * Updates an existing role by ID.
 */
export async function updateRole(req: Request, res: Response): Promise<void> {
  try {
    // Validate request data using Zod schema
    const validatedData = roleSchema.parse(req.body);
    const roleId = req.params._id;

    // Find and update the role
    const updatedRole = await RoleModel.findByIdAndUpdate(roleId, validatedData, { new: true });
    if (!updatedRole) {
      send(res, 404, "Role not found");
      return;
    }

    send(res, 200, "Role updated successfully", updatedRole);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during role update:", error.errors);
      send(res, 400, "Validation error", error.errors);
    } else {
      logger.error("Unexpected error during role update:", error);
      send(res, 500, "Server error");
    }
  }
}


/**
 * DELETE /api/roles/:id
 * Deletes a role by its ID.
 */
export async function deleteRole(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    // Delete the role based on the provided ID
    const deletedRole = await RoleModel.findByIdAndDelete(_id);

    if (!deletedRole) {
      send(res, 404, "Role not found");
      return
    }

    send(res, 200, "Role deleted successfully", deletedRole);
  } catch (error) {
    logger.error("Error deleting role:", error);
    send(res, 500, "Server error");
  }
}
