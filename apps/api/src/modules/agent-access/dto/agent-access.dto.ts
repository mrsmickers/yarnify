import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Set user's agent access (replaces existing)
export const SetUserAgentAccessSchema = z.object({
  agentIds: z.array(z.string()).describe('Array of agent IDs to grant access to'),
});

export class SetUserAgentAccessDto extends createZodDto(SetUserAgentAccessSchema) {}

// Response for user's agent access
export const UserAgentAccessResponseSchema = z.object({
  userId: z.string(),
  ownAgent: z
    .object({
      id: z.string(),
      name: z.string(),
      extension: z.string().nullable(),
    })
    .nullable()
    .describe('The user\'s own linked agent (always has access)'),
  grantedAgents: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        extension: z.string().nullable(),
      }),
    )
    .describe('Agents the user has been explicitly granted access to'),
  grantedAgentIds: z.array(z.string()).describe('IDs of granted agents'),
});

export class UserAgentAccessResponseDto extends createZodDto(
  UserAgentAccessResponseSchema,
) {}

// Response for agent's user access
export const AgentUserAccessResponseSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  users: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      displayName: z.string().nullable(),
      role: z.string(),
      grantedAt: z.string(),
    }),
  ),
});

export class AgentUserAccessResponseDto extends createZodDto(
  AgentUserAccessResponseSchema,
) {}
