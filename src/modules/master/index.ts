import { Router } from "express";
import commodityRouter from "./commodity";
import equipmentRouter from "./equipment";
import modeRouter from "./mode";
import loadOptionsRouter from "./loadOption";

const masterRouter = Router();

// Prefix each route with the module name
masterRouter.use("/commodity", commodityRouter);
masterRouter.use("/equipment", equipmentRouter);
masterRouter.use("/mode", modeRouter);
masterRouter.use("/loadOption", loadOptionsRouter);

export default masterRouter;
