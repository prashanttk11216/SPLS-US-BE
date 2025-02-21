import { Document } from "mongoose";

export interface IQuote extends Document {
  _id: string; // Mongoose automatically generates this
  name: string;
  isActive: boolean;
  createdAt: Date; // Added by timestamps
  updatedAt: Date; // Added by timestamps
}
