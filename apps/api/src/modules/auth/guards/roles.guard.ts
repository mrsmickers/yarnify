import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Guard that checks if the authenticated user has one of the required roles.
 * Use with @Roles decorator to protect routes.
 * 
 * @example
 * ```typescript
 * @Get('admin')
 * @UseGuards(AuthGuard('jwt'), RolesGuard)
 * @Roles('admin')
 * async adminOnly() {
 *   return { message: 'Admin access granted' };
 * }
 * ```
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get required roles from decorator metadata
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      // No roles required, allow access
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      this.logger.warn('RolesGuard: No user found on request');
      return false;
    }

    if (!user.roles || !Array.isArray(user.roles)) {
      this.logger.warn(
        `RolesGuard: User ${user.sub || 'unknown'} has no roles`,
      );
      return false;
    }

    // Check if user has at least one of the required roles
    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: User ${user.sub || 'unknown'} with roles [${user.roles.join(', ')}] ` +
        `attempted to access resource requiring [${requiredRoles.join(', ')}]`,
      );
    }

    return hasRole;
  }
}

