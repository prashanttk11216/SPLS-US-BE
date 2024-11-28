import { Document } from "mongoose";

/**
 * Interface representing an Equipment document in MongoDB.
 */
export interface IEquipment extends Document {
  label: string; // Full label (e.g., "F - Flatbed")
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Interface representing a Mode document in MongoDB.
 */
export interface IMode extends Document {
  label: string; //Full label (e.g., "Truck Load", "Intermodal")
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Interface representing a Load Option document in MongoDB.
 */
export interface ILoadOption extends Document {
  label: string; // Full label (e.g., "Tarps", "Hazardous")
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Interface representing a Commodity document in MongoDB.
 */
export interface ICommodity extends Document {
  label: string; // Full label (e.g., "Advertising Materials", "Aggregate")
  createdAt?: Date;
  updatedAt?: Date;
}
