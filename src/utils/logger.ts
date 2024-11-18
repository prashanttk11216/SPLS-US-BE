import { createLogger, format, transports } from "winston";
import { env } from "./env"; // Assuming env is properly configured for environment variables

const { combine, timestamp, printf, colorize, errors, json } = format;

// Define a custom format for development logs
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

// Logger instance
const logger = createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }), // Enable stack trace in error logs
    env.NODE_ENV === "production" ? json() : combine(colorize(), devFormat)
  ),
  transports: [
    new transports.Console(), // Log to console
    // Optional file transport for error logs
    new transports.File({ filename: "logs/error.log", level: "error", format: json() }), // Ensure it's in JSON format
    new transports.File({ filename: "logs/combined.log", format: json() }) // Ensure it's in JSON format
  ],
  exitOnError: false, // Do not exit on handled exceptions
});

// Stream for integrating with HTTP request logging (like morgan)
logger.stream({
  write: (message: string) => logger.info(message.trim()),
});

export default logger;
