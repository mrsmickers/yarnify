import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';

/**
 * System endpoints available to all authenticated users
 */
@ApiTags('System')
@ApiBearerAuth()
@Controller('system')
@UseGuards(AuthGuard('jwt'))
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(private readonly adminService: AdminService) {}

  @Get('test-api-connections')
  @ApiOperation({ summary: 'Test all API connections' })
  @ApiResponse({
    status: 200,
    description: 'Returns status of all API connections',
  })
  async testApiConnections() {
    this.logger.log('User requested API connection test');
    return this.adminService.testApiConnections();
  }
}

