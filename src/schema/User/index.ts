import { z } from "zod";
import { UserRole } from "../../enums/UserRole";
import { getRoles, hasAccess } from "../../utils/role";

// Base schema without superRefine
const baseUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  confirmPassword: z.string().min(8, "Confirm password is required"),
  primaryNumber: z.string().min(10, "Contact number must be valid"),
  roles: z.array(z.string()).min(1, "At least one role is required"),
  company: z.string().optional(),
  avatarUrl: z.string().optional(),
  brokerId: z.string().optional(),
  postedBy: z.string().optional(),
  employeeId: z.string().optional(), // Optional, required only for specific roles

  // Customer-specific fields
  address: z
    .object({
      str: z.string().min(1, { message: "address is required" }), // String representation
      lat: z
        .number()
        .min(-90)
        .max(90)
        .optional()
        .refine((val) => val !== undefined, {
          message: "Latitude is required",
        }), // Latitude
      lng: z
        .number()
        .min(-180)
        .max(180)
        .optional()
        .refine((val) => val !== undefined, {
          message: "Longitude is required",
        }), // Longitude
    })
    .optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  zip: z.string(),

  // Billing-specific fields
  billingAddress: z
    .object({
      str: z.string().min(1, { message: "address is required" }), // String representation
      lat: z
        .number()
        .min(-90)
        .max(90)
        .optional()
        .refine((val) => val !== undefined, {
          message: "Latitude is required",
        }), // Latitude
      lng: z
        .number()
        .min(-180)
        .max(180)
        .optional()
        .refine((val) => val !== undefined, {
          message: "Longitude is required",
        }), // Longitude
    })
    .optional(),
  billingAddressLine2: z.string().optional(),
  billingAddressLine3: z.string().optional(),
  billingCountry: z.string().optional(),
  billingState: z.string().optional(),
  billingCity: z.string().optional(),
  billingZip: z.string().optional(),
});

// Add refinements to the base schema
export const createUserSchema = baseUserSchema.superRefine(async (data, ctx) => {
  // Ensure passwords match
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      path: ["confirmPassword"],
      message: "Passwords don't match",
      code: z.ZodIssueCode.custom,
    });
  }
  let roles = await getRoles();
  
  // Conditional validation for roles
  if (data.roles.includes(roles[UserRole.BROKER_USER].id) && !data.employeeId) {
    ctx.addIssue({
      path: ["employeeId"],
      message: "Employee ID is required for BROKER_USER",
      code: z.ZodIssueCode.custom,
    });
  }
  
  // Billing fields are mandatory for customers and carriers
  if (data.roles.includes(roles[UserRole.CUSTOMER].id) || data.roles.includes(roles[UserRole.CARRIER].id)) {
    const requiredFields = [
      "billingAddress",
      "billingCountry",
      "billingState",
      "billingCity",
      "billingZip",
    ];

    requiredFields.forEach((field: string) => {
      if (!data[field as keyof typeof data]) {
        ctx.addIssue({
          path: [field],
          message: `${field.replace(
            "billing",
            "Billing"
          )} is required for customers and carriers`,
          code: z.ZodIssueCode.custom,
        });
      }
    });
  }
});

// Create the partial schema for editing user details
export const editUserSchema = baseUserSchema.partial();

/**
 * Schema for login.
 * Ensures that either `email` or `employeeId` is provided based on the role.
 */
export const loginSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  employeeId: z.string().min(1, "Employee ID is required for broker users").optional(),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});
