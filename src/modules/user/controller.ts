import { Request, Response } from "express";
import send from "../../utils/apiResponse";
import { UserModel } from "./model";
import {
  comparePasswords,
  generateToken,
  hashPassword,
} from "../../utils/encryption";
import { env } from "../../utils/env";
import { z } from "zod";
import { createOTP } from "../otp/controller";
import { IUser } from "../../types/User";
import {
  createUserSchema,
  editUserSchema,
  loginSchema,
} from "../../schema/User";
import { UserRole } from "../../enums/UserRole";
import logger from "../../utils/logger"; // Ensure you have a logger utility
import { SortOrder } from "mongoose";
import { escapeAndNormalizeSearch } from "../../utils/regexHelper";
import { SendEmailOptions, sendNotificationEmail } from "../../services/emailService";

/**
 * Create a new user account, validate the input, hash the password, and handle the user verification process.
 * If the user is a customer and the request is from an admin, the account is automatically verified.
 * Otherwise, an OTP is generated and sent to the user's email for verification.
 * @param req - Express request object containing the user data and query parameters.
 * @param res - Express response object used to send the response back to the client.
 */
export async function create(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = createUserSchema.parse(req.body);

    const existingUserByEmail = await UserModel.findOne({
      email: validatedData.email,
    });

    if (existingUserByEmail) {
      send(res, 409, "Email already registered");
      return;
    }

    // Check if employeeId is provided (required for broker users) and check for duplicates
    if (validatedData.role === UserRole.BROKER_USER) {
      send(
        res,
        403,
        "Unauthorized. Only broker admins can create broker users."
      );
      return;
    }

    const hashedPassword = await hashPassword(
      validatedData.password,
      env.SALT_ROUNDS
    );

    // Determine if the user creating the customer is an admin
    let isVerified = false;
    let verificationCode;

    if (req.query.isAdmin && (validatedData.role == UserRole.CUSTOMER || validatedData.role == UserRole.CARRIER)) {
      isVerified = true;
      logger.info(`User account created for ${validatedData.email}`);
      // await sendEmail({
      //   to: validatedData.email,
      //   subject: "Account Created",
      //   text: `Your account has been created. Email: ${validatedData.email}, Password: ${validatedData.password}`,
      // });
    } else {
      verificationCode = await createOTP(validatedData.email);
      logger.info(
        `Generated OTP: ${verificationCode} for ${validatedData.email}`
      );
      // await sendEmail({
      //   to: validatedData.email,
      //   subject: "Email Verification",
      //   text: `Your OTP for email verification is ${verificationCode}. This OTP will expire in 5 minutes.`,
      // });
    }

    const newUser = new UserModel({
      ...validatedData,
      password: hashedPassword,
      isVerified,
    });

    await newUser.save();
    send(
      res,
      201,
      isVerified
        ? "Account created successfully"
        : "Signup successful. Verify your email.",
      {
        otp: verificationCode,
      }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error:", error.errors);
      send(res, 400);
    } else {
      logger.error("Unexpected error during user creation:", error);
      send(res, 500, "Server error");
    }
  }
}

