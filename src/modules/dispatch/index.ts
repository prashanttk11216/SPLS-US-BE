import express from "express";
import {
  createLoadHandler,
  updateLoadHandler,
  deleteLoadHandler,
  fetchLoadsHandler,
  updateLoadStatusHandler,
  refreshLoadAgeHandler,
} from "./controller";

const dispatchRouter = express.Router();

/**
 * @route   POST /api/dispatch
 * @desc    Create a new load (typically by a broker or admin)
 */
dispatchRouter.post("/", createLoadHandler);

/**
 * @route   PUT /api/dispatch/:loadId
 * @desc    Edit an existing load
 */
dispatchRouter.put("/:loadId", updateLoadHandler);

/**
 * @route   GET /api/dispatch/:loadId
 * @desc    Get details of list of all loads (potentially with filters) and specific load by ID
 */
dispatchRouter.get("/:loadId?", fetchLoadsHandler);

/**
 * @route   PUT /api/dispatch/:loadId/status
 * @desc    Update the status of a specific load
 */
dispatchRouter.put("/:loadId/status", updateLoadStatusHandler);

/**
 * @route   DELETE /api/dispatch/:loadId
 * @desc    Delete a specific load by ID
 */
dispatchRouter.delete("/:loadId", deleteLoadHandler);

/**
 * @route   POST /api/dispatch/refresh-age
 * @desc    Refresh the age of single or multiple loads
 */
dispatchRouter.post("/refresh-age", refreshLoadAgeHandler);

export default dispatchRouter;
