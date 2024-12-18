import express from "express";
import {
  createTruck,
  deleteTruck,
  getMatchingTrucks,
  getTrucks,
  updateTruck,
} from "./controller";

const truckRouter = express.Router();

// Route to create a new Truck
truckRouter.post("/", createTruck);

// Route to Get a Trucks
truckRouter.get("/:truckId?", getTrucks);

// Route to update a Truck
truckRouter.put("/:truckId", updateTruck);

// Route to Delete a Truck
truckRouter.delete("/:truckId", deleteTruck);

// Route to Get a Trucks based on Load
truckRouter.get("/matches/:loadId", getMatchingTrucks);

export default truckRouter;