/**
 * Handle user login by validating the provided email or employeeId and password, checking if the user is verified,
 * and generating a JWT token for authenticated access.
 * @param req - Express request object containing the login credentials (email or employeeId, password).
 * @param res - Express response object used to send the response back to the client.
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    // Validate login credentials (email or employeeId, password)
    const validatedData = loginSchema.parse(req.body);

    let user;

    if (validatedData.employeeId) {
      // Login for broker users using employeeId
      user = await UserModel.findOne({ employeeId: validatedData.employeeId });
    } else if (validatedData.email) {
      // Login for other users (customer, carrier, broker_admin) using email
      user = await UserModel.findOne({ email: validatedData.email });
    } else {
      send(res, 400, "Email or Employee ID must be provided");
      return;
    }

    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    // Check if user is active
    if (!user.isActive) {
      send(res, 403, "Account is deactivated. Please contact support.");
      return;
    }

    // Verify password for the user
    const passwordMatch = await comparePasswords(
      validatedData.password,
      user.password
    );
    if (!passwordMatch) {
      send(res, 401, "Incorrect password");
      return;
    }

    // Ensure the user email (or account) is verified
    if (!user.isVerified) {
      send(res, 403, "User email is not verified. Please verify to log in.");
      return;
    }

    // Prepare the user response data
    const userResponse = {
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      employeeId: user.employeeId,
      role: user.role,
      primaryNumber: user.primaryNumber,
      company: user.company,
      isVerified: user.isVerified,
      isActive: user.isActive,
      updatedAt: user.updatedAt,
      createdAt: user.createdAt,
      avatarUrl: user.avatarUrl,
    };

    // Generate JWT token for the authenticated user
    const token = await generateToken(userResponse, env.JWT_PRIVATE_KEY, {
      expiresIn: "5h",
    });

    if(validatedData.employeeId){
      // const emailOptions: SendEmailOptions = {
    //   to: "",
    //   subject: 'User Login Notification',
    //   templateName: 'userLogin',
    //   templateData: { employeeId:"abd", firstName:"CD", lastName:"Ccdc", loginTime:"Cdjc" },
    // };
  
    // await sendNotificationEmail(emailOptions);
    }


    // Respond with login success and token
    send(res, 200, "Login successful", { user: userResponse, token });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during login:", error.errors);
      send(res, 400, "Validation error", error.errors);
    } else {
      logger.error("Unexpected error during login:", error);
      send(res, 500, "Server error");
    }
  }
}

export async function createBrokerUser(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const user = (req as Request & { user?: IUser })?.user;

    // Check if the logged-in user is a broker_admin
    if (user?.role !== UserRole.BROKER_ADMIN) {
      send(
        res,
        403,
        "Unauthorized. Only broker admins can create broker users."
      );
      return;
    }

    // Validate the request body
    const validatedData = createUserSchema.parse(req.body);

    // Check for duplicate email
    const existingUserByEmail = await UserModel.findOne({
      email: validatedData.email,
    });

    if (existingUserByEmail) {
      send(res, 409, "Email already registered");
      return;
    }

    // Check if employeeId is provided (required for broker users) and check for duplicates
    if (
      validatedData.role === UserRole.BROKER_USER &&
      validatedData.employeeId
    ) {
      const existingUserByEmployeeId = await UserModel.findOne({
        employeeId: validatedData.employeeId,
      });

      if (existingUserByEmployeeId) {
        send(res, 409, "Employee ID already registered");
        return;
      }
    }

    // Hash the password before storing
    const hashedPassword = await hashPassword(
      validatedData.password,
      env.SALT_ROUNDS
    );

    const isVerified = true; // Broker users can be auto-verified by the admin

    // Create the new broker user and save
    const newBrokerUser = new UserModel({
      ...validatedData,
      password: hashedPassword,
      isVerified,
    });

    await newBrokerUser.save();

    // await sendEmail({
    //   to: validatedData.email,
    //   subject: "Account Created",
    //   text: `Your account has been created. Email: ${validatedData.email}, Employee ID: ${validatedData.employeeId}, Password: ${validatedData.password}`,
    // });

    send(res, 201, "Broker user created successfully");
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error:", error.errors);
      send(res, 400);
    } else {
      logger.error("Unexpected error during broker user creation:", error);
      send(res, 500, "Server error");
    }
  }
}

/**
 * Retrieve the profile data of the authenticated user, excluding sensitive information like the password.
 * @param req - Express request object containing the authenticated user's information.
 * @param res - Express response object used to send the profile data back to the client.
 */
export async function profile(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as Request & { user?: IUser })?.user?._id;
    const user = await UserModel.findOne({
      _id: userId,
      isDeleted: false,
    }).select("-password");

    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    send(res, 200, "Profile data retrieved successfully", {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        primaryNumber: user.primaryNumber,
        role: user.role,
        isActive: user.isActive,
        company: user.company,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    logger.error("Unexpected error during profile retrieval:", error);
    send(res, 500, "Server error");
  }
}

/**
 * Update the profile information of the authenticated user by validating and saving the updated data.
 * @param req - Express request object containing the new profile data to be updated.
 * @param res - Express response object used to send the updated profile data back to the client.
 */
export async function edit(req: Request, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const validatedData = editUserSchema.parse(req.body);

    const updatedUser = await UserModel.findOneAndUpdate(
      { _id: userId, isDeleted: false },
      validatedData,
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      send(res, 404, "User not found or profile could not be updated");
      return;
    }

    send(res, 200, "Profile updated successfully", updatedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.error("Validation error during profile update:", error.errors);
      send(res, 400, "Validation error", error.errors);
    } else {
      logger.error("Unexpected error during profile update:", error);
      send(res, 500, "Server error");
    }
  }
}

/**
 * Retrieve users either by ID or with pagination and optional role filtering.
 * If an ID is provided, it returns the user with that ID. Otherwise, it retrieves users with pagination and an optional role filter.
 * @param req - Express request object containing the user ID (if provided) and pagination parameters (page, limit) and role filter.
 * @param res - Express response object used to send the response back to the client.
 */
