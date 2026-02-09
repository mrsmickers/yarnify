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
import type { EntraUser } from '@db';
import { isPendingEntraOid } from '../../common/constants/entra.constants';

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
  sessionStart?: number; // Unix timestamp of when session started (for absolute timeout)
  refreshCount?: number; // Number of times token has been refreshed (for max refresh limit)
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
  private readonly absoluteSessionTimeoutHours: number;
  private readonly maxTokenRefreshes: number;

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

    // Security: Absolute session timeout (default 24 hours for sensitive data)
    const absoluteTimeoutFromEnv = Number(
      this.configService.get<string>('AUTH_ABSOLUTE_SESSION_TIMEOUT_HOURS', '24'),
    );
    this.absoluteSessionTimeoutHours = Number.isFinite(absoluteTimeoutFromEnv) && absoluteTimeoutFromEnv > 0
      ? absoluteTimeoutFromEnv
      : 24;

    // Security: Maximum number of token refreshes before requiring re-login
    const maxRefreshesFromEnv = Number(
      this.configService.get<string>('AUTH_MAX_TOKEN_REFRESHES', '24'),
    );
    this.maxTokenRefreshes = Number.isFinite(maxRefreshesFromEnv) && maxRefreshesFromEnv > 0
      ? maxRefreshesFromEnv
      : 24;

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
    this.logger.log(
      `Security: JWT TTL=${this.jwtTtlSeconds}s, Absolute timeout=${this.absoluteSessionTimeoutHours}h, Max refreshes=${this.maxTokenRefreshes}`,
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
        Date.now(), // Session start time for absolute timeout
        0, // Initial refresh count
      );
      
      // Ensure user is provisioned locally before issuing a session
      const syncedUser = await this.syncExistingUser(session);
      session.roles = this.mapRoleToClaims(syncedUser.role);
      session.email = syncedUser.email || session.email;
      session.name = syncedUser.displayName || session.name;

      // Auto-match agent on login (fire-and-forget, don't block login)
      this.tryAutoMatchAgent(syncedUser.id, syncedUser.email, syncedUser.displayName).catch(
        (err) => this.logger.error('Agent auto-match failed', err),
      );
      
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
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Failed to exchange code for tokens', error as Error);
      throw new UnauthorizedException('Unable to authenticate');
    }
  }

  async refreshAccessToken(refreshToken: string, currentSessionStart?: number, currentRefreshCount?: number) {
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
      
      // Inherit session start time from current token (or use now if not provided)
      const sessionStart = currentSessionStart || Date.now();
      const refreshCount = (currentRefreshCount || 0) + 1;
      
      // Security: Check absolute session timeout (24 hours by default)
      const sessionAgeHours = (Date.now() - sessionStart) / (1000 * 60 * 60);
      if (sessionAgeHours > this.absoluteSessionTimeoutHours) {
        this.logger.warn(
          `Session exceeded absolute timeout (${sessionAgeHours.toFixed(1)}h > ${this.absoluteSessionTimeoutHours}h). Requiring re-login.`,
        );
        throw new UnauthorizedException('Session expired. Please log in again.');
      }
      
      // Security: Check maximum refresh count
      if (refreshCount > this.maxTokenRefreshes) {
        this.logger.warn(
          `Session exceeded maximum refresh count (${refreshCount} > ${this.maxTokenRefreshes}). Requiring re-login.`,
        );
        throw new UnauthorizedException('Session expired. Please log in again.');
      }
      
      const session = this.buildSessionPayload(
        result.idTokenClaims as EntraTokenClaims,
        sessionStart,
        refreshCount,
      );
      await this.applyLocalRole(session);
      const accessToken = this.signSession(session);

      return {
        accessToken,
        refreshToken: result.refreshToken || refreshToken,
        profile: session,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Failed to refresh access token', error as Error);
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  private signSession(payload: SessionTokenPayload): string {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtTtlSeconds,
    });
  }

  private buildSessionPayload(
    claims: EntraTokenClaims,
    sessionStart?: number,
    refreshCount?: number,
  ): SessionTokenPayload {
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
      sessionStart, // Unix timestamp of session start (for absolute timeout)
      refreshCount, // Number of refreshes (for max refresh limit)
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

  private mapRoleToClaims(role: string): string[] {
    switch (role) {
      case 'admin':
        return ['admin', 'manager', 'team_lead', 'user'];
      case 'manager':
        return ['manager', 'team_lead', 'user'];
      case 'team_lead':
        return ['team_lead', 'user'];
      default:
        return ['user'];
    }
  }

  private normalizeEmail(email?: string | null): string | null {
    if (!email) {
      return null;
    }

    const trimmed = email.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }

  private ensureUserIsActive(user: EntraUser): EntraUser {
    if (!user.enabled) {
      this.logger.warn(`Disabled user ${user.email} attempted to authenticate`);
      throw new UnauthorizedException('User account disabled');
    }

    return user;
  }

  private async findProvisionedUser(
    session: SessionTokenPayload,
  ): Promise<EntraUser> {
    const normalizedEmail = this.normalizeEmail(session.email);

    if (session.oid) {
      const byOid = await this.prisma.entraUser.findUnique({
        where: { oid: session.oid },
      });

      if (byOid) {
        return this.ensureUserIsActive(byOid);
      }
    }

    if (normalizedEmail) {
      const byEmail = await this.prisma.entraUser.findUnique({
        where: { email: normalizedEmail },
      });

      if (byEmail) {
        this.ensureUserIsActive(byEmail);

        if (session.oid && (!byEmail.oid || isPendingEntraOid(byEmail.oid))) {
          return this.prisma.entraUser.update({
            where: { id: byEmail.id },
            data: { oid: session.oid },
          });
        }

        return byEmail;
      }
    }

    this.logger.warn(
      `Unprovisioned user attempting login (oid=${session.oid || 'n/a'}, email=${normalizedEmail || 'n/a'})`,
    );
    throw new UnauthorizedException('User not provisioned for The Oracle');
  }

  private async applyLocalRole(session: SessionTokenPayload): Promise<void> {
    const user = await this.findProvisionedUser(session);

    session.roles = this.mapRoleToClaims(user.role);
    session.email = user.email || session.email;
    session.name = user.displayName ?? session.name;

    await this.prisma.entraUser.update({
      where: { id: user.id },
      data: {
        lastSyncedAt: new Date(),
      },
    });
  }

  /**
   * Try to auto-link an EntraUser to an unlinked Agent on login.
   * Matching strategy (in order):
   * 1. Exact email match: Agent.email === user.email (case-insensitive)
   * 2. Display name match: Agent.name === user.displayName (case-insensitive, trimmed)
   * Only matches if Agent.entraUserId is null (not already linked).
   */
  private async tryAutoMatchAgent(
    userId: string,
    email: string,
    displayName?: string | null,
  ): Promise<void> {
    // Check if user already has a linked agent
    const existingLink = await this.prisma.agent.findFirst({
      where: { entraUserId: userId },
    });

    if (existingLink) {
      this.logger.debug(
        `User ${email} already linked to agent "${existingLink.name}" — skipping auto-match`,
      );
      return;
    }

    // Strategy 1: Email match (case-insensitive)
    if (email) {
      const agentByEmail = await this.prisma.agent.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
          entraUserId: null,
        },
      });

      if (agentByEmail) {
        await this.prisma.agent.update({
          where: { id: agentByEmail.id },
          data: { entraUserId: userId },
        });
        this.logger.log(
          `Auto-matched agent "${agentByEmail.name}" to user ${email} via email match`,
        );
        return;
      }
    }

    // Strategy 2: Display name match (case-insensitive, trimmed)
    if (displayName && displayName.trim().length > 0) {
      const trimmedName = displayName.trim();
      const agentByName = await this.prisma.agent.findFirst({
        where: {
          name: { equals: trimmedName, mode: 'insensitive' },
          entraUserId: null,
        },
      });

      if (agentByName) {
        await this.prisma.agent.update({
          where: { id: agentByName.id },
          data: { entraUserId: userId },
        });
        this.logger.log(
          `Auto-matched agent "${agentByName.name}" to user ${email} via display name match`,
        );
        return;
      }
    }

    this.logger.debug(
      `No auto-match found for user ${email} (displayName: ${displayName || 'n/a'})`,
    );
  }

  private async syncExistingUser(
    session: SessionTokenPayload,
  ): Promise<EntraUser> {
    const user = await this.findProvisionedUser(session);
    const now = new Date();
    const normalizedEmail = this.normalizeEmail(session.email) ?? user.email;
    const normalizedDisplayName =
      typeof session.name === 'string' && session.name.trim().length > 0
        ? session.name.trim()
        : user.displayName;

    const updateData: {
      email: string;
      displayName: string | null;
      lastLoginAt: Date;
      lastSyncedAt: Date;
      oid?: string;
    } = {
      email: normalizedEmail,
      displayName: normalizedDisplayName,
      lastLoginAt: now,
      lastSyncedAt: now,
    };

    if (session.oid && (!user.oid || isPendingEntraOid(user.oid))) {
      updateData.oid = session.oid;
    }

    const updatedUser = await this.prisma.entraUser.update({
      where: { id: user.id },
      data: updateData,
    });

    this.logger.log(`User authenticated: ${updatedUser.email}`);
    return updatedUser;
  }

  /**
   * Generate a short-lived impersonation token for admin user impersonation.
   * @param targetUser - The user being impersonated
   * @param adminOid - The OID of the admin initiating impersonation
   * @param tenantId - The tenant ID for the token
   * @returns JWT token string
   */
  generateImpersonationToken(
    targetUser: EntraUser,
    adminOid: string,
    tenantId: string,
  ): string {
    const payload: SessionTokenPayload & { impersonatedBy: string; department?: string } = {
      sub: targetUser.oid || targetUser.id,
      oid: targetUser.oid || undefined,
      tid: tenantId,
      email: targetUser.email,
      name: targetUser.displayName || undefined,
      roles: this.mapRoleToClaims(targetUser.role),
      department: targetUser.department || undefined,
      impersonatedBy: adminOid,
      // No sessionStart/refreshCount — impersonation tokens cannot be refreshed
    };

    // Impersonation tokens have a shorter expiry (30 minutes)
    const impersonationTtlSeconds = 30 * 60;

    this.logger.log(
      `Generating impersonation token for ${targetUser.email} (initiated by admin ${adminOid})`,
    );

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: impersonationTtlSeconds,
    });
  }
}
