import { Document, Types } from "mongoose";
import { Equipment } from "../enums/Equipment";
import { DispatchLoadType } from "../enums/DispatchLoadType";
import { DispatchLoadStatus } from "../enums/DispatchLoadStatus";
import { IUser } from "./User";

export interface IAddress {
  str: string; // String representation
  lat: number; // Latitude
  lng: number; // Longitude
}

export interface IDispatchConsignee {
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

export interface IDispatchShipper {
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

export interface IFsc {
  isPercentage: boolean,
  value: number
}

export interface IOtherChargeBreakdown {
  description: string;
  amount: number;
  isAdvance: boolean;
  date: Date
}

export interface IOtherCharge {
  totalAmount: number;
  breakdown: IOtherChargeBreakdown[];
}

export interface ICarrierFeeBreakdown {
  type: DispatchLoadType,
  units: number;
  rate: number,
  PDs: number,
  fuelServiceCharge: IFsc,
  totalRate: number;
  OtherChargeSchema: IOtherChargeBreakdown[]
}


export interface ICarrierFee {
  totalAmount: number;
  breakdown: ICarrierFeeBreakdown;
}

export interface IDispatch extends Document {
  brokerId?: Types.ObjectId | IUser;
  loadNumber: number;
  WONumber: string;
  customerId?: Types.ObjectId | IUser;
  carrierId?: Types.ObjectId | IUser;
  salesRep: Types.ObjectId;
  type: DispatchLoadType;
  units: number;
  PDs: number;
  fuelServiceCharge: IFsc;
  otherCharges: IOtherCharge;
  carrierFee: ICarrierFee;
  equipment: Equipment;
  allInRate?: number;
  customerRate?: number;
  consignee: IDispatchConsignee;
  shipper: IDispatchShipper;
  postedBy?: Types.ObjectId;
  status: DispatchLoadStatus;
  age?: Date;
  formattedAge?: string; // Virtual field
  createdAt?: Date;
  updatedAt?: Date;
}
