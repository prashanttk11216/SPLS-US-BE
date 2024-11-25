import { config } from "dotenv";
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
config({ path: envFile });
import express, { Express } from "express";
import router from "./api";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./utils/env";
import { Server } from "http";
import connectDB from "./db/connection";
import errorHandler from "./middleware/errorHandler";
import logger from "./utils/logger";
import path from "path";

const app: Express = express();
const PORT: number = env.PORT || 5000;
const HOSTNAME = env.HOST || "localhost";

// Validate required environment variables
if (!env.MONGO_URI || !env.PORT) {
  logger.error("Required environment variables are missing");
  process.exit(1);
}

// Middleware configuration
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet()); // Secure headers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined")); // Logger

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));



// Connect to the database
const startDatabase = async () => {
  try {
    await connectDB();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Database connection error:", error);
    process.exit(1);
  }
};

let server: Server;

// Start server function
const startApp = async () => {
  await startDatabase();

  // Routes
  app.use("/api", router);

  // Use global error handler
  app.use(errorHandler); // Use the imported error handler middleware

  server = app.listen(PORT, HOSTNAME, () => {
    logger.info(`Server is running at http://${HOSTNAME}:${PORT}`);
  });
};

// Handle graceful shutdown
const shutdown = () => {
  server?.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startApp();
