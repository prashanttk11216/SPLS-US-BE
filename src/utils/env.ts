import { z } from "zod";

// Define the custom environment variables schema
const envSchema = z.object({
    PORT: z.coerce.number(),
    MONGO_URI: z.string(),
    JWT_PRIVATE_KEY: z.string(),
    SALT_ROUNDS: z.coerce.number(),
    HOST: z.string(),
    NODE_ENV: z.string(),
    EMAIL_USER: z.string(),
    EMAIL_PASS: z.string(),
}).passthrough(); // Allows other env variables (like NODE_ENV) to be included without explicit definition

// Parse and export the environment variables
export const env = envSchema.parse(process.env);

// Now, you can access NODE_ENV or any other inherited environment variable
console.log("NODE_ENV", env.NODE_ENV); // No error, NODE_ENV is available if set in process.env
