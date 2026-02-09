import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * List all available permissions
   */
  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  /**
   * Get permissions grouped by category
   */
  async listPermissionsGrouped() {
    const permissions = await this.listPermissions();
    const grouped: Record<string, typeof permissions> = {};
    
    for (const perm of permissions) {
      if (!grouped[perm.category]) {
        grouped[perm.category] = [];
      }
      grouped[perm.category].push(perm);
    }
    
    return grouped;
  }

  /**
   * Check if a user has a specific permission
   * Logic: Start with role permissions, then apply user overrides
   */
  async hasPermission(userId: string, code: string): Promise<boolean> {
    // Get user's role
    const user = await this.prisma.entraUser.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found for permission check`);
      return false;
    }

    // Check for user-specific override first
    const override = await this.prisma.userPermissionOverride.findUnique({
      where: {
        userId_permissionCode: { userId, permissionCode: code },
      },
    });

    if (override !== null) {
      return override.granted;
    }

    // Fall back to role permission
    const rolePermission = await this.prisma.rolePermission.findUnique({
      where: {
        role_permissionCode: { role: user.role, permissionCode: code },
      },
    });

    return rolePermission !== null;
  }

  /**
   * Get all effective permissions for a user
   * Combines role permissions with user overrides
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    // Get user's role
    const user = await this.prisma.entraUser.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      this.logger.warn(`User ${userId} not found for permission check`);
      return [];
    }

    // Get role permissions
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: user.role },
      select: { permissionCode: true },
    });

    const permissionSet = new Set(rolePermissions.map((rp) => rp.permissionCode));

    // Get user overrides
    const overrides = await this.prisma.userPermissionOverride.findMany({
      where: { userId },
    });

    // Apply overrides
    for (const override of overrides) {
      if (override.granted) {
        permissionSet.add(override.permissionCode);
      } else {
        permissionSet.delete(override.permissionCode);
      }
    }

    return Array.from(permissionSet).sort();
  }

  /**
   * Get permissions assigned to a role
   */
  async listRolePermissions(role: string): Promise<string[]> {
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role },
      select: { permissionCode: true },
    });

    return rolePermissions.map((rp) => rp.permissionCode);
  }

  /**
   * Set permissions for a role (replaces existing)
   */
  async setRolePermissions(role: string, codes: string[]): Promise<void> {
    this.logger.log(`Setting permissions for role ${role}: ${codes.join(', ')}`);

    // Verify all permission codes exist
    const validPermissions = await this.prisma.permission.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });

    const validCodes = new Set(validPermissions.map((p) => p.code));
    const invalidCodes = codes.filter((c) => !validCodes.has(c));
    
    if (invalidCodes.length > 0) {
      throw new NotFoundException(`Invalid permission codes: ${invalidCodes.join(', ')}`);
    }

    // Get existing permissions for audit diff
    const existingPermissions = await this.listRolePermissions(role);

    await this.prisma.$transaction(async (tx) => {
      // Delete existing role permissions
      await tx.rolePermission.deleteMany({
        where: { role },
      });

      // Create new role permissions
      if (codes.length > 0) {
        await tx.rolePermission.createMany({
          data: codes.map((code) => ({
            role,
            permissionCode: code,
          })),
        });
      }
    });

    this.logger.log(`Successfully set ${codes.length} permissions for role ${role}`);

    // Audit log: role permissions updated
    this.auditService.log({
      action: 'permission.role.update',
      targetType: 'role',
      targetId: role,
      targetName: role,
      metadata: {
        previousPermissions: existingPermissions,
        newPermissions: codes,
        added: codes.filter((c) => !existingPermissions.includes(c)),
        removed: existingPermissions.filter((c) => !codes.includes(c)),
      },
    }).catch(() => {}); // Fire-and-forget
  }

  /**
   * Get user permission overrides
   */
  async getUserOverrides(userId: string) {
    return this.prisma.userPermissionOverride.findMany({
      where: { userId },
      include: { permission: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Set a user permission override
   * @param granted - true to grant, false to revoke, null to remove override
   */
  async setUserOverride(
    userId: string,
    code: string,
    granted: boolean | null,
  ): Promise<void> {
    // Verify user exists
    const user = await this.prisma.entraUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Verify permission exists
    const permission = await this.prisma.permission.findUnique({
      where: { code },
    });

    if (!permission) {
      throw new NotFoundException(`Permission ${code} not found`);
    }

    if (granted === null) {
      // Remove override (use role default)
      await this.prisma.userPermissionOverride.deleteMany({
        where: { userId, permissionCode: code },
      });
      this.logger.log(`Removed override for user ${userId}, permission ${code}`);

      // Audit log: override removed
      this.auditService.log({
        action: 'permission.user.override',
        targetType: 'user',
        targetId: userId,
        targetName: user.email,
        metadata: {
          permissionCode: code,
          action: 'removed',
        },
      }).catch(() => {}); // Fire-and-forget
    } else {
      // Upsert override
      await this.prisma.userPermissionOverride.upsert({
        where: {
          userId_permissionCode: { userId, permissionCode: code },
        },
        update: { granted },
        create: { userId, permissionCode: code, granted },
      });
      this.logger.log(
        `Set override for user ${userId}, permission ${code}: ${granted ? 'granted' : 'revoked'}`,
      );

      // Audit log: override set
      this.auditService.log({
        action: 'permission.user.override',
        targetType: 'user',
        targetId: userId,
        targetName: user.email,
        metadata: {
          permissionCode: code,
          action: granted ? 'granted' : 'revoked',
        },
      }).catch(() => {}); // Fire-and-forget
    }
  }

  /**
   * Set multiple user overrides at once
   */
  async setUserOverrides(
    userId: string,
    overrides: Array<{ code: string; granted: boolean | null }>,
  ): Promise<void> {
    // Verify user exists
    const user = await this.prisma.entraUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    for (const override of overrides) {
      await this.setUserOverride(userId, override.code, override.granted);
    }
  }

  /**
   * Get all available roles
   */
  getRoles(): string[] {
    return ['admin', 'manager', 'team_lead', 'user'];
  }
}
