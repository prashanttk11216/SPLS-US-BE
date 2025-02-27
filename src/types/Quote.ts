import { Document } from "mongoose";
import { IUser } from "./User";

export interface IQuote extends Document {
  _id: string; // Mongoose automatically generates this
  name: string;
  isActive: boolean;
  brokerId: string | IUser;
  postedBy: string | IUser;
  createdAt: Date; // Added by timestamps
  updatedAt: Date; // Added by timestamps
}
