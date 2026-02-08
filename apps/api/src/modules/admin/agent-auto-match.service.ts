import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AutoMatchResult {
  matched: boolean;
  agentId?: string;
  agentName?: string;
}

export interface BulkAutoMatchResult {
  matched: number;
  details: Array<{ agentId: string; agentName: string; userId: string; userEmail: string; matchedBy: string }>;
  unmatched: string[];
}

@Injectable()
export class AgentAutoMatchService {
  private readonly logger = new Logger(AgentAutoMatchService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Try to auto-link an EntraUser to an unlinked Agent.
   * Called after successful login if user has no linked agent.
   *
   * Matching strategy (in order):
   * 1. Exact email match: Agent.email === user.email (case-insensitive)
   * 2. Display name match: Agent.name === user.displayName (case-insensitive, trimmed)
   *
   * Only matches if Agent.entraUserId is null (not already linked).
   */
  async tryAutoMatch(
    userId: string,
    email: string,
    displayName?: string | null,
  ): Promise<AutoMatchResult> {
    try {
      // Strategy 1: Exact email match (case-insensitive)
      if (email) {
        const agentByEmail = await this.prisma.agent.findFirst({
          where: {
            email: { equals: email, mode: 'insensitive' },
            entraUserId: null,
          },
        });

        if (agentByEmail) {
          await this.prisma.agent.update({
            where: { id: agentByEmail.id },
            data: { entraUserId: userId },
          });

          this.logger.log(
            `Auto-matched agent "${agentByEmail.name}" (${agentByEmail.id}) to user ${email} via email match`,
          );

          return {
            matched: true,
            agentId: agentByEmail.id,
            agentName: agentByEmail.name,
          };
        }
      }

      // Strategy 2: Display name match (case-insensitive, trimmed)
      if (displayName && displayName.trim().length > 0) {
        const trimmedName = displayName.trim();

        const agentByName = await this.prisma.agent.findFirst({
          where: {
            name: { equals: trimmedName, mode: 'insensitive' },
            entraUserId: null,
          },
        });

        if (agentByName) {
          await this.prisma.agent.update({
            where: { id: agentByName.id },
            data: { entraUserId: userId },
          });

          this.logger.log(
            `Auto-matched agent "${agentByName.name}" (${agentByName.id}) to user ${email} via display name match`,
          );

          return {
            matched: true,
            agentId: agentByName.id,
            agentName: agentByName.name,
          };
        }
      }

      this.logger.debug(
        `No auto-match found for user ${email} (displayName: ${displayName || 'n/a'})`,
      );

      return { matched: false };
    } catch (error) {
      this.logger.error(
        `Error during auto-match for user ${email}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return { matched: false };
    }
  }

  /**
   * Bulk auto-match: iterate all unlinked agents and try to match against all users.
   * Used by admin endpoint to trigger matching for all agents at once.
   */
  async bulkAutoMatch(): Promise<BulkAutoMatchResult> {
    const unlinkedAgents = await this.prisma.agent.findMany({
      where: { entraUserId: null },
    });

    const allUsers = await this.prisma.entraUser.findMany({
      where: { enabled: true },
    });

    // Build a set of user IDs that already have linked agents
    const linkedUserIds = new Set(
      (
        await this.prisma.agent.findMany({
          where: { entraUserId: { not: null } },
          select: { entraUserId: true },
        })
      )
        .map((a) => a.entraUserId)
        .filter(Boolean) as string[],
    );

    // Filter to users who don't already have a linked agent
    const availableUsers = allUsers.filter((u) => !linkedUserIds.has(u.id));

    let matched = 0;
    const details: BulkAutoMatchResult['details'] = [];
    const unmatched: string[] = [];

    for (const agent of unlinkedAgents) {
      let matchedUser: (typeof availableUsers)[number] | null = null;
      let matchedBy = '';

      // Strategy 1: Email match
      if (agent.email) {
        matchedUser =
          availableUsers.find(
            (u) =>
              u.email.toLowerCase() === agent.email!.toLowerCase(),
          ) || null;
        if (matchedUser) matchedBy = 'email';
      }

      // Strategy 2: Name match
      if (!matchedUser && agent.name) {
        matchedUser =
          availableUsers.find(
            (u) =>
              u.displayName &&
              u.displayName.trim().toLowerCase() ===
                agent.name.trim().toLowerCase(),
          ) || null;
        if (matchedUser) matchedBy = 'displayName';
      }

      if (matchedUser) {
        try {
          await this.prisma.agent.update({
            where: { id: agent.id },
            data: { entraUserId: matchedUser.id },
          });

          // Remove from available pool so we don't double-match
          const idx = availableUsers.findIndex((u) => u.id === matchedUser!.id);
          if (idx >= 0) availableUsers.splice(idx, 1);

          matched++;
          details.push({
            agentId: agent.id,
            agentName: agent.name,
            userId: matchedUser.id,
            userEmail: matchedUser.email,
            matchedBy,
          });

          this.logger.log(
            `Bulk auto-matched agent "${agent.name}" to user ${matchedUser.email} via ${matchedBy}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to link agent "${agent.name}" to user ${matchedUser.email}: ${(error as Error).message}`,
          );
          unmatched.push(agent.name);
        }
      } else {
        unmatched.push(agent.name);
      }
    }

    this.logger.log(
      `Bulk auto-match complete: ${matched} matched, ${unmatched.length} unmatched`,
    );

    return { matched, details, unmatched };
  }
}
