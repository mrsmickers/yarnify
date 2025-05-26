import {
  Injectable,
  UnauthorizedException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa'; // Corrected import
import { WorkOS } from '@workos-inc/node';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import {
  ClsStore,
  JwtPayload,
} from '../../common/interfaces/cls-store.interface'; // Import JwtPayload

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService, // To get WORKOS_CLIENT_ID
    private readonly workos: WorkOS, // Inject WorkOS client if needed for other operations
    private readonly cls: ClsService<ClsStore>, // Use ClsStore generic
  ) {
    const workosClientId = configService.getOrThrow<string>('WORKOS_CLIENT_ID');
    const jwksUri = workos.userManagement.getJwksUrl(workosClientId);
    // Use console.log as this.logger is not available before super()
    super({
      secretOrKeyProvider: passportJwtSecret({
        // Use the direct import
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: jwksUri,
      }),
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          // extract access token from cookie
          const token = req.cookies?.['access_token'];
          if (!token) {
            console.warn('[JwtStrategy] No access token found in cookies.');
            return null; // Return null if no token found
          }

          return token; // Return the token if found
        },
      ]),
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Use JwtPayload for payload and return

    if (!payload) {
      this.logger.warn(
        '[JwtStrategy] Payload is null or undefined. Throwing UnauthorizedException.',
      );
      throw new UnauthorizedException(
        'Invalid token: No payload received by validate method',
      );
    }

    // check org ID matches environment variable
    const expectedOrgId =
      this.configService.getOrThrow<string>('WORKOS_ORG_ID');
    if (payload.org_id !== expectedOrgId) {
      this.logger.warn(
        `[JwtStrategy] Org ID mismatch. Expected: ${expectedOrgId}, Received: ${
          payload.org_id
        }. Payload: ${JSON.stringify(payload)}`,
      );
      throw new ForbiddenException(`Invalid token: Org ID mismatch.`);
    }

    // Example: Check for an absolutely essential claim like 'sub' (subject/user ID)
    // The token you provided has a 'sub', so this shouldn't fail for that token.
    if (!payload.sub) {
      this.logger.warn(
        `[JwtStrategy] Essential 'sub' claim missing in payload. Payload: ${JSON.stringify(
          payload,
        )}`,
      );
      throw new UnauthorizedException("Invalid token: 'sub' claim missing.");
    }

    this.cls.set('userId', payload.sub); // Store only the user ID (sub)
    return payload; // Still return the full payload for Passport to attach to req.user
  }
}
