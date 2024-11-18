import nodemailer from "nodemailer";
import { env } from "./env";

interface EmailOptions {
  to: string | string[];       // Allows sending to one or multiple recipients
  subject: string;             // Email subject line
  text?: string;               // Plain text body
  html?: string;               // HTML body for more complex email templates
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: env.EMAIL_USER,
      to: options.to,
      subject: options.subject,
      text: options.text || "",      // Fallback to empty string if no text provided
      html: options.html || "",      // Fallback to empty string if no HTML provided
    };

    console.log("Sending email with options:", mailOptions);

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
  } catch (error) {
    console.error("Error sending email:", error);
  }
}
