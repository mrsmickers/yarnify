import { z } from 'zod';

export const CreatePromptSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  useCase: z.enum([
    'TRANSCRIPTION_REFINEMENT',
    'CALL_ANALYSIS',
    'CUSTOM',
  ]),
  content: z.string().min(1, 'Content is required'),
  version: z.number().int().positive().default(1),
});

export type CreatePromptDto = z.infer<typeof CreatePromptSchema>;

