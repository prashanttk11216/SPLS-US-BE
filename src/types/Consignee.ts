import mongoose from "mongoose";

/**
 * Interface representing a Consignee document in MongoDB.
 */
export interface IConsignee extends Document {
    firstName: string;
    lastName: string;
    email: string;
    primaryNumber: string;
    address?: string;
    addressLine2?: string;
    addressLine3?: string;
    country?: string;
    state?: string;
    city?: string;
    zip?: string;
    shippingHours?: string;
    brokerId: mongoose.Types.ObjectId;
    isDeleted: boolean;
    isAppointments: boolean;
    isActive: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  }
  