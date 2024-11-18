import { Request, Response } from "express";
import { RoleModel } from "./model";
import send from "../../utils/apiResponse";
import logger from "../../utils/logger";
import { z } from "zod";
import { roleSchema } from "../../schema/Role";

/**
 * GET /api/roles
 * Retrieves all roles with their associated permissions.
 */
export async function getRoles(req: Request, res: Response): Promise<void> {
  try {
    const roles = await RoleModel.find().populate("permissions");
    send(res, 200, "Roles retrieved successfully", roles);
  } catch (error) {
    logger.error("Error retrieving roles:", error);
    send(res, 500, "Server error");
  }
}

/**
 * POST /api/roles
 * Creates or updates a role based on the name. If the role exists, it is updated with new permissions.
 */
export async function createOrUpdateRole(req: Request, res: Response): Promise<void> {
  try {
    // Validate request data using Zod schema
    const validatedData = roleSchema.parse(req.body);

    // Find and update the role, or create it if it does not exist
    const role = await RoleModel.findOneAndUpdate(
      { name: validatedData.name },
      validatedData,
      { upsert: true, new: true }
    );

    send(res, 200, "Role created or updated successfully", role);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during role creation or update:", error.errors);
      send(res, 400, "Validation error", error.errors);
    } else {
      logger.error("Unexpected error during role creation or update:", error);
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

/**
 * GET /api/roles/:_id
 * Retrieves a single role by its ID, along with its permissions.
 */
export async function getRoleById(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    const role = await RoleModel.findById(_id).populate("permissions");

    if (!role) {
      send(res, 404, "Role not found");
      return
    }

    send(res, 200, "Role retrieved successfully", role);
  } catch (error) {
    logger.error("Error retrieving role:", error);
    send(res, 500, "Server error");
  }
}
