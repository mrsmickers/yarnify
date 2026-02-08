import { z } from 'zod';

export const ReviewAlertSchema = z.object({
  reviewedBy: z.string().min(1, 'Reviewer is required'),
  reviewNotes: z.string().optional(),
});

export type ReviewAlertDto = z.infer<typeof ReviewAlertSchema>;

export const DismissAlertSchema = z.object({
  dismissedBy: z.string().min(1, 'Dismisser is required'),
});

export type DismissAlertDto = z.infer<typeof DismissAlertSchema>;
