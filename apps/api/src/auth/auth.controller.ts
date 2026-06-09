import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthOriginGuard } from './auth-origin.guard';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { SessionCookieService } from './session-cookie.service';
import { IsPublic } from '../common/decorators/is-public.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  @IsPublic()
  @UseGuards(AuthOriginGuard)
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

    this.sessionCookieService.setRefreshCookie(
      response,
      session.refreshToken,
    );

    return { accessToken: session.accessToken, user: session.user };
  }
}
