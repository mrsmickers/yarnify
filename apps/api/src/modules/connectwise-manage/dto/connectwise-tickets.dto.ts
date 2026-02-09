import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// CW Ticket type from API
export interface CWTicket {
  id: number;
  summary: string;
  board?: { id: number; name: string };
  status?: { id: number; name: string };
  company?: { id: number; identifier: string; name: string };
  contact?: { id: number; name: string };
  dateEntered?: string;
  lastUpdated?: string;
  closedFlag?: boolean;
  priority?: { id: number; name: string };
  owner?: { id: number; identifier: string; name: string };
}

// Query params for searching tickets
export const SearchTicketsQuerySchema = z.object({
  companyName: z.string().optional(),
  companyId: z.coerce.number().optional(),
  date: z.string().optional(), // ISO date string
  summary: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export class SearchTicketsQueryDto extends createZodDto(SearchTicketsQuerySchema) {}

// Body for adding a note to a ticket
export const AddTicketNoteBodySchema = z.object({
  text: z.string().min(1, 'Note text is required'),
  internalOnly: z.boolean().default(true),
});

export class AddTicketNoteBodyDto extends createZodDto(AddTicketNoteBodySchema) {}

// Response types
export interface AddTicketNoteResponse {
  success: boolean;
  noteId?: number;
  ticketId: number;
}
