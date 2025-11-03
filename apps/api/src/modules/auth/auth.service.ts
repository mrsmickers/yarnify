import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
  ConfidentialClientApplication,
  RefreshTokenRequest,
  AuthenticationResult,
} from '@azure/msal-node';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

// Extended type to include refreshToken which exists at runtime but isn't in newer MSAL types
interface AuthenticationResultWithRefreshToken extends AuthenticationResult {
  refreshToken?: string;
}

interface SessionTokenPayload extends jwt.JwtPayload {
  sub: string;
  oid?: string;
  tid: string;
  email?: string;
  name?: string;
  roles?: string[];
}

interface EntraTokenClaims extends Record<string, unknown> {
  oid?: string;
  sub?: string;
  tid?: string;
  preferred_username?: string;
  email?: string;
  name?: string;
  roles?: string[];
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly msalClient: ConfidentialClientApplication;
  private readonly redirectUri: string;
  private readonly scopes: string[];
  private readonly jwtSecret: string;
  private readonly jwtTtlSeconds: number;
  private readonly expectedTenantId: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const tenantId = this.configService.getOrThrow<string>('ENTRA_TENANT_ID');
    const clientId = this.configService.getOrThrow<string>('ENTRA_CLIENT_ID');
    const clientSecret = this.configService.getOrThrow<string>(
      'ENTRA_CLIENT_SECRET',
    );
    const authorityHost = this.configService.get<string>(
      'ENTRA_AUTHORITY_HOST',
      'https://login.microsoftonline.com',
    );
    const authority = `${authorityHost.replace(/\/$/, '')}/${tenantId}`;

    const configuredRedirect = this.configService.get<string>(
      'AUTH_REDIRECT_URI',
    );
    const fallbackRedirect = `${this.configService.getOrThrow<string>(
      'FRONTEND_URL',
    )}/api/v1/auth/callback`;
    this.redirectUri = configuredRedirect || fallbackRedirect;

    const configuredScopes = this.configService.get<string>('ENTRA_SCOPES');
    const baseScopes = configuredScopes
      ? configuredScopes
          .split(',')
          .map((scope) => scope.trim())
          .filter(Boolean)
      : ['openid', 'profile', 'offline_access'];
    // Ensure mandatory scopes are present exactly once
    const scopeSet = new Set([
      ...baseScopes,
      'openid',
      'profile',
      'offline_access',
    ]);
    this.scopes = Array.from(scopeSet);

    this.jwtSecret = this.configService.getOrThrow<string>('AUTH_JWT_SECRET');
    const ttlFromEnv = Number(
      this.configService.get<string>('AUTH_JWT_TTL_SECONDS', '3600'),
    );
    this.jwtTtlSeconds = Number.isFinite(ttlFromEnv) && ttlFromEnv > 0
      ? ttlFromEnv
      : 3600;

    this.expectedTenantId = this.configService.get<string>(
      'ENTRA_EXPECTED_TENANT',
    ) || tenantId;

