import { config } from "dotenv";
const envFile = process.env.NODE_ENV === "production" ? ".env.production" : process.env.NODE_ENV == "development" ? ".env.development" : ".env.my-local";
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
import sgMail from '@sendgrid/mail';

const app: Express = express();
const PORT: number = env.PORT || 5000;
const HOSTNAME = env.HOST || "localhost";

// Validate required environment variables
const requiredEnvs = ["MONGO_URI", "PORT"];
const missingEnvs = requiredEnvs.filter(envVar => !env[envVar]);
if (missingEnvs.length) {
  logger.error(`Required environment variables are missing: ${missingEnvs.join(", ")}`);
  process.exit(1);
}


app.use(express.static(path.join(__dirname, '../build'))); 


// Middleware configuration
app.use(cors({ origin: '*', credentials: false }));
app.use(helmet()); // Secure headers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("combined")); // Logger
// Middleware to set headers
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site'); // or 'cross-origin'
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // or 'same-origin'
  next();
});
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Database connection (async/await for clarity)
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

// Start server function (async/await for clarity)
const startApp = async () => {
  await startDatabase();  
  
  // sgMail.setApiKey(env.SEND_GRID_EMAIL_API);

  // Routes
  app.use("/api", router);

  app.get("/health", (req,res)=>{
    res.send("working");
  });

  // Use global error handler
  app.use(errorHandler); // Use the imported error handler middleware

  server = app.listen(PORT, HOSTNAME, () => {
    logger.info(`Server is running at http://${HOSTNAME}:${PORT}`);
  });
};

// Graceful shutdown with better logging
const shutdown = () => {
  server?.close(() => {
    logger.info("Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

startApp();