import { Router } from "express";
import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
} from "./controller";
import auth from "../../middleware/auth";

const roleRouter = Router();

/**
 * POST /api/roles
 * Creates a new role or updates an existing role based on the provided data.
 * Expects role details (name, permissions) in the request body.
 * @route POST /api/roles
 * @access Admin
 */
roleRouter.post("/", auth, createRole);


roleRouter.put("/:_id", auth, updateRole);


/**
 * GET /api/roles
 * Retrieves a list of all roles and their associated permissions.
 * Returns an array of roles with populated permissions.
 * @route GET /api/roles
 * @access Admin
 */
roleRouter.get("/:_id?", getRoles);

/**
 * DELETE /api/roles/:_id
 * Deletes a specific role by its ID.
 * Returns success if deletion is completed or an error if the role is not found.
 * @param {string} _id - The unique identifier of the role
 * @route DELETE /api/roles/:_id
 * @access Admin
 */
roleRouter.delete("/:_id", auth, deleteRole);

export default roleRouter;
