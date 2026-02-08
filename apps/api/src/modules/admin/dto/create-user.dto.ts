import z from 'zod';
import { isPendingEntraOid } from '../../../common/constants/entra.constants';

export const DepartmentSchema = z.enum(
  ['sales', 'service', 'marketing', 'finance', 'projects'],
  {
    required_error: 'Department is required',
    invalid_type_error: 'Department must be one of: sales, service, marketing, finance, projects',
  },
);

export type Department = z.infer<typeof DepartmentSchema>;

export const RoleSchema = z.enum(['admin', 'manager', 'team_lead', 'user'], {
  required_error: 'Role is required',
  invalid_type_error: 'Role must be one of: admin, manager, team_lead, user',
});

export type UserRole = z.infer<typeof RoleSchema>;

export const CreateUserSchema = z.object({
  oid: z
    .string({
      invalid_type_error: 'Object ID must be a string',
    })
    .uuid('Object ID must be a valid UUID')
    .refine(
      (value) => !isPendingEntraOid(value),
      'Object ID cannot use a reserved pending prefix',
    )
    .optional(),
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .email('Invalid email address'),
  displayName: z
    .string({
      required_error: 'Display name is required',
      invalid_type_error: 'Display name must be a string',
    })
    .trim()
    .min(1, 'Display name cannot be empty'),
  department: DepartmentSchema,
  role: RoleSchema,
  enabled: z
    .boolean({
      invalid_type_error: 'Enabled must be a boolean',
    })
    .optional()
    .default(true),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
