import express from "express";
import { 
  assignLoadToCarrier, 
  createLoad, 
  deleteLoad, 
  editLoad, 
  getAssignedLoads, 
  getLoads, 
  requestLoad, 
  updateLoadStatus 
} from "./controller";

const loadRouter = express.Router();

// Route to create a new load
// This route is typically used by a broker or admin to create load details in the system
loadRouter.post("/", createLoad);

// Route to edit an existing load
// This route allows authorized users to modify load information after creation
loadRouter.put("/:loadId", editLoad);
  
// Route to retrieve all loads
// Used to get a list of loads, potentially with filters for brokers, carriers, and customers
loadRouter.get("/:loadId?", getLoads);

// Route to update the status of a load by ID
// Allows status updates for a specific load (e.g., in-transit, delivered) based on loadId
loadRouter.put("/:loadId/status", updateLoadStatus);

// Route for carriers to request a load
// Carriers can indicate interest in transporting a load, awaiting broker approval or assignment
loadRouter.post("/request/:loadId", requestLoad);

// Route for brokers to assign a load to a specific carrier
// Brokers can directly assign loads to carriers after they request or based on availability
loadRouter.post("/assign", assignLoadToCarrier);

// Route to get loads assigned to a carrier
// Carriers can view the loads they’ve been assigned to handle
loadRouter.get("/assigned", getAssignedLoads);

// Route to update the load status by a carrier
// Carriers can update their progress status on the assigned load (e.g., en-route, delivered)
// loadRouter.get("/status", getLoadStatus);


loadRouter.delete("/:loadId", deleteLoad);


export default loadRouter;
