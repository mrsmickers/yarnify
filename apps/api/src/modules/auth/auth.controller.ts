import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  UseGuards,
  Post,
  Logger,
  Body, // Added Body decorator
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response, Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ClsService } from 'nestjs-cls';
import { ClsStore } from '../../common/interfaces/cls-store.interface';
import {
  RefreshTokenRequestDto,
  RefreshTokenResponseDto,
} from './dto/refresh-token.dto'; // Import DTOs
import {
  ApiBody,
  ApiResponse,
  ApiTags,
  ApiCookieAuth,
  ApiOperation,
} from '@nestjs/swagger'; // Import Swagger decorators
import { WorkOS } from '@workos-inc/node';

@ApiTags('Authentication') // Add ApiTags for Swagger
@Controller('auth')
export class AuthController {
  private readonly frontendUrl: string;
  private readonly workosRedirectPath = '/api/v1/auth/callback'; // Relative path for WorkOS redirect
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly cls: ClsService<ClsStore>,
    private readonly workos: WorkOS, // Inject WorkOS client if needed for other operations
  ) {
    this.frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
  }

  private getWorkOSRedirectUri(req: Request): string {
    return `${this.frontendUrl}${this.workosRedirectPath}`;
  }

  @Get('login')
  async login(@Req() req: Request, @Res() res: Response) {
    const redirectUri = this.getWorkOSRedirectUri(req);
    try {
      const authorizationUrl = await this.authService.getAuthorizationUrl(
        redirectUri,
      );
      res.redirect(authorizationUrl);
    } catch (error) {
      console.error('Error getting authorization URL:', error);
      res.status(500).send('Error initiating login');
    }
  }

  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      return res.status(400).send('No code provided');
    }
    try {
      const { profile, accessToken, refreshToken } =
        await this.authService.getProfileAndToken(code);

      // Redirect to frontend, perhaps with a success indicator or to a specific page
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });

      // Optionally, you can store the refreshToken in a secure place if needed
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });

      res.redirect(`${this.frontendUrl}/dashboard`);
    } catch (error) {
      this.logger.error('Error exchanging code for profile and token:', error);
      res.redirect(`${this.frontendUrl}?login_failed=true`);
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Req() req: Request) {
    // Keep Req if you want to compare or fallback
    // Retrieve userId from CLS
    const userId = this.cls.get('userId');

    if (!userId) {
      this.logger.warn(
        '[/auth/profile] userId not found in CLS. This should not happen if AuthGuard succeeded.',
      );
      // Fallback to req.user if you still want the full profile,
      // or handle as an error if only CLS data is desired.
      // For now, let's return the userId from CLS if available,
      // or the full profile from req.user as a fallback/demonstration.
      // If strictly only userId from CLS is desired, this would be an error or empty response.
      this.logger.debug(
        `[/auth/profile] CLS userId: ${userId}, req.user: ${JSON.stringify(
          req.user,
        )}`,
      );
      // If you want to return the full profile from req.user when CLS userId is missing:
      // return req.user;
      // If you want to return only what's in CLS (which is just userId):
      return { userId: null, message: 'User ID not found in request context.' };
    }

    const user = await this.workos.userManagement.getUser(userId);

    // If the goal is to return ONLY the userId from CLS:
    return { ...user };

    // If the goal was to return the full profile, but ensure userId from CLS matches req.user.sub:
    // const passportUser = req.user as JwtPayload; // Assuming req.user is JwtPayload
    // if (passportUser && passportUser.sub === userId) {
    //   return passportUser; // Or just { userId } if that's all you want from profile endpoint
    // }
    // return { message: 'User data mismatch or not found.'};
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    // For stateless JWT authentication, logout is typically handled client-side
    // by deleting the token from storage (e.g., localStorage or httpOnly cookie).
    // Server-side, we clear the httpOnly cookie if we set one.

    const cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      // path: '/', // Optional: ensure path matches the one used for setting
    };
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    // Optionally, redirect to WorkOS to end the IdP session.
    // This step is often recommended for a more complete logout.
    // const workosClientId = this.configService.getOrThrow<string>('WORKOS_CLIENT_ID');
    // const workosLogoutUrl = `https://api.workos.com/sso/logout?client_id=${workosClientId}&redirect_uri=${this.frontendUrl}`;
    // return res.redirect(workosLogoutUrl);
    // If not redirecting to WorkOS logout, just send a success response.
    res.status(200).json({ message: 'Logout successful. Cookie cleared.' });
  }

  @Get('refresh')
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully.',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Refresh token not provided.' })
  @ApiResponse({ status: 401, description: 'Failed to refresh token.' })
  async refreshToken(@Req() req: Request, @Res() res: Response): Promise<void> {
    const tokenToRefresh = req.cookies['refresh_token'];

    if (!tokenToRefresh) {
      this.logger.warn(
        'Refresh token endpoint called without refresh token in cookie or body',
      );
      res.status(400).json({
        message: 'Refresh token not provided',
      } as RefreshTokenResponseDto);
      return;
    }

    try {
      this.logger.debug(
        'Attempting to refresh token via /refresh-token endpoint',
      );
      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        // profile, // Profile is also returned, can be used if needed
      } = await this.authService.refreshAccessToken(tokenToRefresh);

      res.cookie('access_token', newAccessToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });

      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });

      this.logger.debug('Successfully refreshed token and set new cookies');
      res.status(200).json({
        message: 'Token refreshed successfully',
        accessToken: newAccessToken,
      } as RefreshTokenResponseDto);
    } catch (error) {
      this.logger.error('Failed to refresh token:', error.message);
      // Clear potentially invalid refresh token cookie
      res.clearCookie('refresh_token', {
        httpOnly: true,
        secure: this.configService.get<string>('NODE_ENV') === 'production',
        sameSite: 'lax',
      });
      // redirect to login

      res.status(401).json({
        message: 'Failed to refresh token',
      } as RefreshTokenResponseDto);
    }
  }
}
