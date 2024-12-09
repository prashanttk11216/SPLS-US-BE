import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { Mode } from "../../enums/Mode";
import { Commodity } from "../../enums/Commodity";
import { ILoad } from "../../types/Load";

// Define Load interface extending Mongoose's Document


const originStopSchema: Schema = new Schema({
  address: { type: String },
  earlyPickupDate: { type: Date },
  latePickupDate: { type: Date },
  earlyPickupTime: { type: Date },
  latePickupTime: { type: Date },
});

const destinationStopSchema: Schema = new Schema({
  address: { type: String },
  earlyDropoffDate: { type: Date },
  lateDropoffDate: { type: Date },
  earlyDropoffTime: { type: Date },
  lateDropoffTime: { type: Date },
});


const LoadSchema: Schema = new Schema<ILoad>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    carrierId: { type: Schema.Types.ObjectId, ref: "User" },
    
    origin: { type: String, required: true },
    originEarlyPickupDate: { type: Date, required: true },
    originLatePickupDate: { type: Date },
    originEarlyPickupTime: { type: Date },
    originLatePickupTime: { type: Date },
    originStops: [originStopSchema],

    destination: { type: String, required: true },
    destinationEarlyDropoffDate: { type: Date },
    destinationLateDropoffDate: { type: Date },
    destinationEarlyDropoffTime: { type: Date },
    destinationLateDropoffTime: { type: Date },

    destinationStops: [destinationStopSchema],

    equipment: { type: String, enum: Equipment, required: true },
    mode: { type: String, enum: Mode, required: true },
    
    allInRate: { type: Number, min: 0 },
    customerRate: { type: Number, min: 0 },
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    distance: { type: Number, min: 0 },
    pieces: { type: Number, min: 0 },
    pallets: { type: Number, min: 0 },
    loadOption: { type: String },
    specialInstructions: { type: String },
    commodity: { type: String, enum: [...Object.values(Commodity), ""] },
    loadNumber: { type: Number, unique: true },

    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: { 
      type: String, 
      enum: [
        'Draft', 
        'Published', 
        'Pending Response', 
        'Deal Closed',
        'Cancelled'
      ], 
      default: 'Draft' 
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const LoadModel = mongoose.model<ILoad>("Load", LoadSchema);
