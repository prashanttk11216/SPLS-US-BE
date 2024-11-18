import mongoose from "mongoose";

export interface ILoad extends Document {
    customerId: mongoose.Types.ObjectId; // Refers to the customer
    brokerId?: mongoose.Types.ObjectId; // Refers to the broker managing the load
    carrierId?: mongoose.Types.ObjectId; // Refers to the assigned carrier
    origin: { city: string; state: string };
    destination: { city: string; state: string };
    stops?: Array<{ city: string; state: string; date?: Date }>;
    equipment: string;
    mode: string;
    allInRate: number;
    weight: number;
    dimensions: { length: number; width: number; height?: number };
    status: "pending" | "in_transit" | "completed" | "canceled";
    specialInfo?: string;
    createdAt: Date;
    updatedAt: Date;
  }