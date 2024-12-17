import transporter from '../config/email';
import { env } from '../utils/env';
import { compileTemplateWithLayout } from '../utils/templateCompiler';
import sgMail from '@sendgrid/mail'

export interface EmailData {
  [key: string]: any; // Generic type for any data type that could be used in a template
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  templateName: string;
  templateData: EmailData;
}

export const sendNotificationEmail = async (options: SendEmailOptions): Promise<void> => {
  const { to, subject, templateName, templateData } = options;

  // Compile the email template with the provided data
  const emailContent = await compileTemplateWithLayout('main', templateName, templateData);

  const mailOptions = {
    from: env.EMAIL_USER,
    to,
    subject,
    html: emailContent,
  }
  await sgMail.send(mailOptions)
  // Send the email
  // await transporter.sendMail(mailOptions);
};