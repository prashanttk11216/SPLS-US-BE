import { NextFunction, Request, Response } from "express";
import {UserModel} from "../modules/user/model";
import send from "../utils/apiResponse";
import { findByToken } from "../utils/encryption";
import { env } from "../utils/env";
import { IUser } from "../types/User";

async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Get the authorization header and ensure it is a string
  const authHeader = req.headers.authorization || req.headers.Authorization;

  // Ensure authHeader is a string
  const authHeaderString = Array.isArray(authHeader) ? authHeader[0] : authHeader;

  // Check if the Authorization header is present and starts with 'Bearer'
  if (!authHeaderString || !authHeaderString.startsWith("Bearer ")) {
    send(res, 401, "Unauthorized: Token missing or invalid format"); // Send response without return
    return; // Stop execution
  }

  const token = authHeaderString.split(" ")[1];

  // Check if token is provided
  if (!token) {
    send(res, 401, "Unauthorized: Token not provided"); // Send response without return
    return; // Stop execution
  }

  try {
    const userExist = findByToken(token, env.JWT_PRIVATE_KEY);

    // Check if user exists based on the token
    if (typeof userExist === "string") { // Checking if userExist is a string
      send(res, 401, "Unauthorized: " + userExist); // Send error message without return
      return; // Stop execution
    }

    // Now userExist is of type JwtPayload
    const user = await UserModel.findById(userExist._id).populate("roles").select("-password");

    // Check if the user was found
    if (!user) {
      send(res, 401, "Unauthorized: User not found"); // Send response without return
      return; // Stop execution
    }

    // Attach user to request object for access in later middleware/routes
    (req as Request & { user?: IUser }).user = user;

    next(); // Call next to proceed to the next middleware or route handler
  } catch (error) {
    console.error("Authentication error:", error);
    send(res, 500, "Internal server error"); // Send response without return
    return; // Stop execution
  }
}

export default auth;
