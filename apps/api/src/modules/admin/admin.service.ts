import {
  Injectable,
  NotFoundException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectwiseManageService } from '../connectwise-manage/connectwise-manage.service';
import { OpenAIService } from '../openai/openai.service';
import { CallRecordingService } from '../voip/call-recording.service';
import { dayjs } from '../../lib/dayjs';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDepartmentDto } from './dto/update-user-department.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  PENDING_ENTRA_OID_PREFIX,
  isPendingEntraOid,
} from '../../common/constants/entra.constants';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly connectwiseService: ConnectwiseManageService,
    private readonly openaiService: OpenAIService,
    private readonly voipService: CallRecordingService,
  ) {}

  /**
   * Get a user by their ID.
   */
  async getUserById(id: string) {
    return this.prisma.entraUser.findUnique({
      where: { id },
    });
  }

  /**
   * List all users in the system with their basic info and status.
   */
  async listUsers() {
    const users = await this.prisma.entraUser.findMany({
      select: {
        id: true,
        oid: true,
        email: true,
        displayName: true,
        department: true,
        role: true,
        contextBox: true,
        enabled: true,
        lastLoginAt: true,
        lastSyncedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: 'desc' }, // Admins first
        { createdAt: 'desc' },
      ],
    });

    return users.map((user) => this.maskPendingOid(user));
  }

  /**
   * Provision a user so they can authenticate via Entra.
   */
  async createUser(payload: CreateUserDto) {
    const now = new Date();
    const normalizedEmail = payload.email.toLowerCase();
    const sanitizedDisplayName = payload.displayName.trim();
    const enabled = payload.enabled ?? true;

    const baseCreateData = {
      oid: payload.oid?.trim() ?? null,
      email: normalizedEmail,
      displayName: sanitizedDisplayName,
      department: payload.department,
      role: payload.role,
      enabled,
      lastLoginAt: null,
      lastSyncedAt: now,
    };

    try {
      const user = await this.prisma.entraUser.create({
        data: baseCreateData,
      });

      this.logger.log(
        `Provisioned Entra user ${user.email} (${user.oid ?? 'oid-pending'})`,
      );

      return {
        success: true,
        user: this.maskPendingOid(user),
      };
    } catch (error) {
      if (!payload.oid && this.isOidNullConstraint(error)) {
        this.logger.warn(
          `OID column rejected null for ${normalizedEmail}. Re-attempting with pending placeholder.`,
        );

        try {
          const fallbackUser = await this.prisma.entraUser.create({
            data: {
              ...baseCreateData,
              oid: `${PENDING_ENTRA_OID_PREFIX}${createId()}`,
            },
          });

          this.logger.log(
            `Provisioned Entra user ${fallbackUser.email} with pending OID placeholder`,
          );

          return {
            success: true,
            user: this.maskPendingOid(fallbackUser),
          };
        } catch (fallbackError) {
          this.logger.error(
            `Fallback provisioning failed for ${normalizedEmail}`,
            fallbackError as Error,
          );
        }
      }

      this.logger.error(
        `Failed to create Entra user ${normalizedEmail}`,
        error as Error,
      );

      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        const meta = (error as { meta?: { target?: string | string[] } }).meta;
        const target = Array.isArray(meta?.target)
          ? meta?.target.join(', ')
          : meta?.target;
        throw new ConflictException(
          `A user already exists with the same ${target || 'unique field'}.`,
        );
      }

      throw new BadRequestException('Unable to create user');
    }
  }

  /**
   * Enable or disable a user account.
   * Note: This doesn't revoke Entra tokens, but prevents future logins.
   */
  async updateUserStatus(id: string, enabled: boolean) {
    try {
      const user = await this.prisma.entraUser.update({
        where: { id },
        data: { 
          enabled,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `User ${user.email} (${user.id}) ${enabled ? 'enabled' : 'disabled'}`,
      );

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          enabled: user.enabled,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update user status: ${error}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Update a user's RBAC role.
   */
  async updateUserRole(id: string, role: 'admin' | 'manager' | 'team_lead' | 'user') {
    try {
      const user = await this.prisma.entraUser.update({
        where: { id },
        data: {
          role,
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `User ${user.email} (${user.id}) department updated to ${user.department}`,
      );

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to update user role: ${error}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Update a user's department.
   */
  async updateUserDepartment(id: string, payload: UpdateUserDepartmentDto) {
    try {
      const user = await this.prisma.entraUser.update({
        where: { id },
        data: {
          department: payload.department.trim(),
          updatedAt: new Date(),
        },
      });

      this.logger.log(
        `User ${user.email} (${user.id}) role updated to ${user.role}`,
      );

      return {
        success: true,
        user: this.maskPendingOid(user),
      };
    } catch (error) {
      this.logger.error(`Failed to update user department: ${error}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Update a user's information (display name, department, role, enabled status).
   */
  async updateUser(id: string, payload: UpdateUserDto) {
    try {
      const updateData: {
        displayName: string;
        department: string;
        role?: 'admin' | 'manager' | 'team_lead' | 'user';
        enabled?: boolean;
        contextBox?: string | null;
        updatedAt: Date;
      } = {
        displayName: payload.displayName.trim(),
        department: payload.department,
        updatedAt: new Date(),
      };

      if (payload.role !== undefined) {
        updateData.role = payload.role;
      }
      if (payload.enabled !== undefined) {
        updateData.enabled = payload.enabled;
      }
      if (payload.contextBox !== undefined) {
        updateData.contextBox = payload.contextBox ?? null;
      }

      const user = await this.prisma.entraUser.update({
        where: { id },
        data: updateData,
      });

      this.logger.log(`User ${user.email} (${user.id}) updated`);

      return {
        success: true,
        user: this.maskPendingOid(user),
      };
    } catch (error) {
      this.logger.error(`Failed to update user: ${error}`);
      throw new NotFoundException(`User with ID ${id} not found`);
    }
  }

  /**
   * Get system statistics for admin dashboard.
   */
  async getStats() {
    const [totalUsers, activeUsers, adminUsers, recentLogins] = await Promise.all([
      this.prisma.entraUser.count(),
      this.prisma.entraUser.count({
        where: { enabled: true },
      }),
      this.prisma.entraUser.count({
        where: { role: 'admin' },
      }),
      this.prisma.entraUser.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        disabled: totalUsers - activeUsers,
        admins: adminUsers,
      },
      activity: {
        loginsLast7Days: recentLogins,
      },
    };
  }

  /**
   * Test all API connections and return their status
   */
  async testApiConnections() {
    const results = {
      local: { status: 'success', message: 'Local API is operational', responseTime: 0 },
      connectwise: { status: 'unknown', message: '', responseTime: 0 },
      openai: { status: 'unknown', message: '', responseTime: 0 },
      voip: { status: 'unknown', message: '', responseTime: 0 },
    };

    // Test ConnectWise
    try {
      const startTime = Date.now();
      // Try to fetch a contact list (with empty conditions to just test connectivity)
      await this.connectwiseService.getCompanyByPhoneNumber('+1234567890');
      results.connectwise = {
        status: 'success',
        message: 'ConnectWise API is accessible',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      results.connectwise = {
        status: 'error',
        message: error.message || 'Failed to connect to ConnectWise API',
        responseTime: 0,
      };
    }

    // Test OpenAI
    try {
      const startTime = Date.now();
      const client = this.openaiService.getClient();
      // Simple API test - list models
      await client.models.list();
      results.openai = {
        status: 'success',
        message: 'OpenAI API is accessible',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      results.openai = {
        status: 'error',
        message: error.message || 'Failed to connect to OpenAI API',
        responseTime: 0,
      };
    }

    // Test VoIP
    try {
      const startTime = Date.now();
      // Test with a small date range (today)
      const today = dayjs();
      const startDateUnix = today.startOf('day').unix().toString();
      const endDateUnix = today.endOf('day').unix().toString();
      await this.voipService.listCallRecordings(startDateUnix, endDateUnix);
      results.voip = {
        status: 'success',
        message: 'VoIP API is accessible',
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      results.voip = {
        status: 'error',
        message: error.message || 'Failed to connect to VoIP API',
        responseTime: 0,
      };
    }

    return results;
  }

  private maskPendingOid<T extends { oid: string | null }>(user: T): T {
    if (user.oid && isPendingEntraOid(user.oid)) {
      return { ...user, oid: null };
    }
    return user;
  }

  private isOidNullConstraint(error: unknown): boolean {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2011'
    ) {
      const meta = (error as {
        meta?: { constraint?: string; field_name?: string };
      }).meta;
      const constraint = meta?.constraint ?? meta?.field_name;
      return typeof constraint === 'string'
        ? constraint.includes('oid')
        : true;
    }

    if (error instanceof Error) {
      return /column "oid".*null value/i.test(error.message);
    }

    return false;
  }
}
