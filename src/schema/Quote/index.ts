import { z } from "zod";

// Function to transform "true"/"false" strings to boolean values
const booleanStringToBoolean = z
  .union([z.boolean(), z.string().transform((val) => val === "true")])
  .refine((val) => typeof val === "boolean", { message: "Invalid boolean value" });

// Base schema for Quote (common fields)
const baseQuoteSchema = z.object({
  name: z.string().min(1, "Name is required"), // Ensures name is a non-empty string
  isActive: booleanStringToBoolean, // Allows both boolean and string "true"/"false"
});

// Create schema (requires all fields)
export const createQuoteSchema = baseQuoteSchema;

// Update schema (allows partial updates)
export const updateQuoteSchema = baseQuoteSchema.partial();
  