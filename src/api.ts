import { Router, Request, Response } from "express";
import userRouter from "./modules/user";
import send from "./utils/apiResponse";
import auth from "./middleware/auth";
import otpRouter from "./modules/otp";
import loadRouter from "./modules/load";
import roleRouter from "./modules/role";
import uploadRouter from "./modules/upload";

const router = Router();

const handlers: Record<string, { path: Router; IsPrivateModule?: boolean }> = {
  user: {
    path: userRouter,
    IsPrivateModule: false,
  },
  otp: {
    path: otpRouter,
    IsPrivateModule: false,
  },
  load: {
    path: loadRouter,
    IsPrivateModule: true,
  },
  role: {
    path: roleRouter,
    IsPrivateModule: true,
  },
  upload: {
    path: uploadRouter,
    IsPrivateModule: true,
  },
};

for (const [moduleName, handler] of Object.entries(handlers)) {
  const path = `/${moduleName}`; // Consistent prefixing

  if (handler.IsPrivateModule) {
    router.use(path, auth, handler.path); // Use the auth middleware for private modules
  } else {
    router.use(path, handler.path); // Public modules
  }
}

// Add a catch-all handler for unmatched routes
router.use("*", (req: Request, res: Response): void => {
  // Use the req parameter for logging or any other purpose if needed
  console.warn(`Unmatched route: ${req.method} ${req.originalUrl}`);

  // Send a 404 response
  send(res, 404, "API Not Found"); // Send response without return
});

// Ensure to export the router
export default router;
