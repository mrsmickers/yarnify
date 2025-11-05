import z from 'zod';
import { DepartmentSchema } from './create-user.dto';

export const UpdateUserDepartmentSchema = z.object({
  department: DepartmentSchema,
});

export type UpdateUserDepartmentDto = z.infer<typeof UpdateUserDepartmentSchema>;
