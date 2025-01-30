import nodemailer from "nodemailer";
import { env } from "../utils/env";

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: true // Enable debugging
});

export default transporter;
