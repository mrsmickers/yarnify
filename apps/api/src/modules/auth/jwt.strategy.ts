import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import {
  ClsStore,
  JwtPayload,
} from '../../common/interfaces/cls-store.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly expectedTenant: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cls: ClsService<ClsStore>,
  ) {
    const secret = configService.getOrThrow<string>('AUTH_JWT_SECRET');
    const tenant =
      configService.get<string>('ENTRA_EXPECTED_TENANT') ||
      configService.getOrThrow<string>('ENTRA_TENANT_ID');

    super({
      secretOrKey: secret,
      algorithms: ['HS256'],
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First, try to extract from Authorization header (for impersonation tokens)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Then, try to extract from cookies (for normal auth)
        (req: Request) => {
          const token = req.cookies?.['access_token'];
          if (!token) {
            Logger.warn('[JwtStrategy] No access token found in cookies.');
            return null;
          }
          return token;
        },
      ]),
    });

    this.expectedTenant = tenant;
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload) {
      this.logger.warn('Payload missing from JWT validate call.');
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub) {
      this.logger.warn('JWT payload missing sub');
      throw new UnauthorizedException('Invalid token payload');
    }

    if (!payload.tid) {
      this.logger.warn('JWT payload missing tenant id (tid)');
      throw new UnauthorizedException('Invalid tenant information in token');
    }

    if (payload.tid !== this.expectedTenant) {
      this.logger.warn(
        `Tenant mismatch. Expected ${this.expectedTenant}, received ${payload.tid}`,
      );
      throw new ForbiddenException('Invalid tenant');
    }

    this.cls.set('userId', payload.sub);
    return payload;
  }
}
