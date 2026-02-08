import { z } from 'zod';

export const UpsertCompanyInfoSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  description: z.string().min(1, 'Description is required'),
  industry: z.string().nullish(),
  location: z.string().nullish(),
  website: z.string().nullish(),
  additionalContext: z.string().nullish(),
});

export type UpsertCompanyInfoDto = z.infer<typeof UpsertCompanyInfoSchema>;
