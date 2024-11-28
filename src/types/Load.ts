import mongoose from "mongoose";
import { Commodity } from "../enums/Commodity";
import { Equipment } from "../enums/Equipment";
import { Mode } from "fs";

export interface ILoad extends Document {
  customerId?: mongoose.Types.ObjectId;
  brokerId?: mongoose.Types.ObjectId;
  adminId?: mongoose.Types.ObjectId;
  carrierId?: mongoose.Types.ObjectId;
  origin: string;
  originEarlyPickupDate: Date;
  originLatePickupDate?: Date;
  originEarlyDropoffTime?: Date;
  originLateDropoffTime?: Date;
  originStops?: {
    address: string;
    earlyPickupDate?: Date;
    latePickupDate?: Date;
    earlyPickupTime?: Date;
    latePickupTime?: Date;
  }[];
  destination: string;
  destinationEarlyDropoffDate?: Date;
  destinationLateDropoffDate?: Date;
  destinationEarlyDropoffTime?: Date;
  destinationLateDropoffTime?: Date;
  destinationStops: {
    address: string;
    earlyDropoffDate?: Date;
    lateDropoffDate?: Date;
    earlyDropoffTime?: Date;
    lateDropoffTime?: Date;
  }[];
  equipment: Equipment;
  mode: Mode;
  allInRate?: number;
  customerRate?: number;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  distance?: number;
  pieces?: number;
  pallets?: number;
  loadOption?: string;
  specialInstructions?: string;
  commodity: Commodity;
  loadNumber?: string;
  postedBy?: mongoose.Types.ObjectId;
  status: "pending" | "in_transit" | "completed" | "canceled";
  isDaft?: boolean; 
  createdAt?: Date;
  updatedAt?: Date;
}
