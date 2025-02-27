import express from "express";
import { getDashboardStats } from "./controller";

const dashboardRouter = express.Router();


dashboardRouter.get("/dashboard-board-stats", getDashboardStats)

export default dashboardRouter;
