import { Router } from "express";
import { resendOTPHandler, verifyEmail } from "./controller";

const otpRouter = Router();

// Route to resend OTP to the user
// Used when a user requests to resend their OTP for email verification
otpRouter.post("/resend", resendOTPHandler);

// Route to verify the user's email using OTP
// Validates the OTP provided by the user and verifies their email address
otpRouter.post("/verify", verifyEmail);

export default otpRouter;
