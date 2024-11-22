import mongoose, { Schema } from "mongoose";
import { UserRole } from "../../enums/UserRole";
import { IUser } from "../../types/User";

/**
 * Schema for the User model, defining the user structure, relationships,
 * and additional fields for customer and broker-specific data.
 */
const UserSchema: Schema = new Schema(
  {
    // Basic user details
    firstName: { type: String, required: true }, // User's first name
    lastName: { type: String, required: true }, // User's last name
    email: { type: String, required: true, unique: true }, // User's email (unique)
    password: { type: String, required: true }, // Encrypted password
    primaryNumber: { type: String, required: true }, // Contact number
    company: { type: String },

    // Role and permissions
    role: { type: String, enum: Object.values(UserRole), required: true }, // Role of the user


    address: { type: String}, // Customer's primary address
    addressLine2: { type: String }, // Optional address line 2
    addressLine3: { type: String }, // Optional address line 3
    country: { type: String}, // Country of the customer
    state: { type: String}, // State of the customer
    city: { type: String}, // City of the customer
    zip: { type: String}, // Zip code of the customer's address

    // Billing-specific fields for Customer
      billingAddress: { type: String}, // Primary billing address
      billingAddressLine2: { type: String }, // Optional billing address line 2
      billingAddressLine3: { type: String }, // Optional billing address line 3
      billingCountry: { type: String}, // Billing country
      billingState: { type: String}, // Billing state
      billingCity: { type: String }, // Billing city
      billingZip: { type: String }, // Billing zip code

  
    // Broker and regulatory details
    brokerId: { 
      type: Schema.Types.ObjectId, 
      ref: "User", // Reference to the broker (if applicable)
      required: true
    },
    employeeId: { type: String }, // Employee ID for brokers (if applicable)
   
    // Flags for status and additional details
    isVerified: { type: Boolean, default: false }, // Email verification status
    isDeleted: { type: Boolean, default: false }, // Soft delete flag
    isActive: { type: Boolean, default: true }, // Activation status

    // Avatar and additional information
    avatarUrl: { type: String }, // URL for the user's profile picture
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    versionKey: false // Disables the __v version key in documents
  }
);

/**
 * UserModel: Mongoose model for the User schema
 * Defines and exports the User model based on the IUser interface and UserSchema.
 */
export const UserModel = mongoose.model<IUser>("User", UserSchema);
