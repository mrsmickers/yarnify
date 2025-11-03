import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

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
}

