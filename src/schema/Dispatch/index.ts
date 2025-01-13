import { z } from "zod";
import { Equipment } from "../../enums/Equipment";
import { DispatchLoadType } from "../../enums/DispatchLoadType";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";

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


// Fuel Service Charge Schema
const FscSchema = z.object({
  isPercentage: z.boolean().optional(),
  value: z.number().min(0, { message: "Value must be 0 or greater" }),
});

// Other Charges Schema
const OtherChargeSchema = z.object({
  description: z.string({ required_error: "Description is required" }),
  amount: z.number().min(0, { message: "Amount must be 0 or greater" }),
  isAdvance: z.boolean().optional(),
  date: z.string().optional(),
});

const CarrierFeeBreakdownSchema = z.object({
  type: z.string({ required_error: "Agreed rate type is required" }), // Example: "Flat Rate", "Per Mile"
  units: z.number().min(0).optional(),
  rate: z.number().min(0, { message: "Rate must be 0 or greater" }),
  PDs: z.number().min(0).default(0),
  fuelServiceCharge: FscSchema,
  totalRate: z.number().min(0).optional(),
  OtherChargeSchema: z.array(OtherChargeSchema).optional(),
});

// Dispatch Schema
const baseDispatchSchema = z.object({
  brokerId: z.string(),
  loadNumber: z.number().int().optional(),
  WONumber: z.number().int().optional(),
  customerId: z.string(),
  carrierId: z.string(),
  salesRep: z.string(),
  type: z.nativeEnum(DispatchLoadType, { required_error: "Type is required" }),
  units: z.number().min(0).optional(),
  PDs: z.number().min(0).optional(),
  fuelServiceCharge: FscSchema.optional(),
  otherCharges: z.object({
    totalAmount: z.number().min(0, { message: "Direct amount must be 0 or greater" }).optional(),
    breakdown: z.array(OtherChargeSchema).optional(),
  }).optional(),
  carrierFee: z.object({
    totalAmount: z.number().min(0, { message: "Total amount must be 0 or greater" }),
    breakdown: CarrierFeeBreakdownSchema.optional(),
  }).optional(),  
  equipment: z.nativeEnum(Equipment, { required_error: "Equipment is required" }),
  allInRate: z.number().min(0).optional(),
  customerRate: z.number().min(0).optional(),
  consignee: consigneeSchema.optional(),
  shipper: shipperSchema.optional(),
  postedBy: z.string().optional(),
  status: z.nativeEnum(DispatchLoadStatus).optional(),
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
