import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { Mode } from "../../enums/Mode";
import { Commodity } from "../../enums/Commodity";
import { ILoad } from "../../types/Load";

// Define Load interface extending Mongoose's Document


const StopSchema: Schema = new Schema({
  address: { type: String },
  earlyPickupDate: { type: Date },
  latePickupDate: { type: Date },
  earlyDropoffDate: { type: Date },
  lateDropoffDate: { type: Date },
});


const LoadSchema: Schema = new Schema<ILoad>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    carrierId: { type: Schema.Types.ObjectId, ref: "User" },
    
    origin: { type: String, required: true },
    originEarlyPickupDate: { type: Date, required: true },
    originLatePickupDate: { type: Date },
    originEarlyDropoffTime: { type: Date },
    originLateDropoffTime: { type: Date },
    originStops: [StopSchema],

    destination: { type: String, required: true },
    destinationEarlyDropoffDate: { type: Date },
    destinationLateDropoffDate: { type: Date },
    destinationEarlyDropoffTime: { type: Date },
    destinationLateDropoffTime: { type: Date },

    destinationStops: [StopSchema],

    equipment: { type: String, enum: Equipment, required: true },
    mode: { type: String, enum: Mode, required: true },
    
    allInRate: { type: Number, min: 0 },
    customerRate: { type: Number, min: 0 },
    weight: { type: Number, required: true, min: 0 },
    length: { type: Number, required: true, min: 0 },
    width: { type: Number, required: true, min: 0 },
    height: { type: Number, min: 0 },
    distance: { type: Number, min: 0 },
    pieces: { type: Number, min: 0 },
    pallets: { type: Number, min: 0 },
    loadOption: { type: String },
    specialInstructions: { type: String },
    commodity: { type: String, enum: Commodity },
    loadNumber: { type: String, unique: true },

    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDaft: {type: Boolean, default: false},

    status: {
      type: String,
      enum: ["pending", "in_transit", "completed", "canceled"],
      default: "pending",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const LoadModel = mongoose.model<ILoad>("Load", LoadSchema);
