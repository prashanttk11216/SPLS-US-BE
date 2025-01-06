import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { formatTimeDifference } from "../../utils/globalHelper";
import { IDispatch } from "../../types/Dispatch";

// Define Load interface extending Mongoose's Document
const addressSchema = new mongoose.Schema({
  str: { type: String, required: true }, // String representation
  lat: { type: Number, required: true }, // Latitude
  lng: { type: Number, required: true }, // Longitude
});

// Consignee Schema
const consigneeSchema = new Schema({
  consigneeId: {
    type: Schema.Types.ObjectId,
    ref: "Consignee",
    required: true,
  },
  address: { type: addressSchema, required: true },
  date: { type: Date, required: true },
  time: { type: Date },
  description: { type: String },
  type: { type: String },
  qty: { type: Number, min: 0 },
  weight: { type: Number, min: 0 },
  value: { type: Number, min: 0 },
  notes: { type: String },
  PO: { type: Number },
});

// Shipper Schema
const shipperSchema = new Schema({
  shipperId: { type: Schema.Types.ObjectId, ref: "Shipper", required: true },
  address: { type: addressSchema, required: true },
  date: { type: Date, required: true },
  time: { type: Date },
  description: { type: String },
  type: { type: String },
  qty: { type: Number, min: 0 },
  weight: { type: Number, min: 0 },
  value: { type: Number, min: 0 },
  notes: { type: String },
  PO: { type: Number },
});

const DispatchSchema: Schema = new Schema<IDispatch>(
  {
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    loadNumber: { type: Number, unique: true },
    WONumber: { type: Number, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    carrierId: { type: Schema.Types.ObjectId, ref: "User" },
    equipment: { type: String, enum: Equipment, required: true },
    allInRate: { type: Number, min: 0 },
    customerRate: { type: Number, min: 0 },
    carrierRate: { type: Number, min: 0 },

    consignee: {
      type: consigneeSchema,
      required: true,
    },

    shipper: {
      type: shipperSchema,
      required: true,
    },

    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: [
        "Draft",
        "Published",
        "In Transit",
        "Completed",
        "Cancelled",
      ],
      default: "Draft",
    },
    age: { type: Date }, // Persistent Age Field
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

DispatchSchema.set("toJSON", { virtuals: true });
DispatchSchema.set("toObject", { virtuals: true });
DispatchSchema.virtual<IDispatch>("formattedAge").get(function () {
  if (!this.age) return null; // Ensure age is defined
  const now = new Date(); // Current date
  const ageDate = new Date(this.age); // Age as a Date object

  // Difference in time (in milliseconds)
  const differenceInTime = now.getTime() - ageDate.getTime();

  return formatTimeDifference(differenceInTime);
});

export const DispatchModel = mongoose.model<IDispatch>(
  "DispatchLoad",
  DispatchSchema
);
