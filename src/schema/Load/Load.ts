import { z } from "zod";
import { Equipment } from "../../enums/Equipment";
import { Mode } from "../../enums/Mode";
import { Commodity } from "../../enums/Commodity";

// Common schema for Stop objects
const StopSchema = z.object({
  address: z.string().optional(),
  earlyPickupDate: z.string().optional(),
  latePickupDate: z.string().optional(),
  earlyDropoffDate: z.string().optional(),
  lateDropoffDate: z.string().optional(),
});

// Validation for create operation
export const createLoadSchema = z.object({
  customerId: z.string().optional(), // Optional since it's not always required
  brokerId: z.string().optional(),
  carrierId: z.string().optional(),

  origin: z.string().min(1, { message: "Origin is required" }),
  originEarlyPickupDate: z.string({ required_error: "Origin early pickup date is required" }),
  originLatePickupDate: z.string().optional(),
  originEarlyPickupTime: z.string().optional(),
  originLatePickupTime: z.string().optional(),
  originStops: z.array(StopSchema).optional(),

  destination: z.string().min(1, { message: "Destination is required" }),
  destinationEarlyDropoffDate: z.string().optional(),
  destinationLateDropoffDate: z.string().optional(),
  destinationEarlyDropoffTime: z.string().optional(),
  destinationLateDropoffTime: z.string().optional(),
  destinationStops: z.array(StopSchema).optional(),

  equipment: z.nativeEnum(Equipment, { required_error: "Equipment is required" }),
  mode: z.nativeEnum(Mode, { required_error: "Mode is required" }),

  allInRate: z.number().min(0, { message: "Rate must be a positive number" }).optional(),
  customerRate: z.number().min(0, { message: "Rate must be a positive number" }).optional(),
  weight: z.number().min(0, { message: "Weight is required and must be a positive number" }).optional(),
  length: z.number().min(0, { message: "Length is required and must be a positive number" }).optional(),
  width: z.number().min(0, { message: "Width is required and must be a positive number" }).optional(),
  height: z.number().min(0, { message: "Height must be a positive number" }).optional(),
  distance: z.number().min(0, { message: "Distance must be a positive number" }).optional(),
  pieces: z.number().min(0, { message: "Pieces must be a positive number" }).optional(),
  pallets: z.number().min(0, { message: "Pallets must be a positive number" }).optional(),
  loadOption: z.string().optional(),
  specialInstructions: z.string().optional(),
  commodity: z.union([z.nativeEnum(Commodity), z.string().max(0)]).optional(),
  loadNumber: z.number().optional(),

  postedBy: z.string().optional(),
  isDaft: z.boolean().optional(),

  status: z.enum(["pending", "in_transit", "completed", "canceled"]).optional(),
});

// Validation for update operation (all fields optional)
export const updateLoadSchema = createLoadSchema.partial();


// export const assignCarrierSchema = z.object({
//   loadId: z.string().nonempty("Load ID is required"),
//   carrierId: z.string().nonempty("Carrier ID is required"),
// });


export const updateLoadStatusSchema = z.object({
  loadId: z.string().nonempty("Load ID is required"),
  status: z.enum(["pending", "in_transit", "completed", "canceled"]),
});
