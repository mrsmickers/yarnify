import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const RewriteTextBodySchema = z.object({
  text: z.string().min(1, 'Text to rewrite is required'),
  style: z.enum(['formal', 'concise', 'detailed', 'technical']).default('formal'),
});

export class RewriteTextBodyDto extends createZodDto(RewriteTextBodySchema) {}

export interface RewriteTextResponse {
  originalText: string;
  rewrittenText: string;
  style: string;
}
