import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const SetRolePermissionsSchema = z.object({
  permissions: z.array(z.string()).describe('Array of permission codes to assign to the role'),
});

export class SetRolePermissionsDto extends createZodDto(SetRolePermissionsSchema) {}
