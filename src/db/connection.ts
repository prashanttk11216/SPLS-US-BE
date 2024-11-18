import mongoose, { ConnectOptions } from "mongoose";
import logger from "../utils/logger"; // Assuming a logger utility
import { env } from "../utils/env";

const MAX_RETRIES = 5;
let retries = 0;

// Database connection options for production
const options: ConnectOptions = {
  autoIndex: false, // Disable auto-creation of indexes in production
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 5000,
};

// Main connection function with retry logic
const connectDB = async (): Promise<void> => {
  if (!env.MONGO_URI) {
    logger.error("MongoDB URI is not defined in environment variables");
    process.exit(1);
  }

  const connectWithRetry = async () => {
    try {
      await mongoose.connect(env.MONGO_URI as string, options);
      logger.info("Database connection established successfully.");
      retries = 0; // Reset retry count on successful connection
    } catch (error) {
      retries += 1;
      logger.error(`Database connection attempt ${retries} failed.`, error);

      if (retries < MAX_RETRIES) {
        logger.warn(`Retrying database connection (Attempt ${retries + 1} of ${MAX_RETRIES})...`);
        setTimeout(connectWithRetry, 2000);
      } else {
        logger.error("Maximum retries reached. Exiting application.");
        process.exit(1);
      }
    }
  };

  await connectWithRetry();
};

// Start database function
const startDatabase = async () => {
  try {
    await connectDB();
  } catch (error) {
    logger.error("Database connection error:", error);
    process.exit(1);
  }
};

export default startDatabase;
