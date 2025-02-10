import { z } from "zod";

/**
 * Base Zod schema for Shipper.
 */
export const baseShipperSchema = z.object({
  firstName: z.string().nonempty("First name is required").max(100, "First name is too long"),
  lastName: z.string().nonempty("Last name is required").max(100, "Last name is too long"),
  email: z.string().email("Invalid email format"),
  primaryNumber: z.string().nonempty("Primary number is required"),
  address: z.object({
    str: z.string().min(1, { message: "Address is required" }), // String representation
    lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }), // Latitude
    lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }), // Longitude
  }),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  zip: z.string(),
  shippingHours: z.string().optional(),
  brokerId: z.string(),
  postedBy: z.string(),
  isAppointments: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for validating Shipper creation requests.
 */
export const createShipperSchema = baseShipperSchema;

/**
 * Schema for validating Shipper update requests (partial update).
 */
export const updateShipperSchema = baseShipperSchema.partial();
