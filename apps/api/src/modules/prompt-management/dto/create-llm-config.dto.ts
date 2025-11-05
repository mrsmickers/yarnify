import { z } from 'zod';

const LLMSettingsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  response_format: z.enum(['text', 'json_object']).optional(),
});

export const CreateLLMConfigSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  useCase: z.enum([
    'TRANSCRIPTION',
    'TRANSCRIPTION_REFINEMENT',
    'CALL_ANALYSIS',
    'EMBEDDINGS',
  ]),
  modelName: z.string().min(1, 'Model name is required'),
  provider: z.enum(['openai', 'azure', 'anthropic']).default('openai'),
  settings: LLMSettingsSchema.default({}),
});

export type CreateLLMConfigDto = z.infer<typeof CreateLLMConfigSchema>;
export type LLMSettings = z.infer<typeof LLMSettingsSchema>;

