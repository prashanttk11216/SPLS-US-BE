import { z } from "zod";

/**
 * Zod schema for validating Shipper creation requests.
 */
export const createShipperSchema = z.object({
  firstName: z.string().nonempty("First name is required").max(100, "First name is too long"),
  lastName: z.string().nonempty("Last name is required").max(100, "Last name is too long"),
  email: z.string().email("Invalid email format"),
  primaryNumber: z.string().nonempty("Primary number is required"),
  address: z.string(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  zip: z.string(),
  shippingHours: z.string().optional(),
  brokerId: z.string(),
  isAppointments: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Zod schema for validating Shipper update requests.
 */
export const updateShipperSchema = createShipperSchema.partial();
