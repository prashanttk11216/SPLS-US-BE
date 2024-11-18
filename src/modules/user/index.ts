import { Router } from "express";
import auth from "../../middleware/auth";
import {
  login,
  create,
  profile,
  deleteUser,
  requestResetPassword,
  resetPassword,
  edit,
  getUsers,
  toggleActiveStatus,
  createBrokerUser,
} from "./controller";

const userRouter = Router();

// Route to create a new user
// Used for user registration, where basic details like name, email, and password are provided
userRouter.post("/create", create);

userRouter.post("/create/broker-user",auth, createBrokerUser);

// Route for user login
// Authenticates the user and returns a token for session management
userRouter.post("/login", login);

// Route to edit user profile
// Authenticated users can update their profile information (requires valid token)
userRouter.put("/:userId", auth, edit);

// Route to request a password reset
// Sends an email with a reset link or code if the user forgets their password
userRouter.post("/request-reset-password", requestResetPassword);

// Route to reset the user's password
// Allows the user to set a new password after verifying the reset code or link
userRouter.post("/reset-password", resetPassword);

// Route to get the authenticated user's profile
// Returns profile information for the user who is currently logged in
userRouter.get("/me", auth, profile);

// Route to get all users or a specific user by ID
// Requires admin privileges; retrieves either all users or a single user if an ID is provided
userRouter.get("/:_id?", auth, getUsers);

// Route to delete a user by ID
// Marks the user as deleted in the database; only accessible to authorized users (e.g., admins)
userRouter.delete("/:_id", auth, deleteUser);


userRouter.patch("/:userId/toggle-active", auth, toggleActiveStatus);


export default userRouter;
