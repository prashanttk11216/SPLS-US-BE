import { z } from "zod";
import { Equipment } from "../../enums/Equipment";
import { Mode } from "../../enums/Mode";
import { Commodity } from "../../enums/Commodity";
import { LoadOption } from "../../enums/LoadOption";

// Common schema for Stop objects
const OriginStopSchema = z.object({
  address: z.object({
    str: z.string().min(1, { message: "address is required" }), // String representation
    lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }), // Latitude
    lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }), // Longitude
  }).optional(),
  earlyPickupDate: z.string().optional(),
  latePickupDate: z.string().optional(),
  earlyPickupTime: z.string().optional(),
  latePickupTime: z.string().optional(),
});


const DestinationStopSchema = z.object({
  address: z.object({
    str: z.string().min(1, { message: "address is required" }), // String representation
    lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }), // Latitude
    lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }), // Longitude
  }).optional(),
  earlyDropoffDate: z.string().optional(),
  lateDropoffDate: z.string().optional(),
  earlyDropoffTime: z.string().optional(),
  lateDropoffTime: z.string().optional(),
});

const originSchema = z.object({
  str: z.string().min(1, { message: "Origin is required" }), // String representation
  lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }), // Latitude
  lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }), // Longitude
});

const destinationSchema = z.object({
  str: z.string().min(1, { message: "destination is required" }), // String representation
  lat: z.number().min(-90).max(90).optional().refine((val) => val !== undefined, { message: "Latitude is required" }), // Latitude
  lng: z.number().min(-180).max(180).optional().refine((val) => val !== undefined, { message: "Longitude is required" }), // Longitude
});

// Base schema for load operations
const baseLoadSchema = z.object({
  customerId: z.string().optional(),
  brokerId: z.string().optional(),
  carrierId: z.string().optional(),

  origin: originSchema,
  originEarlyPickupDate: z.string({ required_error: "Origin early pickup date is required" }),
  originLatePickupDate: z.string().optional(),
  originEarlyPickupTime: z.string().optional(),
  originLatePickupTime: z.string().optional(),
  originStops: z.array(OriginStopSchema).optional(),

  destination: destinationSchema,
  destinationEarlyDropoffDate: z.string().optional(),
  destinationLateDropoffDate: z.string().optional(),
  destinationEarlyDropoffTime: z.string().optional(),
  destinationLateDropoffTime: z.string().optional(),
  destinationStops: z.array(DestinationStopSchema).optional(),

  equipment: z.enum(Object.keys(Equipment) as [keyof typeof Equipment]),
  mode: z.enum(Object.keys(Mode) as [keyof typeof Mode]),


  allInRate: z.number().min(0, { message: "Rate must be a positive number" }).optional(),
  customerRate: z.number().min(0, { message: "Rate must be a positive number" }).optional(),
  weight: z.number().min(0, { message: "Weight is required and must be a positive number" }).optional(),
  length: z.number().min(0, { message: "Length is required and must be a positive number" }).optional(),
  width: z.number().min(0, { message: "Width is required and must be a positive number" }).optional(),
  height: z.number().min(0, { message: "Height must be a positive number" }).optional(),
  pieces: z.number().min(0, { message: "Pieces must be a positive number" }).optional(),
  pallets: z.number().min(0, { message: "Pallets must be a positive number" }).optional(),
  miles: z.number().min(0, { message: "Miles must be a positive number" }).optional(),
  loadOption: z.enum(Object.keys(LoadOption) as [keyof typeof LoadOption]).optional(),
  specialInstructions: z.string().optional(),
  commodity: z.enum(Object.keys(Commodity) as [keyof typeof Commodity]).optional(),
  loadNumber: z.number().optional(),

  postedBy: z.string().optional(),
  status: z
    .enum([
      "Draft",
      "Published",
      "Pending Response",
      "Deal Closed",
      'In Transit',
      'Delivered',
      'Completed',
      "Cancelled",
    ])
    .optional(),
});

// Transform logic with explicit type assertions
function cleanData<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)
  ) as Partial<T>;
}

// Validation for create operation
export const createLoadSchema = baseLoadSchema.transform((data) => cleanData(data));

// Validation for update operation (all fields optional)
export const updateLoadSchema = baseLoadSchema.partial().transform((data) => cleanData(data));
