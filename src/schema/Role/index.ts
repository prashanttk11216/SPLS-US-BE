import { z } from "zod";

export const roleSchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1, "Role name is required"),
  permissions: z.array(
    z.object({
      resource: z.string().min(1, "Resource name is required"),
      actions: z.array(z.string()).nonempty("At least one action is required"),
    })
  ).optional(),
});

export type IRole = z.infer<typeof roleSchema>;
