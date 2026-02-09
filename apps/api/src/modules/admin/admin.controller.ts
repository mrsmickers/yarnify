import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Logger,
  UsePipes,
  Post,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  UpdateUserRoleDto,
  UpdateUserRoleSchema,
} from './dto/update-user-role.dto';
import {
  CreateUserDto,
  CreateUserSchema,
} from './dto/create-user.dto';
import {
  UpdateUserDepartmentDto,
  UpdateUserDepartmentSchema,
} from './dto/update-user-department.dto';
import {
  UpdateUserDto,
  UpdateUserSchema,
} from './dto/update-user.dto';
import { JwtPayload } from '../../common/interfaces/cls-store.interface';

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

  constructor(
    private readonly adminService: AdminService,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

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

  @Post('users')
  @UsePipes(new ZodValidationPipe(CreateUserSchema))
  @ApiOperation({ summary: 'Create a user (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
  })
  async createUser(@Body() body: CreateUserDto) {
    this.logger.log(`Admin creating user: ${body.email}`);
    return this.adminService.createUser(body);
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

  @Patch('users/:id/role')
  @UsePipes(new ZodValidationPipe(UpdateUserRoleSchema))
  @ApiOperation({ summary: 'Update a user role (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: UpdateUserRoleDto,
  ) {
    this.logger.log(`Admin updating user role: ${id} -> ${body.role}`);
    return this.adminService.updateUserRole(id, body.role);
  }

  @Patch('users/:id/department')
  @UsePipes(new ZodValidationPipe(UpdateUserDepartmentSchema))
  @ApiOperation({ summary: 'Update a user department (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User department updated successfully',
  })
  async updateUserDepartment(
    @Param('id') id: string,
    @Body() body: UpdateUserDepartmentDto,
  ) {
    this.logger.log(
      `Admin updating user department: ${id} -> ${body.department}`,
    );
    return this.adminService.updateUserDepartment(id, body);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
  })
  async updateUser(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserDto,
  ) {
    this.logger.log(`Admin updating user ${id}`);
    this.logger.log(`Payload received:`, JSON.stringify(body, null, 2));
    this.logger.log(`Payload type check - displayName: ${typeof body.displayName}, department: ${typeof body.department}, role: ${typeof body.role}, enabled: ${typeof body.enabled}`);
    return this.adminService.updateUser(id, body);
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

  @Post('impersonate/:userId')
  @ApiOperation({ summary: 'Impersonate a user (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns impersonation token and user details',
  })
  @ApiResponse({
    status: 403,
    description: 'Cannot impersonate admin users',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async impersonateUser(
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const adminPayload = req.user as JwtPayload | undefined;
    if (!adminPayload?.oid) {
      throw new ForbiddenException('Admin OID not found in token');
    }

    this.logger.log(
      `Admin ${adminPayload.email} attempting to impersonate user ${userId}`,
    );

    // Get target user from database
    const targetUser = await this.adminService.getUserById(userId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Cannot impersonate another admin
    if (targetUser.role === 'admin') {
      this.logger.warn(
        `Admin ${adminPayload.email} attempted to impersonate admin user ${targetUser.email}`,
      );
      throw new ForbiddenException('Cannot impersonate admin users');
    }

    // Cannot impersonate disabled users
    if (!targetUser.enabled) {
      throw new ForbiddenException('Cannot impersonate disabled users');
    }

    // Get tenant ID from the admin's token
    const tenantId = adminPayload.tid;
    if (!tenantId) {
      throw new ForbiddenException('Tenant ID not found in admin token');
    }

    // Generate impersonation token
    const token = this.authService.generateImpersonationToken(
      targetUser,
      adminPayload.oid,
      tenantId,
    );

    this.logger.log(
      `Admin ${adminPayload.email} is now impersonating ${targetUser.email}`,
    );

    // Audit log: impersonation with full admin context
    const adminUser = await this.adminService.getUserByOid(adminPayload.oid);
    this.auditService.log({
      actorId: adminUser?.id,
      actorEmail: adminPayload.email,
      action: 'auth.impersonate.start',
      targetType: 'user',
      targetId: targetUser.id,
      targetName: targetUser.displayName || targetUser.email,
      metadata: {
        targetEmail: targetUser.email,
        targetRole: targetUser.role,
        targetDepartment: targetUser.department,
      },
    }).catch(() => {}); // Fire-and-forget

    return {
      token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: targetUser.displayName,
        role: targetUser.role,
        department: targetUser.department,
      },
    };
  }
}
