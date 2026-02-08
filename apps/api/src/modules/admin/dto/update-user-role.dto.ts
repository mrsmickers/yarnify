import z from 'zod';
import { RoleSchema } from './create-user.dto';

export const UpdateUserRoleSchema = z.object({
  role: RoleSchema,
});

export type UpdateUserRoleDto = z.infer<typeof UpdateUserRoleSchema>;

