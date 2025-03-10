import { Router } from "express";
import { uploadSingle, uploadMultiple } from "./middleware";
import { handleSingleFileUpload, handleMultipleFileUpload, deleteFile } from "./controller";

const uploadRouter = Router();

// Single file upload route
uploadRouter.post("/single",uploadSingle, handleSingleFileUpload);

// Multiple files upload route
uploadRouter.post("/multiple", uploadMultiple, handleMultipleFileUpload);

// delete file route
uploadRouter.delete("/delete/:filename", deleteFile);


export default uploadRouter;
