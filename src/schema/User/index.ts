import { z } from "zod";
import { UserRole } from "../../enums/UserRole";

// Common validation patterns
const emailSchema = z.string().email("Invalid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters long");
const roleSchema = z.enum([
  UserRole.BROKER_ADMIN,
  UserRole.BROKER_USER,
  UserRole.CARRIER,
  UserRole.CUSTOMER,
]);

/**
 * Schema for creating a new user.
 */
export const createUserSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(8, "Confirm password is required"),
    primaryNumber: z.string().min(10, "Contact number must be valid"),
    role: roleSchema,
    company: z.string().optional(),
    avatarUrl: z.string().optional(),
    brokerId: z.string().optional(),
    employeeId: z.string().optional(), // Optional, required only for specific roles

    // Customer-specific fields
    address: z.string(),
    addressLine2: z.string().optional(),
    addressLine3: z.string().optional(),
    country: z.string(),
    state: z.string(),
    city: z.string(),
    zip: z.string(),

    // Billing-specific fields
    billingAddress: z.string().optional(),
    billingAddressLine2: z.string().optional(),
    billingAddressLine3: z.string().optional(),
    billingCountry: z.string().optional(),
    billingState: z.string().optional(),
    billingCity: z.string().optional(),
    billingZip: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // Ensure passwords match
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        message: "Passwords don't match",
        code: z.ZodIssueCode.custom,
      });
    }

    // Conditional validation for roles
    if (data.role === UserRole.BROKER_USER && !data.employeeId) {
      ctx.addIssue({
        path: ["employeeId"],
        message: "Employee ID is required for BROKER_USER",
        code: z.ZodIssueCode.custom,
      });
    }
      // Billing fields are mandatory for customers and carrier
    if (data.role === UserRole.CUSTOMER || data.role === UserRole.CARRIER) {
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
            message: `${field.replace("billing", "Billing")} is required for customers`,
            code: z.ZodIssueCode.custom,
          });
        }
      });
    }
  });

/**
 * Schema for editing user details.
 */
export const editUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  primaryNumber: z.string().optional(),
  company: z.string().optional(),
  avatarUrl: z.string().optional(),
  address: z.string().optional(),
  addressLine2: z.string().optional(),
  addressLine3: z.string().optional(),
  country: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
});

/**
 * Schema for login.
 * Ensures that either `email` or `employeeId` is provided based on the role.
 */
export const loginSchema = z
  .object({
    email: emailSchema.optional(),
    employeeId: z.string().min(1, "Employee ID is required for broker users").optional(),
    password: passwordSchema,
  });
