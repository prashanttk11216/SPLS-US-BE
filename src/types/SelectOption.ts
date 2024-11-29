import { Document } from "mongoose";

/**
 * Base Interface for documents that have label, createdAt, and updatedAt.
 */
export interface IBaseDocument extends Document {
  label: string; // Full label (e.g., "F - Flatbed", "Truck Load", "Tarps")
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Interface representing an Equipment document in MongoDB.
 */
export interface IEquipment extends IBaseDocument {}

/**
 * Interface representing a Mode document in MongoDB.
 */
export interface IMode extends IBaseDocument {}

/**
 * Interface representing a Load Option document in MongoDB.
 */
export interface ILoadOption extends IBaseDocument {}

/**
 * Interface representing a Commodity document in MongoDB.
 */
export interface ICommodity extends IBaseDocument {}