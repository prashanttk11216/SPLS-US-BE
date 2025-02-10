import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { Mode } from "../../enums/Mode";
import { Commodity } from "../../enums/Commodity";
import { ILoad } from "../../types/Load";
import { formatTimeDifference } from "../../utils/globalHelper";
import { LoadOption } from "../../enums/LoadOption";

// Define Load interface extending Mongoose's Document

const originStopSchema: Schema = new Schema({
  address: {
    str: { type: String }, // String representation
    lat: { type: Number }, // Latitude
    lng: { type: Number }, // Longitude
  },
  earlyPickupDate: { type: Date },
  latePickupDate: { type: Date },
  earlyPickupTime: { type: Date },
  latePickupTime: { type: Date },
});

const destinationStopSchema: Schema = new Schema({
  address: {
    str: { type: String }, // String representation
    lat: { type: Number }, // Latitude
    lng: { type: Number }, // Longitude
  },  
  earlyDropoffDate: { type: Date },
  lateDropoffDate: { type: Date },
  earlyDropoffTime: { type: Date },
  lateDropoffTime: { type: Date },
});

const originSchema = new mongoose.Schema({
  str: { type: String, required: true }, // String representation
  lat: { type: Number, required: true }, // Latitude
  lng: { type: Number, required: true }, // Longitude
});

const destinationSchema = new mongoose.Schema({
  str: { type: String, required: true }, // String representation
  lat: { type: Number, required: true }, // Latitude
  lng: { type: Number, required: true }, // Longitude
});

const LoadSchema: Schema = new Schema<ILoad>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User" },
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    carrierId: { type: Schema.Types.ObjectId, ref: "User" },

    origin: {
      type: originSchema,
      required: true,
    },
    originEarlyPickupDate: { type: Date, required: true },
    originLatePickupDate: { type: Date },
    originEarlyPickupTime: { type: Date },
    originLatePickupTime: { type: Date },
    originStops: [originStopSchema],

    destination: {
      type: destinationSchema,
      required: true,
    },
    destinationEarlyDropoffDate: { type: Date },
    destinationLateDropoffDate: { type: Date },
    destinationEarlyDropoffTime: { type: Date },
    destinationLateDropoffTime: { type: Date },

    destinationStops: [destinationStopSchema],

    equipment: { type: String, enum: Object.keys(Equipment), required: true },
    mode: { type: String, enum: Object.keys(Mode), required: true },

    allInRate: { type: Number, min: 0 },
    customerRate: { type: Number, min: 0 },
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    pieces: { type: Number, min: 0 },
    pallets: { type: Number, min: 0 },
    miles: { type: Number, min: 0 },
    loadOption: { type: String, enum: Object.keys(LoadOption)},
    specialInstructions: { type: String },
    commodity: { type: String, enum: Object.keys(Commodity) },
    loadNumber: { type: Number, unique: true },

    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: [
        "Draft",
        "Published",
        "Pending Response",
        "Deal Closed",
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

LoadSchema.set("toJSON", { virtuals: true });
LoadSchema.set("toObject", { virtuals: true });
LoadSchema.virtual<ILoad>("formattedAge").get(function () {
  if (!this.age) return null; // Ensure age is defined
  const now = new Date(); // Current date
  const ageDate = new Date(this.age); // Age as a Date object

  // Difference in time (in milliseconds)
  const differenceInTime = now.getTime() - ageDate.getTime();

  return formatTimeDifference(differenceInTime);
});

export const LoadModel = mongoose.model<ILoad>("Load", LoadSchema);
