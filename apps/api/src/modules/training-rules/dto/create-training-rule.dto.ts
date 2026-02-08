import { z } from 'zod';

export const CreateTrainingRuleSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().default('general'),
  department: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  isCritical: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export type CreateTrainingRuleDto = z.infer<typeof CreateTrainingRuleSchema>;
