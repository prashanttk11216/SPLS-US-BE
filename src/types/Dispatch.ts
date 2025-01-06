import { Document, Types } from "mongoose";
import { Equipment } from "../enums/Equipment";

export interface IAddress {
  str: string; // String representation
  lat: number; // Latitude
  lng: number; // Longitude
}

export interface IConsignee {
  consigneeId: Types.ObjectId;
  address: IAddress;
  date: Date;
  time?: Date;
  description?: string;
  type?: string;
  qty?: number;
  weight?: number;
  value?: number;
  notes?: string;
  PO?: number;
}

export interface IShipper {
  shipperId: Types.ObjectId;
  address: IAddress;
  date: Date;
  time?: Date;
  description?: string;
  type?: string;
  qty?: number;
  weight?: number;
  value?: number;
  notes?: string;
  PO?: number;
}

export interface IDispatch extends Document {
  brokerId?: Types.ObjectId;
  loadNumber: number;
  WONumber: number;
  customerId?: Types.ObjectId;
  carrierId?: Types.ObjectId;
  equipment: Equipment;
  allInRate?: number;
  customerRate?: number;
  carrierRate?: number;
  consignee: IConsignee;
  shipper: IShipper;
  postedBy?: Types.ObjectId;
  status: "Draft" | "Published" | "Pending Response" | "Deal Closed" | "Cancelled";
  age?: Date;
  formattedAge?: string; // Virtual field
  createdAt?: Date;
  updatedAt?: Date;
}
