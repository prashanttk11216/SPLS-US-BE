import { Buffer } from "buffer";
import puppeteer, { Browser, PDFOptions } from 'puppeteer-core';


export class PdfGenerator {
  private browser: Browser | null = null;

  // Initialize Puppeteer
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        args: [ '--disable-gpu', '--disable-setuid-sandbox', '--no-sandbox', '--no-zygote' ],
        ignoreDefaultArgs: ['--disable-extensions'] 
      });
    }
    return this.browser;
  }

  // Generate PDF
  public async generatePdf(htmlContent: string, options: PDFOptions, outputFilePath?: string) {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Set HTML content
      await page.setContent(htmlContent, { waitUntil: "networkidle2" });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        path: outputFilePath, // Save to file if path is provided
        format: options.format || "A4",
        printBackground: options.printBackground ?? true,
        margin: options.margin,
        displayHeaderFooter: options.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    } finally {
      await page.close();
      await this.closeBrowser();
    }
  }

  // Close Puppeteer browser
  public async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
