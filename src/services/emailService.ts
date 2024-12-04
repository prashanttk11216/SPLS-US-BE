import transporter from '../config/email';
import { env } from '../utils/env';
import { compileTemplateWithLayout } from '../utils/templateCompiler';

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

  // Send the email
  await transporter.sendMail({
    from: "",
    to,
    subject,
    html: emailContent,
  });
};