import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { ITruck } from "../../types/Truck";
import { formatTimeDifference } from "../../utils/globalHelper";

// Define Load interface extending Mongoose's Document

const originSchema = new mongoose.Schema({
  str: { type: String, required: true }, // String representation
  lat: { type: Number, required: true }, // Latitude
  lng: { type: Number, required: true }, // Longitude
});

const destinationSchema = new mongoose.Schema({
  str: { type: String, required: false }, // String representation
  lat: { type: Number, required: false }, // Latitude
  lng: { type: Number, required: false }, // Longitude
});

const TruckSchema: Schema = new Schema<ITruck>(
  {
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    origin: {
      type: originSchema,
      required: true,
    },
    availableDate: { type: Date, required: true },
    destination: {
      type: destinationSchema,
      required: false,
    },

    equipment: { type: String, enum: Equipment, required: true },

    allInRate: { type: Number, min: 0 },
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    miles: { type: Number, min: 0 },
    comments: { type: String },
    referenceNumber: { type: Number, unique: true },

    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    age: { type: Date }, // Persistent Age Field
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

TruckSchema.set("toJSON", { virtuals: true });
TruckSchema.set("toObject", { virtuals: true });
TruckSchema.virtual<ITruck>("formattedAge").get(function () {
  if (!this.age) return null; // Ensure age is defined
  const now = new Date(); // Current date
  const ageDate = new Date(this.age); // Age as a Date object

  // Difference in time (in milliseconds)
  const differenceInTime = now.getTime() - ageDate.getTime();

  return formatTimeDifference(differenceInTime);
});

export const TruckModal = mongoose.model<ITruck>("Truck", TruckSchema);
