import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { formatTimeDifference } from "../../utils/globalHelper";
import { IDispatch } from "../../types/Dispatch";
import { DispatchLoadType } from "../../enums/DispatchLoadType";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";

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

const FscSchema: Schema = new Schema({
  isPercentage: {
    type: Boolean,
    required: false,
  },
  value : {
    type: Number,
    min: 0,
    required: true,
  },
});

const OtherChargeSchema: Schema = new Schema({
  description: { type: String, required: true }, // Description of the charge
  amount: { type: Number, min: 0, required: true }, // Amount of the charge
  isAdvance: { type: Boolean, default: false }, // Flag to indicate if it's an advance charge
  date: { type: Date }, // Optional: Used only for advance charges
});


const CarrierFeeBreakdownSchema: Schema = new Schema({
  type: { type: String, enum: DispatchLoadType},
  units: { type: Number, min: 0},
  rate: { type: Number, min: 0, required: true }, // Agreed base rate
  PDs: { type: Number, min: 0, default: 0 }, // Number of picks/drops
  fuelServiceCharge: FscSchema,
  totalRate: { type: Number, min: 0, required: true }, // Total rate after all calculations
  OtherChargeSchema: [OtherChargeSchema]
});


const DispatchSchema: Schema = new Schema<IDispatch>(
  {
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    loadNumber: { type: Number, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    salesRep: { type: Schema.Types.ObjectId, ref: "User" },
    WONumber: { type: Number, unique: true },
    type: { type: String, enum: DispatchLoadType},
    units: { type: Number, min: 0},
    customerRate: { type: Number, min: 0 },
    PDs: { type: Number, min: 0 },
    fuelServiceCharge: { type: FscSchema },
    otherCharges: {
      totalAmount: { type: Number, min: 0 }, // Direct amount for other charges
      breakdown: [OtherChargeSchema], // List of other charges and advance charges
    },
    carrierFee: {
      totalAmount: { type: Number, min: 0 }, // Direct amount for carrier fee
      breakdown: CarrierFeeBreakdownSchema, // Detailed breakdown structure
    },
    carrierId: { type: Schema.Types.ObjectId, ref: "User" },
    equipment: { type: String, enum: Equipment, required: true },
    allInRate: { type: Number, min: 0 },

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
      enum: DispatchLoadStatus,
      default: DispatchLoadStatus.Draft,
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
