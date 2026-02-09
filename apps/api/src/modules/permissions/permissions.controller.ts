import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Logger,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PermissionsService } from './permissions.service';
import { ZodValidationPipe } from 'nestjs-zod';
import { SetRolePermissionsDto, SetRolePermissionsSchema } from './dto/set-role-permissions.dto';
import { SetUserOverridesDto, SetUserOverridesSchema } from './dto/set-user-overrides.dto';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard('jwt'))
export class PermissionsController {
  private readonly logger = new Logger(PermissionsController.name);

  constructor(private readonly permissionsService: PermissionsService) {}

  // ===== Public endpoints (authenticated users) =====

  @Get('permissions')
  @ApiOperation({ summary: 'List all available permissions' })
  @ApiResponse({ status: 200, description: 'Returns list of all permissions' })
  async listPermissions() {
    return this.permissionsService.listPermissions();
  }

  @Get('permissions/grouped')
  @ApiOperation({ summary: 'List permissions grouped by category' })
  @ApiResponse({ status: 200, description: 'Returns permissions grouped by category' })
  async listPermissionsGrouped() {
    return this.permissionsService.listPermissionsGrouped();
  }

  @Get('permissions/me')
  @ApiOperation({ summary: 'Get current user effective permissions' })
  @ApiResponse({ status: 200, description: 'Returns array of permission codes' })
  async getMyPermissions(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    this.logger.log(`Getting permissions for user ${userId}`);
    return this.permissionsService.getEffectivePermissions(userId);
  }

  @Get('permissions/roles')
  @ApiOperation({ summary: 'List all available roles' })
  @ApiResponse({ status: 200, description: 'Returns array of role names' })
  async listRoles() {
    return this.permissionsService.getRoles();
  }

  // ===== Admin endpoints =====

  @Get('admin/permissions/roles/:role')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get permissions for a role (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns array of permission codes' })
  async getRolePermissions(@Param('role') role: string) {
    this.logger.log(`Admin fetching permissions for role: ${role}`);
    return this.permissionsService.listRolePermissions(role);
  }

  @Put('admin/permissions/roles/:role')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Set permissions for a role (admin only)' })
  @ApiResponse({ status: 200, description: 'Permissions updated successfully' })
  async setRolePermissions(
    @Param('role') role: string,
    @Body(new ZodValidationPipe(SetRolePermissionsSchema)) body: SetRolePermissionsDto,
  ) {
    this.logger.log(`Admin setting permissions for role ${role}: ${body.permissions.length} permissions`);
    await this.permissionsService.setRolePermissions(role, body.permissions);
    return { success: true, message: `Updated permissions for role ${role}` };
  }

  @Get('admin/permissions/users/:userId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Get permission overrides for a user (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns user overrides with permission details' })
  async getUserOverrides(@Param('userId') userId: string) {
    this.logger.log(`Admin fetching overrides for user: ${userId}`);
    return this.permissionsService.getUserOverrides(userId);
  }

  @Put('admin/permissions/users/:userId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Set permission overrides for a user (admin only)' })
  @ApiResponse({ status: 200, description: 'Overrides updated successfully' })
  async setUserOverrides(
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(SetUserOverridesSchema)) body: SetUserOverridesDto,
  ) {
    this.logger.log(`Admin setting overrides for user ${userId}: ${body.overrides.length} overrides`);
    // The Zod schema ensures these are non-optional, but TS needs the cast
    const overrides = body.overrides as Array<{ code: string; granted: boolean | null }>;
    await this.permissionsService.setUserOverrides(userId, overrides);
    return { success: true, message: `Updated overrides for user ${userId}` };
  }
}
