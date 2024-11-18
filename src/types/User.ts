import { Document } from 'mongoose';
import { UserRole } from '../enums/UserRole';
import { RoleDocument } from '../modules/role/model';

export interface IUser extends Document {
  _id: string; // Mongoose adds this field automatically
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  contactNumber: string;
  // role: UserRole;
  role: RoleDocument["_id"];
  company?: string;
  avatarUrl?: string,
  accessLevel?: 'full' | 'limited'; // Only applicable for broker users
  isVerified: boolean;
  employeeId: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
