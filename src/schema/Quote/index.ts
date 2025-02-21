import { z } from "zod";

// Base schema for Quote (common fields)
const baseQuoteSchema = z.object({
  name: z.string().min(1, "Name is required"), // Ensures name is a non-empty string
  isActive: z.boolean(), // Ensures isActive is a required boolean
});

// Create schema (requires all fields)
export const createQuoteSchema = baseQuoteSchema;

// Update schema (allows partial updates)
export const updateQuoteSchema = baseQuoteSchema.partial();
