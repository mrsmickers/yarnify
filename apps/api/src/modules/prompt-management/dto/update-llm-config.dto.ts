import { z } from 'zod';

const LLMSettingsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  response_format: z.enum(['text', 'json_object']).optional(),
});

export const UpdateLLMConfigSchema = z.object({
  name: z.string().min(1).optional(),
  useCase: z
    .enum([
      'TRANSCRIPTION',
      'TRANSCRIPTION_REFINEMENT',
      'CALL_ANALYSIS',
      'EMBEDDINGS',
    ])
    .optional(),
  modelName: z.string().min(1).optional(),
  provider: z.enum(['openai', 'azure', 'anthropic']).optional(),
  settings: LLMSettingsSchema.optional(),
});

export type UpdateLLMConfigDto = z.infer<typeof UpdateLLMConfigSchema>;