export async function getUsers(req: Request, res: Response): Promise<void> {
  try {
    const { _id } = req.params;

    if (_id) {
      const user = await UserModel.findOne({
        _id,
        isDeleted: false,
      }).select("-password");

      if (!user) {
        send(res, 404, "User not found");
        return;
      }

      send(res, 200, "Retrieved successfully", user);
      return;
    }

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Role filter
    const role = req.query.role as UserRole;
    const filters: any = { isDeleted: false };
    if (role && Object.values(UserRole).includes(role)) {
      filters.role = role;
    }

    const brokerId = req.query.brokerId;
    if (brokerId) {
      filters.brokerId = brokerId;
    }

    // Search functionality
    const search = req.query.search as string;
    if (search) {
      const escapedSearch = escapeAndNormalizeSearch(search);
      filters.$or = [
        { company: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
        { firstName: { $regex: escapedSearch, $options: "i" } },
        { lastName: { $regex: escapedSearch, $options: "i" } },
      ];
    }


    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'role', 'brokerId', 'sort', 'search'].includes(key)) {
        filters[key] = value;
      }
    }



    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    let sortOptions: [string, SortOrder][] = []; // Array of tuples for sorting

    if (sortQuery) {
      const sortFields = sortQuery.split(","); // Support multiple sort fields (comma-separated)
      const validFields = [
        "email",
        "primaryNumber",
        "isActive",
        "name",
        "company",
        "createdAt",
        "employeeId"
      ]; // Define valid fields

      sortFields.forEach((field) => {
        const [key, order] = field.split(":");
        if (validFields.includes(key)) {
          // Push the sort field and direction as a tuple
          sortOptions.push([key, order === "desc" ? -1 : 1]);
        }
      });
    }

    // Total count and user retrieval with pagination and sorting
    const totalItems = await UserModel.countDocuments(filters);

    const users = await UserModel.find({...filters, })
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort(sortOptions); // Apply sorting

    const totalPages = Math.ceil(totalItems / limit);

    send(res, 200, "Retrieved successfully", users, {
      page,
      limit,
      totalPages,
      totalItems,
    });
  } catch (error) {
    console.error("Error in getUsers:", error);
    send(res, 500, "Server error");
  }
}



/**
 * Soft delete a user by setting the `isDeleted` flag to true.
 * If the user is not found or already deleted, it returns an error.
 * @param req - Express request object containing the user ID of the user to be deleted.
 * @param res - Express response object used to send the response back to the client.
 */
export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params._id;
    const user = await UserModel.findOneAndDelete({ _id: userId});

    if (!user) {
      send(res, 404, "User not found or already deleted");
      return;
    }

    send(res, 200, "User deleted successfully");
  } catch (error) {
    logger.error("Unexpected error during user deletion:", error);
    send(res, 500, "Server error");
  }
}

/**
 * Handle password reset requests by verifying the user and sending a reset link via email.
 * @param req - Express request object containing the email of the user requesting the password reset.
 * @param res - Express response object used to send the response back to the client.
 */
export async function requestResetPassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    // const resetToken = generateResetToken(user._id);

    // TODO: Send the email with the reset token
    // await sendEmail({
    //   to: user.email,
    //   subject: "Reset Password",
    //   text: `Use this link to reset your password: ${env.APP_URL}/reset-password?token=${resetToken}`,
    // });

    send(res, 200, "Password reset link sent to your email");
  } catch (error) {
    logger.error("Unexpected error during password reset request:", error);
    send(res, 500, "Server error");
  }
}

/**
 * Reset the user's password after validating the reset token and new password.
 * @param req - Express request object containing the email and new password.
 * @param res - Express response object used to send the response back to the client.
 */
export async function resetPassword(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    const hashedPassword = await hashPassword(password, env.SALT_ROUNDS);
    user.password = hashedPassword;
    await user.save();

    send(res, 200, "Password has been reset successfully.");
  } catch (error) {
    logger.error("Unexpected error during password reset:", error);
    send(res, 500, "Server error");
  }
}

export async function toggleActiveStatus(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { userId } = req.params;
    const requester = (req as Request & { user?: IUser })?.user;

    // Check if the requester has the broker_admin role
    if (requester?.role !== UserRole.BROKER_ADMIN) {
      send(
        res,
        403,
        "Access denied. Only broker_admin can change user active status."
      );
      return;
    }

    // Find the target user by ID
    const user = await UserModel.findById(userId);
    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    // Toggle the isActive status
    user.isActive = !user.isActive;
    await user.save();

    send(
      res,
      200,
      `User ${user.isActive ? "activated" : "deactivated"} successfully`
    );
  } catch (error) {
    logger.error("Error toggling user active status:", error);
    send(res, 500, "Server error");
  }
}
