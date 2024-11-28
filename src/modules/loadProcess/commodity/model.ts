import mongoose, { Schema } from "mongoose";
import { ICommodity } from "../../../types/loadprocess";

/**
 * Mongoose schema for Commodity.
 */
const CommoditySchema: Schema = new Schema(
  {
    label: {
      type: String,
      required: true,
      unique: true, // Ensure label is unique
    },
  },
  { timestamps: true }
);

/**
 * CommodityModel: Mongoose model for the Commodity schema
 */
export const CommodityModel = mongoose.model<ICommodity>(
  "Commodity",
  CommoditySchema
);
