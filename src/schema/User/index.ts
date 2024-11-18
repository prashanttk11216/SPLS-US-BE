import { z } from "zod";
import { UserRole } from "../../enums/UserRole";

// Schema for creating a user
export const createUserSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters long"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
    contactNumber: z.string().min(10, "Contact number must be valid"),
    role: z.enum(
      [
        UserRole.BROKER_ADMIN,
        UserRole.BROKER_USER,
        UserRole.CARRIER,
        UserRole.CUSTOMER,
      ],
      {
        message: "Invalid role",
      }
    ),
    company: z.string().optional(),
    avatarUrl: z.string().optional(),
    employeeId: z.string().optional(),  // Optional by default
  })
  .superRefine((data, ctx) => {
    // Conditional validation logic based on the role
    if (data.role !== UserRole.BROKER_USER && !data.email) {
      ctx.addIssue({
        path: ["email"],
        message: "Email is required for roles other than BROKER_USER",
        code: z.ZodIssueCode.custom,
      });
    }

    if (data.role === UserRole.BROKER_USER && !data.employeeId) {
      ctx.addIssue({
        path: ["employeeId"],
        message: "Employee ID is required for BROKER_USER",
        code: z.ZodIssueCode.custom,
      });
    }

    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        path: ["confirmPassword"],
        message: "Passwords don't match",
        code: z.ZodIssueCode.custom,
      });
    }
  });

// Schema for editing user details
export const editUserSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  contactNumber: z.string().optional(),
  company: z.string().optional(),
  avatarUrl: z.string().optional(),
});

// Updated schema for login, where 'email' is required for non-broker users
// and 'employeeId' is required for broker users
export const loginSchema = z.object({
  email: z.string().email("Invalid email address").optional(), // Optional for broker users
  employeeId: z.string().min(1, "Employee ID is required for broker users").optional(), // Optional for non-broker users
  password: z.string().min(8, "Password must be at least 8 characters long"),
});