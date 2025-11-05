import z from 'zod';

export const UpdateUserRoleSchema = z.object({
  role: z.enum(['admin', 'user'], {
    required_error: 'Role is required',
    invalid_type_error: 'Role must be admin or user',
  }),
});

export type UpdateUserRoleDto = z.infer<typeof UpdateUserRoleSchema>;

