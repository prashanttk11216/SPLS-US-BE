import express from "express";
import {
  createLoadHandler,
  updateLoadHandler,
  deleteLoadHandler,
  fetchLoadsHandler,
  updateLoadStatusHandler,
  requestLoadHandler,
  notifyCarrierAboutLoadHandler,
  confirmRateWithCustomerHandler,
  refreshLoadAgeHandler,
} from "./controller";

const loadRouter = express.Router();

/**
 * @route   POST /api/loads
 * @desc    Create a new load (typically by a broker or admin)
 */
loadRouter.post("/", createLoadHandler);

/**
 * @route   POST /api/loads/create-alert
 * @desc    Notify carrier about a new load alert
 */
loadRouter.post("/create-alert", notifyCarrierAboutLoadHandler);

/**
 * @route   PUT /api/loads/:loadId
 * @desc    Edit an existing load
 */
loadRouter.put("/:loadId", updateLoadHandler);

/**
 * @route   GET /api/loads/:loadId
 * @desc    Get details of list of all loads (potentially with filters) and specific load by ID
 */
loadRouter.get("/:loadId?", fetchLoadsHandler);

/**
 * @route   PUT /api/loads/:loadId/status
 * @desc    Update the status of a specific load
 */
loadRouter.put("/:loadId/status", updateLoadStatusHandler);

/**
 * @route   POST /api/loads/request/:loadId
 * @desc    Carrier requests a load for transport
 */
loadRouter.post("/request/:loadId", requestLoadHandler);

/**
 * @route   POST /api/loads/rateconfirm/:loadId
 * @desc    Notify the customer about rate confirmation
 */
loadRouter.post("/rateconfirm/:loadId", confirmRateWithCustomerHandler);

/**
 * @route   DELETE /api/loads/:loadId
 * @desc    Delete a specific load by ID
 */
loadRouter.delete("/:loadId", deleteLoadHandler);

/**
 * @route   POST /api/loads/refresh-age
 * @desc    Refresh the age of single or multiple loads
 */
loadRouter.post("/refresh-age", refreshLoadAgeHandler);

export default loadRouter;
