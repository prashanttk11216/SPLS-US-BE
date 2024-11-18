import { Schema, model, Document } from "mongoose";
import { PermissionType } from "../../types/Permission";

/**
 * Interface for the Permission document.
 * Represents individual permissions for a resource, such as "loads" or "customers".
 */
export interface PermissionDocument extends Document {
  resource: string; // e.g., "loads", "customers"
  actions: string[]; // e.g., ["view", "create", "edit"]
}

/**
 * Interface for the Role document.
 * Represents a role with a specific name and associated permissions.
 */
export interface RoleDocument extends Document {
  name: string; // e.g., "Broker_User", "Customer"
  permissions: PermissionType[]; // Array of permissions assigned to this role
}

// Schema for permissions, defining resources and allowed actions for each resource.
const PermissionSchema = new Schema<PermissionDocument>(
  {
    resource: { type: String, required: true }, // e.g., "loads", "customers"
    actions: {
      type: [String],
      required: true,
      validate: [
        (arr: string[]) => arr.length > 0,
        "At least one action is required",
      ], // Validates at least one action exists
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    versionKey: false, // Disables the __v version key in documents
  }
);

// Schema for roles, associating each role with a set of permissions.
const RoleSchema = new Schema<RoleDocument>(
  {
    name: { type: String, required: true, unique: true },
    permissions: {
      type: [PermissionSchema],
      validate: [
        (arr: PermissionDocument[]) => arr.length > 0,
        "At least one permission is required",
      ],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    versionKey: false, // Disables the __v version key in documents
  }
);

// RoleModel: Exported Mongoose model for roles with embedded permissions
export const RoleModel = model<RoleDocument>("Role", RoleSchema);
