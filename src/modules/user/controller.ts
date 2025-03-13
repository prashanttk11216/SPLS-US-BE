import { Request, Response } from "express";
import os from "os";
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
import logger from "../../utils/logger"; // Ensure you have a logger utility
import mongoose, { SortOrder } from "mongoose";
import EmailService, { SendEmailOptions } from "../../services/EmailService";
import { getPaginationParams } from "../../utils/paginationUtils";
import { getRoles, hasAccess } from "../../utils/role";
import { UserRole } from "../../enums/UserRole";
import { buildSearchFilter } from "../../utils/parseSearchQuerty";
import { parseSortQuery } from "../../utils/parseSortQuery";
import { applyPopulation } from "../../utils/populateHelper";

/**
 * Create a new user account, validate the input, hash the password, and handle the user verification process.
 * If the user is a customer and the request is from an admin, the account is automatically verified.
 * Otherwise, an OTP is generated and sent to the user's email for verification.
 * @param req - Express request object containing the user data and query parameters.
 * @param res - Express response object used to send the response back to the client.
 */
export async function create(req: Request, res: Response): Promise<void> {
  try {
    const validatedData = await createUserSchema.parseAsync(req.body);

    const existingUserByEmail = await UserModel.findOne({
      email: validatedData.email.toLowerCase(),
    });

    if (existingUserByEmail) {
      send(res, 409, "Email already registered");
      return;
    }

    const hashedPassword = await hashPassword(
      validatedData.password,
      env.SALT_ROUNDS
    );

    // Determine if the user creating the customer is an admin
    let isVerified = false;
    let verificationCode;
      let roles = await getRoles();

    if (req.query.isAdmin && (validatedData.roles.includes(roles[UserRole.CUSTOMER].id) || validatedData.roles.includes(roles[UserRole.CARRIER].id))) {
      isVerified = true;
      logger.info(`User account created for ${validatedData.email}`);

      // Set up the email notification options
      const emailOptions: SendEmailOptions = {
        to: validatedData.email, // Send the notification to the broker's email
        subject: "Account Created",
        templateName: "accountCreated",
        templateData: {
          email: validatedData.email.toLowerCase(),
          password: validatedData.password
        },
      };

      // Send email notification to the broker (uncomment this when email functionality is ready)
      await EmailService.sendNotificationEmail(emailOptions);
    } else {
      verificationCode = await createOTP(validatedData.email);
      logger.info(
        `Generated OTP: ${verificationCode} for ${validatedData.email}`
      );

      // Set up the email notification options
      const emailOptions: SendEmailOptions = {
        to: validatedData.email, // Send the notification to the broker's email
        subject: "Email Verification",
        templateName: "emailVerification",
        templateData: {
          email: validatedData.email.toLowerCase(),
          verificationCode: verificationCode
        },
      };

      // Send email notification to the broker (uncomment this when email functionality is ready)
      await EmailService.sendNotificationEmail(emailOptions);
    }

    const newUser = new UserModel({
      ...validatedData,
      email: validatedData.email.toLowerCase(),
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
      console.log("error", error.errors);
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
      user = await UserModel.findOne({ employeeId: validatedData.employeeId }).populate("roles");
    } else if (validatedData.email) {
      // Login for other users (customer, carrier, broker_admin) using email
      user = await UserModel.findOne({ email: validatedData.email.toLowerCase() }).populate("roles");
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

    // Ensure the user email (or account) is verified
    if (!user.isVerified) {
      send(res, 403, "User email is not verified. Please verify to log in.");
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

    // Prepare the user response data
    const { password, ...userResponse } = user.toObject();
    userResponse.email = user.email.toLowerCase(); 

    // Generate JWT token for the authenticated user
    const token = await generateToken(userResponse, env.JWT_PRIVATE_KEY, {
      expiresIn: "12h",
    });

    if (validatedData.employeeId) {
      let mainAdmin = await UserModel.findOne({ roles: ['67cefceb42c5de89fae83399'] });

      // Get the current login time
      const loginTime = new Date().toISOString();

      // Get IP address from request
      const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

      // Get PC name (hostname)
      const pcName = os.hostname();

      const emailOptions: SendEmailOptions = {
        to: mainAdmin?.email,
        subject: 'User Login Notification',
        templateName: 'userLogin',
        templateData: {
          employeeId: validatedData.employeeId,
          firstName: user.firstName,
          lastName: user.lastName,
          contact: user.primaryNumber,
          loginTime,
          ipAddress,
          pcName,
        },
      };

      await EmailService.sendNotificationEmail(emailOptions);
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
    if (!(user && hasAccess(user.roles, { roles: [UserRole.BROKER_ADMIN] }))) {
      send(
        res,
        403,
        "Unauthorized. Only broker admins can create broker users."
      );
      return;
    }

    // Validate the request body
    const validatedData = await createUserSchema.parseAsync(req.body);

    // Check for duplicate email or employeeId
    const existingUser = await UserModel.findOne({
      $or: [
        { email: validatedData.email.toLowerCase() },
        { employeeId: validatedData.employeeId },
      ],
    });

    if (existingUser) {
      send(res, 409, "Email or Employee ID already registered");
      return;
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
      email: validatedData.email.toLowerCase(),
      password: hashedPassword,
      isVerified,
    });

    await newBrokerUser.save();

    // Set up the email notification options
    const emailOptions: SendEmailOptions = {
      to: validatedData.email, // Send the notification to the broker's email
      subject: "Account Created",
      templateName: "accountCreated",
      templateData: {
        email: validatedData.email.toLowerCase(),
        password: validatedData.password,
        employeeId: validatedData.employeeId
      },
    };

    // Send email notification to the broker (uncomment this when email functionality is ready)
    await EmailService.sendNotificationEmail(emailOptions);

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
        
    let query = UserModel.findOne({
      _id: userId,
      isDeleted: false,
    });
    query = applyPopulation(query, req.query.populate as string);
    const user = await query.select("-password");

    if (!user) {
      send(res, 404, "User not found");
      return;
    }

    send(res, 200, "Profile data retrieved successfully", user);
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
    const user = (req as Request & { user?: IUser })?.user;


    if (_id) {
      let query = UserModel.findOne({
        _id,
        isDeleted: false,
      }).select("-password");

      query = applyPopulation(query, req.query.populate as string)
      const user = await query;

      if (!user) {
        send(res, 404, "User not found");
        return;
      }

      send(res, 200, "Retrieved successfully", user);
      return;
    }

    const { page, limit, skip } = getPaginationParams(req.query);


    let filters: any = { isDeleted: false };

    // Role filter
    const role = req.query.role;
    if (role) {
      let roles = await getRoles(); 
      filters.roles = { $in: [new mongoose.Types.ObjectId(roles[role as string].id)] }
    }    

    // Role-based query conditions
    // if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_USER] })) {
    //   filters.postedBy = user._id;
    // } else
     if (user && hasAccess(user.roles, { roles: [UserRole.BROKER_ADMIN, UserRole.BROKER_USER] })) {
      filters.brokerId = user.brokerId;
    }

    // Search functionality
    const search = req.query.search as string;
    const searchField = req.query.searchField as string; // Get the specific field to search

    if (search && searchField) {
      const numberFields = ["primaryNumber"]; // Define numeric fields
      const multiFieldMappings = { name: ["firstName", "lastName"] }; // Dynamic mapping
      filters = { ...filters, ...buildSearchFilter(search, searchField, numberFields, multiFieldMappings) };
    }

    // Sort functionality
    const sortQuery = req.query.sort as string | undefined;
    let sortOptions: [string, SortOrder][] = []; // Array of tuples for sorting
    if(sortQuery){
      const validFields = ["email",
        "primaryNumber",
        "isActive",
        "name",
        "company",
        "createdAt",
        "employeeId"];
      sortOptions = parseSortQuery(sortQuery, validFields);
    }

    // Add all other query parameters dynamically into filters
    for (const [key, value] of Object.entries(req.query)) {
      if (!['page', 'limit', 'role', 'sort', 'search', 'searchField', 'populate'].includes(key)) {
        filters[key] = value;
      }
    }

    // Total count and user retrieval with pagination and sorting
    const totalItems = await UserModel.countDocuments(filters);

    let query = UserModel.find({ ...filters, })
      .select("-password")
      .skip(skip)
      .limit(limit)
      .sort(sortOptions);

    query = applyPopulation(query, req.query.populate as string);
    
    const users = await query;

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
    const user = await UserModel.findOneAndDelete({ _id: userId });

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
    const user = await UserModel.findOne({ email: email.toLowerCase() });
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
    const user = await UserModel.findOne({ email: email.toLowerCase() });
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
    if (!(requester && hasAccess(requester.roles, {roles: [UserRole.BROKER_ADMIN]}))) {
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
