import { existsSync, mkdirSync } from "fs";
import multer from "multer";
import path from "path";

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, "../../../uploads");

        // Check if the directory exists, if not, create it
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true }); // Ensure all parent directories are created
        }
    
        cb(null, uploadPath); // Pass the directory to the callback
    },
    filename: (req, file, cb) => {
      try {
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/\s+/g, "_");
        cb(null, `${timestamp}_${originalName}`); // First argument is null
      } catch (err) {
        cb(err as Error, ""); // Explicitly cast err to Error
      }
    },
  });
  
  

// File filter to validate file types (if needed)
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true); // No error, file accepted
    } else {
      cb(new Error("Unsupported file type") as Error); // Explicitly cast to Error
    }
};
  
  

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB file size limit
  },
});

export const uploadSingle = upload.single("file"); // Single file upload middleware
export const uploadMultiple = upload.array("files", 10); // Multiple file upload middleware (max 10 files)
