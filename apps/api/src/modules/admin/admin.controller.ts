import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';

/**
 * Admin-only endpoints for user management.
 * All endpoints require authentication and 'admin' role.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns list of all users',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - requires admin role',
  })
  async listUsers() {
    this.logger.log('Admin requested user list');
    return this.adminService.listUsers();
  }

  @Patch('users/:id/enable')
  @ApiOperation({ summary: 'Enable a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User enabled successfully',
  })
  async enableUser(@Param('id') id: string) {
    this.logger.log(`Admin enabling user: ${id}`);
    return this.adminService.updateUserStatus(id, true);
  }

  @Patch('users/:id/disable')
  @ApiOperation({ summary: 'Disable a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User disabled successfully',
  })
  async disableUser(@Param('id') id: string) {
    this.logger.log(`Admin disabling user: ${id}`);
    return this.adminService.updateUserStatus(id, false);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get system statistics (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns system statistics',
  })
  async getStats() {
    this.logger.log('Admin requested system statistics');
    return this.adminService.getStats();
  }
}

