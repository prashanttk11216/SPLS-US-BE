import mongoose from "mongoose";
import { Commodity } from "../enums/Commodity";
import { Equipment } from "../enums/Equipment";
import { Mode } from "fs";
import { IUser } from "./User";

export interface ILoad extends Document {
  customerId?: mongoose.Types.ObjectId | IUser;
  brokerId?: mongoose.Types.ObjectId | IUser;
  adminId?: mongoose.Types.ObjectId;
  carrierId?: mongoose.Types.ObjectId | IUser;
  origin: {
    str: string; // String representation of the address
    lat: number; // Latitude
    lng: number; // Longitude
  }; 
  originEarlyPickupDate: Date;
  originLatePickupDate?: Date;
  originEarlyPickupTime?: Date;
  originLatePickupTime?: Date;
  originStops?: {
    address: {
      str: string; // String representation of the address
      lat: number; // Latitude
      lng: number; // Longitude
    };
    earlyPickupDate?: Date;
    latePickupDate?: Date;
    earlyPickupTime?: Date;
    latePickupTime?: Date;
  }[];
  destination: {
    str: string; // String representation of the address
    lat: number; // Latitude
    lng: number; // Longitude
  };
  destinationEarlyDropoffDate?: Date;
  destinationLateDropoffDate?: Date;
  destinationEarlyDropoffTime?: Date;
  destinationLateDropoffTime?: Date;
  destinationStops?: {
    address: {
      str: string; // String representation of the address
      lat: number; // Latitude
      lng: number; // Longitude
    };
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
  pieces?: number;
  pallets?: number;
  miles?: number;
  loadOption?: string;
  specialInstructions?: string;
  commodity: Commodity;
  loadNumber?: number;
  postedBy?: mongoose.Types.ObjectId;
  status: string;
  age?: Date;
  formattedAge?: string;
  dhoDistance?: number;
  dhdDistance?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
