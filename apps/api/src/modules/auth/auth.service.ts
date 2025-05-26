import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { WorkOS } from '@workos-inc/node';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private jwksClient: JwksClient;
  private workosClientId: string;

  constructor(
    private readonly workos: WorkOS,
    private readonly configService: ConfigService,
  ) {
    this.workosClientId =
      this.configService.getOrThrow<string>('WORKOS_CLIENT_ID');
    this.jwksClient = new JwksClient({
      jwksUri: `https://api.workos.com/jwks/${this.workosClientId}`,
      cache: true, // Cache the signing key
      rateLimit: true, // Prevent abuse
      jwksRequestsPerMinute: 5, // Default value
    });
  }
  // Removed extra closing brace that was here

  private getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
    if (!header.kid) {
      this.logger.error('JWT header missing kid');
      return callback(new Error('JWT header missing kid'));
    }
    this.jwksClient.getSigningKey(header.kid, (err, key) => {
      if (err) {
        this.logger.error('Error getting signing key from JWKS', err);
        return callback(err);
      }
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    });
  }

  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const authorizationUrl = this.workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      redirectUri: redirectUri,
      clientId: this.workosClientId,
    });
    this.logger.debug(`Generated authorization URL: ${authorizationUrl}`);
    return authorizationUrl;
  }

  async getProfileAndToken(code: string) {
    const data = await this.workos.userManagement.authenticateWithCode({
      code,
      clientId: this.workosClientId,
    });
    const profile = data.user;
    const accessToken = data.accessToken;
    const refreshToken = data.refreshToken;
    return { profile, accessToken, refreshToken };
  }

  async verifyToken(token: string): Promise<jwt.JwtPayload | string> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        this.getKey.bind(this),
        { algorithms: ['RS256'] },
        (err, decoded) => {
          if (err) {
            this.logger.error('JWT verification failed', err);
            return reject(new UnauthorizedException('Invalid token'));
          }
          resolve(decoded);
        },
      );
    });
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; profile: any }> {
    try {
      this.logger.debug('Attempting to refresh access token');
      const {
        accessToken,
        refreshToken: newRefreshToken,
        user,
      } = await this.workos.userManagement.authenticateWithRefreshToken({
        clientId: this.workosClientId,
        refreshToken,
      });
      this.logger.debug('Successfully refreshed access token');
      return { accessToken, refreshToken: newRefreshToken, profile: user };
    } catch (error) {
      this.logger.error('Failed to refresh access token', error);
      throw new UnauthorizedException('Failed to refresh access token');
    }
  }

  async getUserProfile(userId: string): Promise<any> {
    try {
      const profile = await this.workos.userManagement.getUser(userId);
      this.logger.debug(
        `Retrieved profile for userId ${userId}: ${JSON.stringify(profile)}`,
      );
      return profile;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve profile for userId ${userId}`,
        error,
      );
      throw new UnauthorizedException('Failed to retrieve user profile');
    }
  }
}
