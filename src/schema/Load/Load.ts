import { z } from "zod";

export const createLoadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  origin: z.object({
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
  }),
  destination: z.object({
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
  }),
  stops: z
    .array(
      z.object({
        city: z.string().min(1, "City is required"),
        state: z.string().min(1, "State is required"),
        date: z.date().optional(),
      })
    )
    .optional(),
  equipment: z.string().min(1, "Equipment is required"),
  mode: z.string().min(1, "Mode is required"),
  allInRate: z.number().positive("Rate must be positive"),
  weight: z.number().positive("Weight must be positive"),
  dimensions: z.object({
    length: z.number().positive("Length must be positive"),
    width: z.number().positive("Width must be positive"),
    height: z.number().optional(),
  }),
  specialInfo: z.string().optional(),
  customerId: z.string().optional(),
  brokerId: z.string().optional(),
  carrierId: z.string().optional(),
});


export const editLoadSchema = createLoadSchema.partial().extend({
  loadId: z.string().nonempty("Load ID is required")
});

// export const assignCarrierSchema = z.object({
//   loadId: z.string().nonempty("Load ID is required"),
//   carrierId: z.string().nonempty("Carrier ID is required"),
// });


export const updateLoadStatusSchema = z.object({
  loadId: z.string().nonempty("Load ID is required"),
  status: z.enum(["pending", "in_transit", "completed", "canceled"]),
});


export const loadFilterSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "canceled"]).optional(),
  originCity: z.string().optional(),
  destinationCity: z.string().optional(),
  mode: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});
