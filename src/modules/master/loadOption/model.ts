import mongoose, { Schema } from "mongoose";
import { ILoadOption } from "../../../types/SelectOption";

/**
 * Mongoose schema for LoadOption.
 */
const LoadOptionSchema: Schema = new Schema(
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
 * LoadOptionModel: Mongoose model for the LoadOption schema
 */
export const LoadOptionModel = mongoose.model<ILoadOption>(
  "LoadOption",
  LoadOptionSchema
);
