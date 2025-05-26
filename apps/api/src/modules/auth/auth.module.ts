import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WorkOS } from '@workos-inc/node';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      provide: WorkOS,
      useFactory: (configService: ConfigService) => {
        const apiKey = configService.get<string>('WORKOS_API_KEY');
        const clientId = configService.get<string>('WORKOS_CLIENT_ID');

        if (!apiKey) {
          throw new Error('WORKOS_API_KEY is not set');
        }
        if (!clientId) {
          throw new Error('WORKOS_CLIENT_ID is not set');
        }
        return new WorkOS(apiKey, {
          clientId: clientId,
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
