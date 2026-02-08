import { z } from 'zod';

export const CreateSentimentAlertConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  isActive: z.boolean().default(true),
  sentimentValues: z.array(z.string()).default([]),
  frustrationMin: z.string().nullable().optional(),
  flagForReview: z.boolean().default(true),
  notifyEmails: z.array(z.string().email()).default([]),
});

export type CreateSentimentAlertConfigDto = z.infer<typeof CreateSentimentAlertConfigSchema>;
