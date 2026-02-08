import { z } from 'zod';

export const CreateScoringCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(50)
    .regex(/^[a-z_]+$/, 'Name must be lowercase with underscores only'),
  label: z.string().min(1, 'Label is required').max(100),
  weight: z.number().int().min(0).max(100).default(100),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export type CreateScoringCategoryDto = z.infer<typeof CreateScoringCategorySchema>;
