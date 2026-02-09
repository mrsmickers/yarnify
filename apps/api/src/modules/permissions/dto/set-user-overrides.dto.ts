import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SetUserOverridesSchema = z.object({
  overrides: z.array(
    z.object({
      code: z.string().describe('Permission code'),
      granted: z.boolean().nullable().describe('true = grant, false = revoke, null = use role default'),
    }),
  ).describe('Array of permission overrides'),
});

export class SetUserOverridesDto extends createZodDto(SetUserOverridesSchema) {}
