import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectwiseManageService } from '../connectwise-manage/connectwise-manage.service';
import { OpenAIService } from '../openai/openai.service';
import { CallRecordingService } from '../voip/call-recording.service';
import { dayjs } from '../../lib/dayjs';

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
   * List all users in the system with their basic info and status.
   */
  async listUsers() {
    return this.prisma.entraUser.findMany({
      select: {
        id: true,
        oid: true,
        email: true,
        displayName: true,
        role: true,
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
}