    this.msalClient = new ConfidentialClientApplication({
      auth: {
        clientId,
        authority,
        clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            if (containsPii) {
              return;
            }
            this.logger.debug(`[MSAL:${level}] ${message}`);
          },
          piiLoggingEnabled: false,
          logLevel: 2, // info
        },
      },
    });

    this.logger.log(
      `Auth service initialised with redirect ${this.redirectUri} and scopes ${this.scopes.join(', ')}`,
    );
  }

  async getAuthorizationUrl(state?: string): Promise<string> {
    const request: AuthorizationUrlRequest = {
      scopes: this.scopes,
      redirectUri: this.redirectUri,
      prompt: 'select_account',
      responseMode: 'query',
    };
    if (state) {
      request.state = state;
    }

    const authorizationUrl = await this.msalClient.getAuthCodeUrl(request);
    this.logger.debug(`Generated authorization URL: ${authorizationUrl}`);
    return authorizationUrl;
  }

  async getProfileAndToken(code: string) {
    const tokenRequest: AuthorizationCodeRequest = {
      code,
      scopes: this.scopes,
      redirectUri: this.redirectUri,
    };

    try {
      const result = (await this.msalClient.acquireTokenByCode(
        tokenRequest,
      )) as AuthenticationResultWithRefreshToken;
      if (!result?.idTokenClaims) {
        this.logger.error('Entra response missing ID token claims');
        throw new UnauthorizedException('Unable to authenticate');
      }

      this.assertTenant(result.idTokenClaims as EntraTokenClaims);
      const session = this.buildSessionPayload(
        result.idTokenClaims as EntraTokenClaims,
      );
      
      // Sync user to database on login
      await this.syncUserToDatabase(session);
      
      const accessToken = this.signSession(session);

      if (!result.refreshToken) {
        this.logger.warn(
          'No refresh token returned. Token refresh will not work. Ensure offline_access scope is granted.',
        );
      }

      return {
        profile: session,
        accessToken,
        refreshToken: result.refreshToken || '', // Empty string if no refresh token
      };
    } catch (error) {
      this.logger.error('Failed to exchange code for tokens', error as Error);
      throw new UnauthorizedException('Unable to authenticate');
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const request: RefreshTokenRequest = {
      refreshToken,
      scopes: this.scopes,
    };

    try {
      const result = (await this.msalClient.acquireTokenByRefreshToken(
        request,
      )) as AuthenticationResultWithRefreshToken;
      if (!result?.idTokenClaims) {
        this.logger.error('Refresh response missing ID token claims');
        throw new UnauthorizedException('Unable to refresh token');
      }

      this.assertTenant(result.idTokenClaims as EntraTokenClaims);
      const session = this.buildSessionPayload(
        result.idTokenClaims as EntraTokenClaims,
      );
      const accessToken = this.signSession(session);

      return {
        accessToken,
        refreshToken: result.refreshToken || refreshToken,
        profile: session,
      };
    } catch (error) {
      this.logger.error('Failed to refresh access token', error as Error);
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  private signSession(payload: SessionTokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtTtlSeconds,
    });
  }

  private buildSessionPayload(claims: EntraTokenClaims): SessionTokenPayload {
    const oid = (claims.oid || claims.sub) as string | undefined;
    if (!oid) {
      this.logger.error('ID token claims missing oid/sub');
      throw new UnauthorizedException('Invalid identity token');
    }

    const tid = claims.tid as string | undefined;
    if (!tid) {
      this.logger.error('ID token claims missing tenant id');
      throw new UnauthorizedException('Invalid identity token');
    }

    const email = (claims.preferred_username || claims.email) as
      | string
      | undefined;

    return {
      sub: oid,
      oid,
      tid,
      email,
      name: claims.name as string | undefined,
      roles: Array.isArray(claims.roles) ? (claims.roles as string[]) : undefined,
    };
  }

  private assertTenant(claims: EntraTokenClaims) {
    const tid = claims.tid as string | undefined;
    if (!tid || tid !== this.expectedTenantId) {
      this.logger.error(
        `Tenant mismatch. Expected ${this.expectedTenantId}, received ${tid}`,
      );
      throw new UnauthorizedException('Invalid tenant');
    }
  }

  /**
   * Sync user from Entra ID to local database.
   * Creates or updates user record on each login.
   */
  private async syncUserToDatabase(session: SessionTokenPayload) {
    try {
      await this.prisma.entraUser.upsert({
        where: { oid: session.oid },
        update: {
          email: session.email || '',
          displayName: session.name,
          lastLoginAt: new Date(),
          lastSyncedAt: new Date(),
          // Update role only if roles claim exists and includes 'admin'
          ...(session.roles && {
            role: session.roles.includes('admin') ? 'admin' : 'user',
          }),
        },
        create: {
          oid: session.oid,
          email: session.email || '',
          displayName: session.name,
          role: session.roles?.includes('admin') ? 'admin' : 'user',
          enabled: true,
          lastLoginAt: new Date(),
        },
      });
      this.logger.log(`User synced: ${session.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to sync user ${session.email} to database`,
        error as Error,
      );
      // Don't throw - login should still work even if DB sync fails
    }
  }
}
