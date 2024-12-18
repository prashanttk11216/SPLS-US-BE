import mongoose, { Schema, Document } from "mongoose";
import { Equipment } from "../../enums/Equipment";
import { Mode } from "../../enums/Mode";
import { Commodity } from "../../enums/Commodity";
import { ILoad } from "../../types/Load";

// Define Load interface extending Mongoose's Document




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
      required: true 
    },
    originEarlyPickupDate: { type: Date, required: true },
    destination:{ 
      type: destinationSchema, 
      required: true 
    },

    equipment: { type: String, enum: Equipment, required: true },
    mode: { type: String, enum: Mode, required: true },
    
    allInRate: { type: Number, min: 0 },
    customerRate: { type: Number, min: 0 },
    weight: { type: Number, min: 0 },
    length: { type: Number, min: 0 },
    miles: { type: Number, min: 0 },
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

  // Calculate time in different units
  const ageInSeconds = Math.floor(differenceInTime / 1000); // Seconds
  const ageInMinutes = Math.floor(ageInSeconds / 60); // Minutes
  const ageInHours = Math.floor(ageInMinutes / 60); // Hours
  const ageInDays = Math.floor(ageInHours / 24); // Days
  const ageInMonths = Math.floor(ageInDays / 30.44); // Approximate months
  const ageInYears = Math.floor(ageInDays / 365.25); // Approximate years

  // Create a formatted string with abbreviations
  if (ageInYears > 0) {
    return `${ageInYears}y`; // Years
  } else if (ageInMonths > 0) {
    return `${ageInMonths}m`; // Months
  } else if (ageInDays > 0) {
    return `${ageInDays}d`; // Days
  } else if (ageInHours > 0) {
    return `${ageInHours}h`; // Hours
  } else if (ageInMinutes > 0) {
    return `${ageInMinutes}m`; // Minutes
  } else if (ageInSeconds > 0) {
    return `${ageInSeconds}s`; // Seconds
  }

  return null;
});




export const LoadModel = mongoose.model<ILoad>("Load", LoadSchema);
