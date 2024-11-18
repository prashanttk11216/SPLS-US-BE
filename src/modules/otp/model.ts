import mongoose, { Schema, Document } from "mongoose";
import { OTPDocument } from "../../types/OTP";

const OTPSchema = new Schema<OTPDocument>(
  {
    email: { type: String, required: true },
    otp: { type: String, required: true },
    expiration: { type: Date, required: true },
    resendCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const OTPModel = mongoose.model<OTPDocument>("OTP", OTPSchema);
