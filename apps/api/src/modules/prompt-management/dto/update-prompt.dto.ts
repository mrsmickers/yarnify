import { z } from 'zod';

export const UpdatePromptSchema = z.object({
  name: z.string().min(1).optional(),
  useCase: z
    .enum(['TRANSCRIPTION_REFINEMENT', 'CALL_ANALYSIS', 'CUSTOM'])
    .optional(),
  content: z.string().min(1).optional(),
  version: z.number().int().positive().optional(),
});

export type UpdatePromptDto = z.infer<typeof UpdatePromptSchema>;

