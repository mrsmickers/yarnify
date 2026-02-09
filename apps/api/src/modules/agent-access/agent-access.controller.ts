import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtOrStagingGuard } from '../../common/guards/jwt-or-staging.guard';
import { AgentAccessService } from './agent-access.service';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  SetUserAgentAccessDto,
  UserAgentAccessResponseDto,
  AgentUserAccessResponseDto,
} from './dto/agent-access.dto';

@Controller('api/v1/admin/agent-access')
@UseGuards(JwtOrStagingGuard)
export class AgentAccessController {
  private readonly logger = new Logger(AgentAccessController.name);

  constructor(
    private readonly agentAccessService: AgentAccessService,
    private readonly permissionsService: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Check if the requesting user has permission to manage agent access.
   */
  private async checkPermission(req: any): Promise<string> {
    const userOid = req.user?.sub;
    if (!userOid) {
      throw new ForbiddenException('User not authenticated');
    }

    // Find user by OID
    const user = await this.prisma.entraUser.findUnique({
      where: { oid: userOid },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Admins always have access
    if (user.role === 'admin') {
      return user.id;
    }

    // Check for specific permission
    const hasPermission = await this.permissionsService.hasPermission(
      user.id,
      'admin.agent_access',
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to manage agent access',
      );
    }

    return user.id;
  }

  /**
   * Get a user's agent access configuration.
   * Shows their own linked agent (if any) and explicitly granted agents.
   */
  @Get('users/:userId')
  async getUserAccess(
    @Param('userId') userId: string,
    @Request() req: any,
  ): Promise<UserAgentAccessResponseDto> {
    await this.checkPermission(req);

    const access = await this.agentAccessService.getUserAccessWithOwnAgent(userId);

    return {
      userId,
      ownAgent: access.ownAgent
        ? {
            id: access.ownAgent.id,
            name: access.ownAgent.name,
            extension: access.ownAgent.extension,
          }
        : null,
      grantedAgents: access.grantedAgents.map((a) => ({
        id: a.id,
        name: a.name,
        extension: a.extension,
      })),
      grantedAgentIds: access.grantedAgentIds,
    };
  }

  /**
   * Set a user's agent access (replaces existing grants).
   * The user's own linked agent is automatically included.
   */
  @Put('users/:userId')
  async setUserAccess(
    @Param('userId') userId: string,
    @Body() body: SetUserAgentAccessDto,
    @Request() req: any,
  ): Promise<{ success: boolean; message: string }> {
    const adminUserId = await this.checkPermission(req);

    await this.agentAccessService.setUserAccess(
      userId,
      body.agentIds,
      adminUserId,
    );

    this.logger.log(
      `User ${adminUserId} set agent access for ${userId}: ${body.agentIds.length} agents`,
    );

    return {
      success: true,
      message: `Updated agent access for user. ${body.agentIds.length} agents granted.`,
    };
  }

  /**
   * Get all users who have access to a specific agent's calls.
   */
  @Get('agents/:agentId')
  async getAgentUsers(
    @Param('agentId') agentId: string,
    @Request() req: any,
  ): Promise<AgentUserAccessResponseDto> {
    await this.checkPermission(req);

    // Get agent details
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new ForbiddenException('Agent not found');
    }

    // Get users with explicit access
    const accessRecords = await this.prisma.userAgentAccess.findMany({
      where: { agentId },
      include: { user: true },
      orderBy: { user: { displayName: 'asc' } },
    });

    // Also include the agent's linked user (if any)
    const users = accessRecords.map((a) => ({
      id: a.user.id,
      email: a.user.email,
      displayName: a.user.displayName,
      role: a.user.role,
      grantedAt: a.grantedAt.toISOString(),
    }));

    // Add linked user if not already in list
    if (agent.entraUserId) {
      const linkedUser = await this.prisma.entraUser.findUnique({
        where: { id: agent.entraUserId },
      });

      if (linkedUser && !users.some((u) => u.id === linkedUser.id)) {
        users.unshift({
          id: linkedUser.id,
          email: linkedUser.email,
          displayName: linkedUser.displayName,
          role: linkedUser.role,
          grantedAt: 'linked', // Special marker for linked user
        });
      }
    }

    return {
      agentId,
      agentName: agent.name,
      users,
    };
  }
}
