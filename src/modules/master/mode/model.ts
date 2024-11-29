import mongoose, { Schema } from "mongoose";
import { IMode } from "../../../types/SelectOption";

/**
 * Mongoose schema for Mode.
 */
const ModeSchema: Schema = new Schema(
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
 * ModeModel: Mongoose model for the Mode schema
 */
export const ModeModel = mongoose.model<IMode>("Mode", ModeSchema);
