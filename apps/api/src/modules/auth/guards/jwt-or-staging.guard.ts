import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that allows access via either:
 * 1. Valid JWT token (normal auth)
 * 2. X-Staging-Key header matching STAGING_ACCESS_KEY env var
 */
@Injectable()
export class JwtOrStagingGuard extends AuthGuard('jwt') implements CanActivate {
  private readonly stagingKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    super();
    this.stagingKey = this.configService.get<string>('STAGING_ACCESS_KEY');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check staging key first
    if (this.stagingKey) {
      const request = context.switchToHttp().getRequest();
      const headerKey = request.headers['x-staging-key'];
      if (headerKey && headerKey === this.stagingKey) {
        return true;
      }
    }

    // Fall back to JWT
    try {
      return (await super.canActivate(context)) as boolean;
    } catch {
      return false;
    }
  }
}
