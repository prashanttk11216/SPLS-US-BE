import mongoose, { Schema } from "mongoose";
import { IQuote } from "../../../types/Quote";

const QuoteSchema: Schema = new Schema(
  {
    name: { type: String, required: true }, // User's first name
    isActive: { type: Boolean, default: true }, // Activation status
    brokerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
    versionKey: false, // Disables the __v version key in documents
  }
);

export const QuoteModel = mongoose.model<IQuote>("Quote", QuoteSchema);
