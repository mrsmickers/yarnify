import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
  Post,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { ClsStore, JwtPayload } from '../../common/interfaces/cls-store.interface';
import {
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly cls: ClsService<ClsStore>,
    private readonly prisma: PrismaService,
  ) {
    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    this.logger.log(`FRONTEND_URL configured as: ${this.frontendUrl}`);
  }

  @Get('login')
  async login(@Res() res: Response) {
    try {
      const authorizationUrl = await this.authService.getAuthorizationUrl();
      res.redirect(authorizationUrl);
    } catch (error) {
      this.logger.error('Error getting authorization URL', error as Error);
      res.status(500).send('Error initiating login');
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Req() _req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      return res.status(400).send('No code provided');
    }

    try {
      const { accessToken, refreshToken } =
        await this.authService.getProfileAndToken(code);

      const secureCookies =
        this.configService.get<string>('NODE_ENV') === 'production';

      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
      });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
      });

      const redirectUrl = `${this.frontendUrl}/dashboard`;
      this.logger.log(`Redirecting to: ${redirectUrl}`);
      res.redirect(redirectUrl);
    } catch (error) {
      this.logger.error('Error exchanging code for token', error as Error);
      res.redirect(`${this.frontendUrl}?login_failed=true`);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req: Request) {
    const payload = req.user as JwtPayload | undefined;
    const clsUserId = this.cls.get('userId');

    if (!payload) {
      this.logger.warn('[/auth/profile] Missing request user payload');
      return { message: 'No user payload on request.' };
    }

    if (!clsUserId) {
      this.logger.warn(
        '[/auth/profile] CLS did not have userId. Falling back to JWT payload.',
      );
    }
    let department: string | null = null;
    let role: string | null = null;

    if (payload.oid) {
      const storedUser = await this.prisma.entraUser.findUnique({
        where: { oid: payload.oid },
        select: { department: true, role: true },
      });
      department = storedUser?.department ?? null;
      role = storedUser?.role ?? null;
    } else if (payload.email) {
      const storedUser = await this.prisma.entraUser.findUnique({
        where: { email: payload.email.toLowerCase() },
        select: { department: true, role: true },
      });
      department = storedUser?.department ?? null;
      role = storedUser?.role ?? null;
    }

    return {
      userId: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      tenantId: payload.tid || null,
      roles: payload.roles || [],
      department,
      role,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() _req: Request, @Res() res: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
    };

    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    res.status(200).json({ message: 'Logout successful. Cookie cleared.' });
  }

  @Get('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully.',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Refresh token not provided.' })
  @ApiResponse({ status: 401, description: 'Failed to refresh token.' })
  async refreshToken(@Req() req: Request, @Res() res: Response): Promise<void> {
    const tokenToRefresh = req.cookies['refresh_token'];
    const currentAccessToken = req.cookies['access_token'];

    if (!tokenToRefresh) {
      this.logger.warn('Refresh token endpoint called without cookie');
      res.status(400).json({
        message: 'Refresh token not provided',
      } as RefreshTokenResponseDto);
      return;
    }

    try {
      const secureCookies =
        this.configService.get<string>('NODE_ENV') === 'production';

      // Extract session info from current token (if available)
      let currentSessionStart: number | undefined;
      let currentRefreshCount: number | undefined;
      
      if (currentAccessToken) {
        try {
          // Decode without verifying (we just need the payload for sessionStart/refreshCount)
          const decoded = require('jsonwebtoken').decode(currentAccessToken) as {
            sessionStart?: number;
            refreshCount?: number;
          };
          currentSessionStart = decoded?.sessionStart;
          currentRefreshCount = decoded?.refreshCount;
        } catch (decodeError) {
          this.logger.warn('Could not decode current access token', decodeError as Error);
          // Continue anyway - service will treat as new session
        }
      }

      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refreshAccessToken(
          tokenToRefresh,
          currentSessionStart,
          currentRefreshCount,
        );

      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
      });

      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'lax',
      });

      this.logger.debug('Successfully refreshed token and set new cookies');
      res.status(200).json({
        message: 'Token refreshed successfully',
        accessToken,
      } as RefreshTokenResponseDto);
    } catch (error) {
      this.logger.error('Failed to refresh token', error as Error);
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });
      res.clearCookie('access_token', {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });
      res.status(401).json({
        message: 'Failed to refresh token',
      } as RefreshTokenResponseDto);
    }
  }
}
