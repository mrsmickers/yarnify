import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// Get all agents response
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  extension: z.string().nullable(),
  entraUserId: z.string().nullable(),
  entraUser: z
    .object({
      id: z.string(),
      email: z.string(),
      displayName: z.string().nullable(),
    })
    .nullable()
    .optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  _count: z
    .object({
      calls: z.number(),
    })
    .optional(),
});

export type Agent = z.infer<typeof AgentSchema>;

export const GetAgentsResponseSchema = z.object({
  agents: z.array(AgentSchema),
  total: z.number(),
});

export type GetAgentsResponse = z.infer<typeof GetAgentsResponseSchema>;

// Update agent
export const UpdateAgentSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
      invalid_type_error: 'Name must be a string',
    })
    .trim()
    .min(1, 'Name cannot be empty')
    .optional(),
  email: z
    .string()
    .email('Invalid email format')
    .trim()
    .optional()
    .nullable(),
  extension: z.string().trim().optional().nullable(),
  entraUserId: z.string().optional().nullable(),
});

export class UpdateAgentDto extends createZodDto(UpdateAgentSchema) {}
export type UpdateAgent = z.infer<typeof UpdateAgentSchema>;

// Create agent (for manual creation)
export const CreateAgentSchema = z.object({
  name: z
    .string({
      required_error: 'Name is required',
      invalid_type_error: 'Name must be a string',
    })
    .trim()
    .min(1, 'Name cannot be empty'),
  email: z.string().email('Invalid email format').trim().optional().nullable(),
  extension: z.string().trim().optional().nullable(),
  entraUserId: z.string().optional().nullable(),
});

export class CreateAgentDto extends createZodDto(CreateAgentSchema) {}
export type CreateAgent = z.infer<typeof CreateAgentSchema>;

// Sync response
export const SyncAgentsResponseSchema = z.object({
  created: z.number(),
  updated: z.number(),
  total: z.number(),
  agents: z.array(AgentSchema),
});

export type SyncAgentsResponse = z.infer<typeof SyncAgentsResponseSchema>;

