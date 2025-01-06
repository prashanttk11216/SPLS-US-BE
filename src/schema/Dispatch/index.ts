import { z } from "zod";
import { Equipment } from "../../enums/Equipment";

// Address Schema
const addressSchema = z.object({
  str: z.string().min(1, { message: "Address is required" }), // String representation
  lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }), // Latitude
  lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }), // Longitude
});

// Consignee Schema
const consigneeSchema = z.object({
  consigneeId: z.string(),
  address: addressSchema,
  date: z.string(),
  time: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  qty: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
  notes: z.string().optional(),
  PO: z.number().optional(),
});

// Shipper Schema
const shipperSchema = z.object({
  shipperId: z.string(),
  address: addressSchema,
  date: z.string(),
  time: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  qty: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  value: z.number().min(0).optional(),
  notes: z.string().optional(),
  PO: z.number().optional(),
});

// Dispatch Schema
const baseDispatchSchema = z.object({
  brokerId: z.string(),
  loadNumber: z.number().int().optional(),
  WONumber: z.number().int().optional(),
  customerId: z.string(),
  carrierId: z.string(),
  equipment: z.nativeEnum(Equipment, { required_error: "Equipment is required" }),
  allInRate: z.number().min(0).optional(),
  customerRate: z.number().min(0).optional(),
  carrierRate: z.number().min(0).optional(),
  consignee: consigneeSchema,
  shipper: shipperSchema,
  postedBy: z.string().optional(),
  status: z.enum(["Draft", "Published", "Pending Response", "Deal Closed", "Cancelled"]).optional(),
  age: z.string().optional(),
});

// Clean Data Utility Function
function cleanData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}

// Validation for create operation
export const createDispatchSchema = baseDispatchSchema.transform((data) => cleanData(data));

// Validation for update operation (all fields optional)
export const updateDispatchSchema = baseDispatchSchema
  .partial()
  .transform((data) => cleanData(data));
