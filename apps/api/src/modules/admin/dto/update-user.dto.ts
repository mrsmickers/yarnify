import z from 'zod';
import { DepartmentSchema } from './create-user.dto';

export const UpdateUserSchema = z.object({
  displayName: z
    .string({
      required_error: 'Display name is required',
      invalid_type_error: 'Display name must be a string',
    })
    .trim()
    .min(1, 'Display name cannot be empty'),
  department: DepartmentSchema,
  role: z.enum(['admin', 'user']).optional(),
  enabled: z.boolean().optional(),
  contextBox: z.string().nullish(),
});

export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
