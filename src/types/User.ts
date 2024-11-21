import { Document } from "mongoose";
import { UserRole } from "../enums/UserRole";
import { RoleDocument } from "../modules/role/model";

/**
 * IUser interface defining the structure of a User document in MongoDB
 */
export interface IUser extends Document {
  _id: string; // Unique identifier (added by Mongoose)
  firstName: string; // User's first name
  lastName: string; // User's last name
  email: string; // User's email
  password: string; // Encrypted password
  primaryNumber: string; // User's contact number
  company?: string;

  role: RoleDocument["_id"]; // Role reference (using ObjectId)
  accessLevel?: "full" | "limited"; // Access level for broker users

  // Customer-specific fields
  customerId?: string;
  address?: string;
  addressLine2?: string;
  addressLine3?: string;
  country?: string;
  state?: string;
  city?: string;
  zip?: string;

  // Billing-specific fields
  billingAddress?: string;
  billingAddressLine2?: string;
  billingAddressLine3?: string;
  billingCountry?: string;
  billingState?: string;
  billingCity?: string;
  billingZip?: string;

  // Communication details
  primaryContact?: string;
  telephone?: string;
  tollFree?: string;
  fax?: string;
  secondaryContact?: string;
  secondaryEmail?: string;
  billingEmail?: string;
  billingTelephone?: string;

  // Broker and regulatory details
  brokerId?: string;
  employeeId?: string;
  mcNumber?: string;
  ursNumber?: string;

  // Flags
  isVerified: boolean;
  isDeleted: boolean;
  isActive: boolean;
  isBroker?: boolean;
  isBlacklisted?: boolean;

  // Avatar and timestamps
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
