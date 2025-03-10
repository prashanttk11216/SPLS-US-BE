import { Request, Response } from "express";
import logger from "../../utils/logger";
import send from "../../utils/apiResponse";
import path from "path";
import { pathExists, remove } from "fs-extra";

export const handleSingleFileUpload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.file) {
      send(res, 400, "No file uploaded");
      return;
    }

    // Construct the public URL
    const fileUrl = `uploads/${req.file.filename}`;

    logger.info(`File uploaded: ${req.file.filename}`);
    send(res, 200, "File uploaded successfully", {
      ...req.file,
      path: fileUrl, // Replace with public URL
    });
  } catch (error) {
    logger.error("Error during file upload:", error);
    send(res, 500, "Server error");
  }
};

export const handleMultipleFileUpload = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      send(res, 400, "No files uploaded");
      return;
    }

    // Generate public URLs for all uploaded files
    const uploadedFiles = (req.files as Express.Multer.File[]).map((file) => ({
      ...file,
      path: `uploads/${file.filename}`,
    }));

    logger.info(
      `Files uploaded: ${uploadedFiles.map((file) => file.filename).join(", ")}`
    );
    send(res, 200, "Files uploaded successfully", { files: uploadedFiles });
  } catch (error) {
    logger.error("Error during multiple file upload:", error);
    send(res, 500, "Server error");
  }
};

export const deleteFile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { filename } = req.params; // Get filename from request params

    if (!filename) {
      send(res, 400, "Filename is required");
      return;
    }

    // Construct the full path to the file
    const filePath = path.join(__dirname, "../../../uploads/", filename);

    // Check if the file exists
    const fileExists = await pathExists(filePath);
    if (!fileExists) {
      send(res, 404, "File not found");
      return;
    }

    // Delete the file from the uploads folder using fs-extra
    await remove(filePath);

    send(res, 200, "Document deleted successfully");
  } catch (err) {
    console.error("Error in deleteFile function:", err);
    send(res, 500, "Internal server error");
  }
};

