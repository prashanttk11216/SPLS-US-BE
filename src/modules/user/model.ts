import mongoose, { Schema } from "mongoose";
import { UserRole } from "../../enums/UserRole";
import { IUser } from "../../types/User";

/**
 * Schema for the User model, defining the user structure and relationships
 * with Role and, optionally, Broker (for nested broker-user relationships).
 */
const UserSchema: Schema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    contactNumber: { type: String, required: true },

    // Reference to Role model, ensuring proper role-based permissions
    // role: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
    
    // Optional field for company association, relevant for brokers and carriers
    company: { type: String },

    // Access level for broker users, with "full" and "limited" as allowable values
    accessLevel: { 
      type: String, 
      enum: ["full", "limited"], 
      // required: function() { return this.role === UserRole.BROKER_USER; } 
    },

     brokerId: {
      type: Schema.Types.ObjectId,
      ref: "User", // Reference to User model
      required: true,
    },

    // Employee ID, specifically for broker users created by a main broker admin
    employeeId: { type: String },

    // Verification status for the user’s email
    isVerified: { type: Boolean, default: false },

    // Soft delete and activation status flags for the user
    isDeleted: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // URL for the user's avatar or profile picture
    avatarUrl: { type: String }
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    versionKey: false // Disables the __v version key in documents
  }
);

/**
 * UserModel: Mongoose model for the User schema
 * Defines and exports the User model based on the IUser interface and UserSchema
 */
export const UserModel = mongoose.model<IUser>("User", UserSchema);
