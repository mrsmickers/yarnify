import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that allows either JWT authentication OR staging API key.
 * If STAGING_API_KEY env var is set and request has matching X-Staging-Key header,
 * bypass JWT and inject a mock admin user.
 * 
 * Uses process.env directly to avoid DI issues when used in @UseGuards decorator.
 */
@Injectable()
export class JwtOrStagingGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly logger = new Logger(JwtOrStagingGuard.name);

  constructor() {
    super();
    if (process.env.STAGING_API_KEY) {
      this.logger.warn('⚠️ Staging auth bypass guard is ENABLED');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const stagingApiKey = process.env.STAGING_API_KEY;

    // Check for staging bypass first
    if (stagingApiKey) {
      const providedKey = request.headers['x-staging-key'] as string;
      if (providedKey && providedKey === stagingApiKey) {
        this.logger.log('Staging auth bypass activated');

        // Inject mock admin user
        request.user = {
          sub: 'staging-admin-bypass',
          oid: 'staging-admin-bypass',
          email: 'staging@ingeniotech.co.uk',
          name: 'Staging Admin',
          tid: process.env.ENTRA_TENANT_ID || 'staging-tenant',
          role: 'admin',
          roles: ['admin'],  // RolesGuard expects array
          department: undefined,
          impersonatedBy: undefined,
        };

        return true;
      }
    }

    // Fall back to JWT auth
    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      throw new UnauthorizedException('Invalid or missing authentication');
    }
  }
}
