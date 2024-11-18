import { sign, verify, JwtPayload } from "jsonwebtoken";
import bcrypt from "bcrypt"; 
import crypto from "crypto";

export const generateToken = async (criteriaForJwt: any, key: string, options?: any) => {
  try {
    const token = await sign(criteriaForJwt, key, options);
    return token;
  } catch (error) {
    throw error;
  }
};

export const findByToken = (
  token: string,
  key: string
): JwtPayload | string => {
  try {
    return verify(token, key) as JwtPayload;
  } catch (error) {
    return "Invalid token"; // You can choose to return null or an appropriate message
  }
};

export const hashPassword = async (password: string, salRounds: number) => {
  return await bcrypt.hash(password, salRounds);
};

export const comparePasswords = async (
  password: string,
  hashedPassword: string
) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateOTP = (length: number = 6): string => {
  if (length < 4 || length > 10) {
    throw new Error("OTP length should be between 4 and 10 digits.");
  }

  const otp = crypto.randomInt(0, Math.pow(10, length)).toString();
  return otp.padStart(length, "0"); // Ensures the OTP has the specified length
}