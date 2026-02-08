import { z } from 'zod';

export const UpdateTrainingRuleSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.string().optional(),
  department: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  isCritical: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export type UpdateTrainingRuleDto = z.infer<typeof UpdateTrainingRuleSchema>;
