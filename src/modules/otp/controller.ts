import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { generateOTP } from "../../utils/encryption";
import { OTPModel } from "./model";
import { UserModel } from "../user/model";
import logger from "../../utils/logger"; // Assuming a logger utility is available

const OTP_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_RESEND_ATTEMPTS = 3; // Maximum OTP resend attempts allowed

/**
 * Generate and save a new OTP for a given email.
 * @param email - The email to associate with the OTP.
 * @returns The generated OTP as a string.
 */
export async function createOTP(email: string): Promise<string> {
  const otp = generateOTP();

  // Save or update OTP in the database with expiration time and reset resend count
  await OTPModel.findOneAndUpdate(
    { email },
    {
      otp,
      expiration: new Date(Date.now() + OTP_EXPIRATION_TIME),
      resendCount: 0,
    },
    { upsert: true, new: true }
  );

  return otp;
}

/**
 * Handle OTP resend requests, creating a new OTP if expired or incrementing resend count if still valid.
 * @param req - Express request object.
 * @param res - Express response object.
 */
export async function resendOTPHandler(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    const otpRecord = await OTPModel.findOne({ email });

    if (!otpRecord) {
      send(res, 404, "No OTP found. Please request a new OTP.");
      return;
    }

    // Check if OTP has expired and needs to be regenerated
    if (otpRecord.expiration < new Date()) {
      otpRecord.otp = generateOTP();
      otpRecord.expiration = new Date(Date.now() + OTP_EXPIRATION_TIME);
      otpRecord.resendCount = 1;
    } else if (otpRecord.resendCount >= MAX_RESEND_ATTEMPTS) {
      send(res, 429, "Maximum OTP resend attempts reached. Please try again later.");
      return;
    } else {
      otpRecord.resendCount += 1; // Increment resend count if within limits
    }

    await otpRecord.save();

    // TODO: Uncomment the line below to integrate email service for sending OTP.
    // await sendEmail(email, "Your OTP Code", `Your OTP is: ${otpRecord.otp}`);

    send(res, 200, "OTP resent successfully.");
  } catch (error) {
    logger.error("Error in resendOTPHandler:", error);
    send(res, 500, "An error occurred while resending the OTP. Please try again later.");
  }
}

/**
 * Verify a user's email by matching the provided OTP.
 * @param req - Express request object.
 * @param res - Express response object.
 */
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { email, otp } = req.body;

    // Check if user exists and is not already verified
    const user = await UserModel.findOne({ email });
    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    if (user.isVerified) {
      send(res, 400, "User already verified");
      return;
    }

    // Retrieve OTP record for email and check if it exists
    const otpRecord = await OTPModel.findOne({ email });
    if (!otpRecord) {
      send(res, 404, "OTP not found. Please request a new OTP.");
      return;
    }

    // Validate OTP expiration
    if (otpRecord.expiration < new Date()) {
      await otpRecord.deleteOne(); // Clean up expired OTP entry
      send(res, 400, "OTP has expired. Please request a new OTP.");
      return;
    }

    // Match OTP and update user verification status if successful
    if (otpRecord.otp === otp) {
      user.isVerified = true;
      await user.save();
      await otpRecord.deleteOne(); // Delete OTP after successful verification
      
      send(res, 200, "Email verified successfully");
    } else {
      send(res, 400, "Invalid OTP");
    }
  } catch (error) {
    logger.error("Error in verifyEmail:", error);
    send(res, 500, "An error occurred while verifying the OTP. Please try again later.");
  }
}
