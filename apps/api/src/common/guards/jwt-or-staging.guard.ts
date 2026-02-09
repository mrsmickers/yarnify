import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that allows either JWT authentication OR staging API key.
 * If STAGING_API_KEY env var is set and request has matching X-Staging-Key header,
 * bypass JWT and inject a mock admin user.
 */
@Injectable()
export class JwtOrStagingGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly logger = new Logger(JwtOrStagingGuard.name);
  private readonly stagingApiKey: string | undefined;
  private readonly tenantId: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.stagingApiKey = this.configService.get<string>('STAGING_API_KEY');
    this.tenantId =
      this.configService.get<string>('ENTRA_EXPECTED_TENANT') ||
      this.configService.get<string>('ENTRA_TENANT_ID') ||
      'staging-tenant';

    if (this.stagingApiKey) {
      this.logger.warn('⚠️ Staging auth bypass guard is ENABLED');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check for staging bypass first
    if (this.stagingApiKey) {
      const providedKey = request.headers['x-staging-key'] as string;
      if (providedKey && providedKey === this.stagingApiKey) {
        this.logger.debug('Staging auth bypass activated');

        // Inject mock admin user
        request.user = {
          sub: 'staging-admin-bypass',
          oid: 'staging-admin-bypass',
          email: 'staging@ingeniotech.co.uk',
          name: 'Staging Admin',
          tid: this.tenantId,
          role: 'admin',
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
