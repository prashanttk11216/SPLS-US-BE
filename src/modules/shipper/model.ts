import mongoose, { Schema } from "mongoose";
import { IShipper } from "../../types/Shipper";

/**
 * Mongoose schema for Shipper.
 */
const ShipperSchema: Schema = new Schema({
      // Basic user details
      firstName: { type: String, required: true, trim: true },
      lastName: { type: String, required: true, trim: true },
      email: { type: String, required: true, unique: true, lowercase: true, trim: true },
      primaryNumber: { type: String, required: true, trim: true },
  
      // Address details
      address: { type: String, trim: true },
      addressLine2: { type: String, trim: true },
      addressLine3: { type: String, trim: true },
      country: { type: String, trim: true },
      state: { type: String, trim: true },
      city: { type: String, trim: true },
      zip: { type: String, trim: true },
      shippingHours: { type: String, trim: true },
  
      // Broker details
      brokerId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
  
      // Status flags
      isDeleted: { type: Boolean, default: false },
      isAppointments: { type: Boolean, default: false },
      isActive: { type: Boolean, default: true },
    },
    {
      timestamps: true, // Adds createdAt and updatedAt fields
      versionKey: false, // Disables the __v version key
    }
  );

/**
 * ShipperModel: Mongoose model for the Shipper schema
 * Defines and exports the User model based on the IShipper interface and ShipperSchema.
 */
export const ShipperModel = mongoose.model<IShipper>("Shipper", ShipperSchema);
