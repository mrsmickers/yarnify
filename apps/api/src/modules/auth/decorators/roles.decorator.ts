import { SetMetadata } from '@nestjs/common';

/**
 * Decorator to specify required roles for a route or controller.
 * Must be used with RolesGuard.
 * 
 * @param roles - One or more role strings (e.g., 'admin', 'user')
 * 
 * @example
 * ```typescript
 * @Get('admin-only')
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('admin')
 * async adminEndpoint() {
 *   return { message: 'Only admins can see this' };
 * }
 * ```
 * 
 * @example Multiple roles (OR logic - user needs ANY of these roles)
 * ```typescript
 * @Get('management')
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('admin', 'manager')
 * async managementEndpoint() {
 *   return { message: 'Admins or managers can see this' };
 * }
 * ```
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

