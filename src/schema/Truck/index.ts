import { z } from "zod";
import { Equipment } from "../../enums/Equipment";

export const createTruckSchema = z.object({
  origin: z.object({
    str: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  availableDate: z.string(),
  destination: z.object({
    str: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
  equipment: z.enum(Object.keys(Equipment) as [keyof typeof Equipment]),
  allInRate: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  miles: z.number().optional(),
  comments: z.string().optional(),
  referenceNumber: z.number().optional(),
  brokerId: z.string().optional(),
  postedBy: z.string().optional(),
});

export const updateTruckSchema = createTruckSchema.partial();
