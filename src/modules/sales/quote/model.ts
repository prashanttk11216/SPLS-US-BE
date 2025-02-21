import mongoose, { Schema } from "mongoose";
import { IQuote } from "../../../types/Quote";

const QuoteSchema: Schema = new Schema(
  {
    name: { type: String, required: true }, // User's first name
    isActive: { type: Boolean, default: true }, // Activation status
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    versionKey: false, // Disables the __v version key in documents
  }
);

export const QuoteModel = mongoose.model<IQuote>("Quote", QuoteSchema);
