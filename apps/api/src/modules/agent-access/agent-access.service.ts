import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Agent, EntraUser } from '@db';

@Injectable()
export class AgentAccessService {
  private readonly logger = new Logger(AgentAccessService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all agent IDs a user can access.
   * This includes:
   * - Agents explicitly granted via UserAgentAccess
   * - The user's own linked agent (via Agent.entraUserId)
   */
  async getAccessibleAgentIds(userId: string): Promise<string[]> {
    // Get explicitly granted access
    const grantedAccess = await this.prisma.userAgentAccess.findMany({
      where: { userId },
      select: { agentId: true },
    });

    const agentIds = new Set(grantedAccess.map((a) => a.agentId));

    // Also include the user's own linked agent
    const ownAgent = await this.prisma.agent.findFirst({
      where: { entraUserId: userId },
      select: { id: true },
    });

    if (ownAgent) {
      agentIds.add(ownAgent.id);
    }

    return Array.from(agentIds);
  }

  /**
   * Get all users who have been granted access to a specific agent.
   */
  async getUsersWithAccess(agentId: string): Promise<EntraUser[]> {
    const access = await this.prisma.userAgentAccess.findMany({
      where: { agentId },
      include: { user: true },
    });

    return access.map((a) => a.user);
  }

  /**
   * Grant access to multiple agents for a user.
   * This adds to existing access (does not replace).
   */
  async grantAccess(
    userId: string,
    agentIds: string[],
    grantedBy: string,
  ): Promise<void> {
    // Verify user exists
    const user = await this.prisma.entraUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Verify all agents exist
    const agents = await this.prisma.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true },
    });

    const validAgentIds = new Set(agents.map((a) => a.id));
    const invalidIds = agentIds.filter((id) => !validAgentIds.has(id));

    if (invalidIds.length > 0) {
      throw new NotFoundException(`Agents not found: ${invalidIds.join(', ')}`);
    }

    // Create access records (skip if already exists)
    await this.prisma.userAgentAccess.createMany({
      data: agentIds.map((agentId) => ({
        userId,
        agentId,
        grantedBy,
      })),
      skipDuplicates: true,
    });

    this.logger.log(
      `Granted access to ${agentIds.length} agents for user ${userId} by ${grantedBy}`,
    );
  }

  /**
   * Revoke access to multiple agents for a user.
   */
  async revokeAccess(userId: string, agentIds: string[]): Promise<void> {
    const result = await this.prisma.userAgentAccess.deleteMany({
      where: {
        userId,
        agentId: { in: agentIds },
      },
    });

    this.logger.log(
      `Revoked access to ${result.count} agents for user ${userId}`,
    );
  }

  /**
   * Set the full access list for a user (replaces existing).
   * This is an idempotent operation.
   */
  async setUserAccess(
    userId: string,
    agentIds: string[],
    grantedBy: string,
  ): Promise<void> {
    // Verify user exists
    const user = await this.prisma.entraUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Filter out user's own linked agent (they always have access to their own)
    const ownAgent = await this.prisma.agent.findFirst({
      where: { entraUserId: userId },
      select: { id: true },
    });

    const filteredAgentIds = agentIds.filter((id) => id !== ownAgent?.id);

    // Verify all agents exist
    if (filteredAgentIds.length > 0) {
      const agents = await this.prisma.agent.findMany({
        where: { id: { in: filteredAgentIds } },
        select: { id: true },
      });

      const validAgentIds = new Set(agents.map((a) => a.id));
      const invalidIds = filteredAgentIds.filter((id) => !validAgentIds.has(id));

      if (invalidIds.length > 0) {
        throw new NotFoundException(`Agents not found: ${invalidIds.join(', ')}`);
      }
    }

    // Transaction: delete all existing, then create new
    await this.prisma.$transaction(async (tx) => {
      await tx.userAgentAccess.deleteMany({
        where: { userId },
      });

      if (filteredAgentIds.length > 0) {
        await tx.userAgentAccess.createMany({
          data: filteredAgentIds.map((agentId) => ({
            userId,
            agentId,
            grantedBy,
          })),
        });
      }
    });

    this.logger.log(
      `Set access to ${filteredAgentIds.length} agents for user ${userId} by ${grantedBy}`,
    );
  }

  /**
   * Get the list of agents a user has been granted explicit access to.
   * Does NOT include their own linked agent.
   */
  async getUserAccess(userId: string): Promise<Agent[]> {
    const access = await this.prisma.userAgentAccess.findMany({
      where: { userId },
      include: { agent: true },
      orderBy: { agent: { name: 'asc' } },
    });

    return access.map((a) => a.agent);
  }

  /**
   * Get full user access details including their own agent.
   */
  async getUserAccessWithOwnAgent(userId: string): Promise<{
    ownAgent: Agent | null;
    grantedAgents: Agent[];
    grantedAgentIds: string[];
  }> {
    // Get user's own linked agent
    const ownAgent = await this.prisma.agent.findFirst({
      where: { entraUserId: userId },
    });

    // Get explicitly granted access
    const access = await this.prisma.userAgentAccess.findMany({
      where: { userId },
      include: { agent: true },
      orderBy: { agent: { name: 'asc' } },
    });

    return {
      ownAgent,
      grantedAgents: access.map((a) => a.agent),
      grantedAgentIds: access.map((a) => a.agentId),
    };
  }

  /**
   * Check if a user has access to a specific agent's calls.
   */
  async hasAccessToAgent(userId: string, agentId: string): Promise<boolean> {
    // Check if it's their own agent
    const ownAgent = await this.prisma.agent.findFirst({
      where: { entraUserId: userId, id: agentId },
    });

    if (ownAgent) {
      return true;
    }

    // Check explicit access
    const access = await this.prisma.userAgentAccess.findUnique({
      where: {
        userId_agentId: { userId, agentId },
      },
    });

    return access !== null;
  }
}
