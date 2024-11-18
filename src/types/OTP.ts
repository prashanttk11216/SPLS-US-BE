export interface OTPDocument extends Document {
  email: string;
  otp: string;
  expiration: Date;
  resendCount: number;
}
