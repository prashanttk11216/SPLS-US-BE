import express from "express";
import { getBrokerDashboardStats, getCarrierDashboardStats, getCustomerDashboardStats } from "./controller";

const dashboardRouter = express.Router();


dashboardRouter.get("/broker-dashboard-board-stats", getBrokerDashboardStats)

dashboardRouter.get("/customer-dashboard-board-stats", getCustomerDashboardStats);

dashboardRouter.get("/carrier-dashboard-board-stats", getCarrierDashboardStats);


export default dashboardRouter;
