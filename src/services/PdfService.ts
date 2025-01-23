import { compileTemplateWithLayout } from '../utils/templateCompiler';

export interface PDFData {
    [key: string]: any; // Generic type for any data type that could be used in a template
}

export interface PDFOptions {
    templateName: string;
    templateData: PDFData;
}

export class PDFService {
    async generateHTMLTemplate(options: PDFOptions): Promise<string> {
        const { templateName, templateData } = options;

        const pdfContent = await compileTemplateWithLayout('pdfMain', templateName, templateData);

        return pdfContent;
    }
}

export default new PDFService();