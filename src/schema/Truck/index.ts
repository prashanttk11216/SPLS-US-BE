import { z } from "zod";

export const createTruckSchema = z.object({
  origin: z.object({
    str: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  availableDate: z.string(),
  destination: z.object({
    str: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  equipment: z.string(),
  allInRate: z.number().min(0).optional(),
  weight: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  comments: z.string().optional(),
  referenceNumber: z.number().optional(),
  brokerId: z.string().optional(),
  postedBy: z.string().optional(),
});

export const updateTruckSchema = createTruckSchema.partial();
