import mongoose, { Schema } from "mongoose";
import { IEquipment } from "../../../types/loadprocess";

/**
 * Mongoose schema for Equipment.
 */
const EquipmentSchema: Schema = new Schema(
  {
    label: {
      type: String,
      required: true,
      unique: true, // Ensure label is unique
    }, // Combined label (e.g., "F - Flatbed")
  },
  { timestamps: true }
);
/**
 * EquipmentModel: Mongoose model for the Equipment schema
 */
export const EquipmentModel = mongoose.model<IEquipment>(
  "Equipment",
  EquipmentSchema
);
