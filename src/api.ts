import { Router, Request, Response } from "express";
import userRouter from "./modules/user";
import send from "./utils/apiResponse";
import auth from "./middleware/auth";
import otpRouter from "./modules/otp";
import loadRouter from "./modules/load";
import roleRouter from "./modules/role";
import uploadRouter from "./modules/upload";
import shipperRouter from "./modules/shipper";
import consigneeRouter from "./modules/consignee";
import truckRouter from "./modules/trucks";

const router = Router();

// Define module routes with optional IsPrivate flag
interface ModuleRoute {
  path: Router;
  IsPrivate?: boolean;
}

const moduleRoutes: Record<string, ModuleRoute> = {
  user: { path: userRouter, IsPrivate: false },
  otp: { path: otpRouter, IsPrivate: false },
  load: { path: loadRouter, IsPrivate: true },
  role: { path: roleRouter, IsPrivate: true },
  shipper: { path: shipperRouter, IsPrivate: true },
  consignee: { path: consigneeRouter, IsPrivate: true },
  truck: { path: truckRouter, IsPrivate: true },
  upload: { path: uploadRouter, IsPrivate: true },
};

// Dynamically mount routes with optional authentication
for (const [moduleName, { path, IsPrivate }] of Object.entries(moduleRoutes)) {
  const modulePath = `/${moduleName}`; 
  router.use(modulePath, IsPrivate ? auth : (req, res, next) => next(), path); 
}

// 404 Not Found handler
router.use("*", (req: Request, res: Response) => {
  console.warn(`Unmatched route: ${req.method} ${req.originalUrl}`);
  send(res, 404, "API Not Found"); 
});

export default router;