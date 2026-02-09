import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to bypass authentication on staging environment using a secret API key.
 * When STAGING_API_KEY env var is set and request includes matching X-Staging-Key header,
 * injects a mock admin user into the request.
 */
@Injectable()
export class StagingAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(StagingAuthMiddleware.name);
  private readonly stagingApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.stagingApiKey = this.configService.get<string>('STAGING_API_KEY');
    if (this.stagingApiKey) {
      this.logger.warn('⚠️ Staging auth bypass is ENABLED');
    }
  }

  use(req: Request, res: Response, next: NextFunction) {
    // Only process if staging key is configured
    if (!this.stagingApiKey) {
      return next();
    }

    const providedKey = req.headers['x-staging-key'] as string;
    
    if (providedKey && providedKey === this.stagingApiKey) {
      this.logger.debug('Staging auth bypass activated');
      
      // Inject mock admin user - this simulates what JwtStrategy.validate() returns
      (req as any).user = {
        sub: 'staging-admin-bypass',
        oid: 'staging-admin-bypass',
        email: 'staging@ingeniotech.co.uk',
        name: 'Staging Admin',
        tid: this.configService.get<string>('ENTRA_TENANT_ID') || 'staging-tenant',
        role: 'admin',
        department: null,
        impersonatedBy: null,
      };

      // Also set a cookie-like flag so auth guards know this is authenticated
      (req as any).stagingBypass = true;
    }

    next();
  }
}
