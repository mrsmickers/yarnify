import { z } from 'zod';

export const UpdateScoringCategorySchema = z.object({
  name: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_]+$/, 'Name must be lowercase with underscores only')
    .optional(),
  label: z.string().min(1).max(100).optional(),
  weight: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type UpdateScoringCategoryDto = z.infer<typeof UpdateScoringCategorySchema>;
