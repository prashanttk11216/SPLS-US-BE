import mongoose, { Schema } from "mongoose";
import { ILoad } from "../../types/Load";

const LoadSchema: Schema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    brokerId: { type: Schema.Types.ObjectId, ref: "User" },
    carrierId: { type: Schema.Types.ObjectId, ref: "User" },
    title: { type: String, required: true },
    origin: {
      city: { type: String, required: true },
      state: { type: String, required: true },
    },
    destination: {
      city: { type: String, required: true },
      state: { type: String, required: true },
    },
    stops: [
      {
        city: { type: String },
        state: { type: String },
        date: { type: Date },
      },
    ],
    equipment: { type: String, required: true },
    mode: { type: String, required: true },
    allInRate: { type: Number, required: true },
    weight: { type: Number, required: true },
    dimensions: {
      length: { type: Number, required: true },
      width: { type: Number, required: true },
      height: { type: Number },
    },
    status: {
      type: String,
      enum: ["pending", "in_transit", "completed", "canceled"],
      default: "pending",
    },
    specialInfo: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const LoadModel = mongoose.model<ILoad>("Load", LoadSchema);
