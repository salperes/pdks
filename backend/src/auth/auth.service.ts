import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../entities';
import { UsersService } from '../users/users.service';
import { AuthResponse, AuthUser } from './interfaces';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const user = await this.validateUser(username, password);

    const tokens = await this.generateTokens(user);
    const authUser = this.toAuthUser(user);

    return {
      ...tokens,
      user: authUser,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(user);
    const authUser = this.toAuthUser(user);

    return {
      ...tokens,
      user: authUser,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.findById(userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }

    user.passwordHash = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await this.usersService.saveUser(user);
  }

  async loginWithSsoToken(ssoToken: string): Promise<AuthResponse> {
    const ssoSecret = this.configService.get<string>('SSO_SECRET_KEY');
    if (!ssoSecret) {
      throw new UnauthorizedException('SSO yapılandırması eksik');
    }

    let payload: { username: string; email?: string };
    try {
      payload = await this.jwtService.verifyAsync<{ username: string; email?: string }>(
        ssoToken,
        { secret: ssoSecret, algorithms: ['HS256'] },
      );
    } catch (err: any) {
      this.logger.warn(`SSO token doğrulama hatası: ${err.message}`);
      throw new UnauthorizedException('Geçersiz veya süresi dolmuş SSO token');
    }

    if (!payload.username) {
      throw new UnauthorizedException('SSO token içinde kullanıcı adı bulunamadı');
    }

    const user = await this.usersService.findByUsername(payload.username);
    if (!user) {
      this.logger.warn(`SSO: Kullanıcı bulunamadı — ${payload.username}`);
      throw new UnauthorizedException('Bu kullanıcı PDKS sisteminde kayıtlı değil');
    }

    if (!user.isActive) {
      this.logger.warn(`SSO: Pasif kullanıcı girişi engellendi — ${payload.username}`);
      throw new UnauthorizedException('Kullanıcı hesabı pasif durumda');
    }

    this.logger.log(`SSO giriş başarılı: ${payload.username}`);
    const tokens = await this.generateTokens(user);
    const authUser = this.toAuthUser(user);

    return { ...tokens, user: authUser };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    };
  }
}
