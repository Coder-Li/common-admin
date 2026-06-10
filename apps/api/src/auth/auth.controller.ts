import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthOriginGuard } from './auth-origin.guard';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { SessionCookieService } from './session-cookie.service';
import { IsPublic } from '../common/decorators/is-public.decorator';
import { AUTH_TOKEN_CONFIG } from '../config/auth.config';
import type { AuthTokenConfig } from '../config/auth.config';
import { CurrentUser } from '../user/current-user.decorator';
import type { JwtUserPayload } from '../user/user.types';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly sessionCookieService: SessionCookieService,
    @Inject(AUTH_TOKEN_CONFIG)
    private readonly tokenConfig: AuthTokenConfig,
  ) {}

  @IsPublic()
  @UseGuards(AuthOriginGuard)
  @ApiOperation({ operationId: 'login' })
  @Post('login')
  @ApiOkResponse({ type: AuthResponseDto })
  async login(
    @Body() body: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const session = await this.authService.login(body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip,
    });

    this.sessionCookieService.setRefreshCookie(response, session.refreshToken);

    return { accessToken: session.accessToken, user: session.user };
  }

  @IsPublic()
  @UseGuards(AuthOriginGuard)
  @ApiOperation({ operationId: 'refreshSession' })
  @Post('refresh')
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = this.readRefreshCookie(request);

    try {
      const session = await this.authService.refresh(refreshToken);
      this.sessionCookieService.setRefreshCookie(
        response,
        session.refreshToken,
      );

      return { accessToken: session.accessToken, user: session.user };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        this.sessionCookieService.clearRefreshCookie(response);
      }

      throw error;
    }
  }

  @IsPublic()
  @UseGuards(AuthOriginGuard)
  @ApiOperation({ operationId: 'logout' })
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const accessToken = this.readBearerToken(request);
    const refreshToken = this.readOptionalRefreshCookie(request);

    this.sessionCookieService.clearRefreshCookie(response);

    if (accessToken) {
      const sid = await this.readSessionIdFromAccessToken(accessToken);

      if (sid) {
        await this.authService.logoutBySessionId(sid);
        return;
      }
    }

    if (!refreshToken) {
      return;
    }

    try {
      await this.authService.logoutByRefreshToken(refreshToken);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) {
        throw error;
      }
    }
  }

  @UseGuards(AuthOriginGuard)
  @ApiOperation({ operationId: 'changePassword' })
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: ChangePasswordDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.authService.changePassword(
      user.sub,
      body.currentPassword,
      body.newPassword,
    );
    this.sessionCookieService.clearRefreshCookie(response);
  }

  private readRefreshCookie(request: Request): string {
    const refreshToken = this.readOptionalRefreshCookie(request);

    if (!refreshToken) {
      throw new UnauthorizedException();
    }

    return refreshToken;
  }

  private readOptionalRefreshCookie(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[this.tokenConfig.refreshCookieName];
  }

  private readBearerToken(request: Request): string | undefined {
    const authorization = request.headers.authorization;

    if (typeof authorization !== 'string') {
      return undefined;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return undefined;
    }

    return token;
  }

  private async readSessionIdFromAccessToken(
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtUserPayload>(
        accessToken,
        {
          secret: this.tokenConfig.accessTokenSecret,
        },
      );

      return payload.sid;
    } catch {
      return undefined;
    }
  }
}
