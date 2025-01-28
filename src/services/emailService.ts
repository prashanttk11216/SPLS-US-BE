import transporter from '../config/email';
import { env } from '../utils/env';
import { compileTemplateWithLayout } from '../utils/templateCompiler';
import sgMail from '@sendgrid/mail'

export interface EmailData {
  [key: string]: any; // Generic type for any data type that could be used in a template
}

export interface SendEmailOptions {
  to?: string | string[],
  cc?: string | string[],
  bcc?: string | string[],
  subject: string;
  templateName: string;
  templateData: EmailData;
}

export class EmailService {
  async sendNotificationEmail(options: SendEmailOptions): Promise<void> {
    const { to, subject, templateName, templateData } = options;

    // Compile the email template with the provided data chnages
    const emailContent = await compileTemplateWithLayout('main', templateName, templateData);

    const mailOptions = {
      from: env.EMAIL_USER,
      to,
      subject,
      html: emailContent,
    }
    sgMail.send(mailOptions)
    .then(() => console.log('Email sent'))
    .catch((error) => console.error(error)); 
    // Send the email
    // await transporter.sendMail(mailOptions);
  }
}

export default new EmailService();