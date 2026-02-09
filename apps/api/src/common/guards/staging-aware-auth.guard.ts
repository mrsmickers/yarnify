import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Auth guard that recognizes staging bypass.
 * If request has stagingBypass flag set by StagingAuthMiddleware, skip JWT validation.
 * Otherwise, delegate to standard JWT auth.
 */
@Injectable()
export class StagingAwareAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(StagingAwareAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    
    // If staging bypass is active, allow through
    if (request.stagingBypass && request.user) {
      this.logger.debug('Staging bypass: skipping JWT validation');
      return true;
    }

    // Otherwise, use normal JWT auth
    return super.canActivate(context);
  }
}
