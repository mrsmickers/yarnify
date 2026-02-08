import { z } from 'zod';

export const UpdateSentimentAlertConfigSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  sentimentValues: z.array(z.string()).optional(),
  frustrationMin: z.string().nullable().optional(),
  flagForReview: z.boolean().optional(),
  notifyEmails: z.array(z.string().email()).optional(),
});

export type UpdateSentimentAlertConfigDto = z.infer<typeof UpdateSentimentAlertConfigSchema>;
