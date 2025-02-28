import { z } from "zod";
import { DispatchLoadStatus } from "../../enums/DispatchLoadStatus";

// Address Schema
const addressSchema = z.object({
  str: z.string().min(1, { message: "Address is required" }).optional(), // String representation
  lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }).optional(), // Latitude
  lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }).optional(), // Longitude
});

// Consignee Schema
const consigneeSchema = z.object({
  consigneeId: z.string().optional(),
  address: addressSchema.optional(),
  date: z.string().optional(),
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
  shipperId: z.string().optional(),
  address: addressSchema.optional(),
  date: z.string().optional(),
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
  value: z.number().min(0, { message: "Value must be 0 or greater" }).optional(),
});

// Other Charges Schema
const OtherChargeSchema = z.object({
  description: z.string({ required_error: "Description is required" }).optional(),
  amount: z.number().min(0, { message: "Amount must be 0 or greater" }).optional(),
  isAdvance: z.boolean().optional(),
  date: z.string().optional(),
});

const CarrierFeeBreakdownSchema = z.object({
  type: z.string({ required_error: "Agreed rate type is required" }).optional(), // Example: "Flat Rate", "Per Mile"
  units: z.number().min(0).optional(),
  rate: z.number().min(0, { message: "Rate must be 0 or greater" }).optional(),
  PDs: z.number().min(0).default(0),
  fuelServiceCharge: FscSchema.optional(),
  totalRate: z.number().min(0).optional(),
  OtherChargeSchema: z.array(OtherChargeSchema).optional(),
});

const DocumentSchema = z.object({
  filename: z.string(),
  path: z.string(),
});

// Dispatch Schema
const baseDispatchSchema = z.object({
  brokerId: z.string().optional(),
  customerId: z.string().optional(),
  loadId: z.string().optional(),
  carrierId: z.string().optional(),
  loadNumber: z.number().optional(),
  WONumber: z.string().optional(),
  salesRep: z.string().optional(),
  type: z.string().optional(),
  units: z.number().min(0).optional(),
  PDs: z.number().min(0).optional(),
  fuelServiceCharge: FscSchema.optional(),
  otherCharges: z.object({
    totalAmount: z.number().min(0, { message: "Direct amount must be 0 or greater" }).optional(),
    breakdown: z.array(OtherChargeSchema).optional(),
  }).optional(),
  carrierFee: z.object({
    totalAmount: z.number().min(0, { message: "Total amount must be 0 or greater" }).optional(),
    breakdown: CarrierFeeBreakdownSchema.optional(),
  }).optional(),  
  equipment: z.string().optional(),
  allInRate: z.number().min(0).optional(),
  customerRate: z.number().min(0).optional(),
  consignee: consigneeSchema.optional(),
  shipper: shipperSchema.optional(),
  documents: z.array(DocumentSchema).optional(),
  postedBy: z.string().optional(),
  status: z.string().optional(),
  age: z.string().optional(),
});

// Clean Data Utility Function
function cleanData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}


export const createDispatchSchema = baseDispatchSchema.superRefine((data, ctx) => {
  if (data.status === DispatchLoadStatus.Published) {
    if (!data.customerId) {
      ctx.addIssue({
        code: "custom",
        path: ["customerId"],
        message: "Customer ID is required for loads",
      });
    }
    if (!data.loadId) {
      ctx.addIssue({
        code: "custom",
        path: ["loadId"],
        message: "Load ID is required for loads",
      });
    }
    if (!data.carrierId) {
      ctx.addIssue({
        code: "custom",
        path: ["carrierId"],
        message: "Carrier ID is required for published loads",
      });
    }
    if (!data.equipment) {
      ctx.addIssue({
        code: "custom",
        path: ["equipment"],
        message: "equipment is required for loads",
      });
    }
  }
});


// Validation for create operation
export const transformedCreateDispatchSchema = createDispatchSchema.transform((data) => cleanData(data));

// Validation for update operation (all fields optional)
export const updateDispatchSchema = baseDispatchSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.status === DispatchLoadStatus.Published) {
      if (!data.customerId) {
        ctx.addIssue({
          code: "custom",
          path: ["customerId"],
          message: "Customer ID is required for loads",
        });
      }
      if (!data.carrierId) {
        ctx.addIssue({
          code: "custom",
          path: ["carrierId"],
          message: "Carrier ID is required for published loads",
        });
      }
      if (!data.equipment) {
        ctx.addIssue({
          code: "custom",
          path: ["equipment"],
          message: "equipment is required for loads",
        });
      }
    }
  })
  .transform((data) => cleanData(data));
