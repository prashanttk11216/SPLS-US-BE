import { Document } from "mongoose";

/**
 * IUser interface defining the structure of a User document in MongoDB.
 */
export interface IUser extends Document {
  _id: string; // Unique identifier (added by Mongoose)
  firstName: string; // User's first name
  lastName: string; // User's last name
  email: string; // User's email
  password: string; // Encrypted password
  primaryNumber: string; // User's contact number
  company?: string; // Company name (optional)

  roles: Role[]; // Role of the user
  
  address?: {
    str: string; // String representation of the address
    lat: number; // Latitude
    lng: number; // Longitude
  }; // Primary address (optional for non-customers)
  addressLine2?: string;
  addressLine3?: string;
  country?: string;
  state?: string;
  city?: string;
  zip?: string;

  // Billing-specific fields (only for customers)
  billingAddress?: {
    str: string; // String representation of the address
    lat: number; // Latitude
    lng: number; // Longitude
  };
  billingAddressLine2?: string;
  billingAddressLine3?: string;
  billingCountry?: string;
  billingState?: string;
  billingCity?: string;
  billingZip?: string;

  // Broker and regulatory details
  brokerId?: string | IUser; // Reference to the broker (if applicable)
  postedBy?: string | IUser; // Reference to the broker (if applicable)
  employeeId?: string; // Employee ID (for brokers)
  
  // Flags
  isVerified: boolean; // Email verification status
  isDeleted: boolean; // Soft delete flag
  isActive: boolean; // Activation status

  // Avatar and timestamps
  avatarUrl?: string; // URL for profile picture
  createdAt: Date; // Document creation timestamp
  updatedAt: Date; // Document last update timestamp
}


export type Permission = {
  resource: string;
  actions: string[]; // e.g., ["view", "create", "edit", "delete"]
};

/**
 * Interface for the Role document.
 * Represents a role with a specific name and associated permissions.
 */
export interface Role {
  _id: string; // Unique identifier (added by Mongoose)
  name: string; // e.g., "Broker_User", "Customer"
  permissions: Permission[]; // Array of permissions assigned to this role
}
