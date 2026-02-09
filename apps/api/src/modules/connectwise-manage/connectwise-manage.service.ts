import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ManageAPI } from 'connectwise-rest';
import { Company } from './types';
import { CWTicket } from './dto/connectwise-tickets.dto';

@Injectable()
export class ConnectwiseManageService {
  private readonly logger = new Logger(ConnectwiseManageService.name);

  constructor(private readonly cw: ManageAPI) {}

  async getCompanyByPhoneNumber(phoneNumber: string): Promise<Company> {
    if (!phoneNumber) {
      throw new Error(
        'Phone Number is required for getByPhoneNumber operation.',
      );
    }

    try {
      const response = await this.cw.request({
        path: '/company/contacts',
        method: 'get',
        params: {
          childConditions: `communicationItems/value like "%${phoneNumber}%" AND communicationItems/communicationType = 'Phone'`,
          fields: 'id,firstName,lastName,company',
          pageSize: 1,
        },
      });

      if (!response || !response.length) {
        return null;
      }

      return response[0].company as Company;
    } catch (error) {
      console.error(
        `Error fetching company by phone number ${phoneNumber}:`,
        error,
      );
      throw new NotFoundException(
        `Failed to retrieve company for phone number: ${phoneNumber} due to an internal error or invalid credentials.`,
      );
    }
  }

  /**
   * Get today's tickets for a specific company
   */
  async getTicketsForCompany(companyName: string, date?: Date): Promise<CWTicket[]> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];
    
    // Get tickets created or updated on the target date for the company
    const conditions = [
      `company/name contains "${companyName}"`,
      `closedFlag=false`,
      // Get tickets from the last 7 days to ensure we show relevant ones
      `dateEntered >= [${dateStr}T00:00:00Z] or lastUpdated >= [${dateStr}T00:00:00Z]`,
    ].join(' and ');

    this.logger.log(`Searching CW tickets with conditions: ${conditions}`);

    try {
      const response = await this.cw.request({
        path: '/service/tickets',
        method: 'get',
        params: {
          conditions,
          orderBy: 'lastUpdated desc',
          pageSize: 50,
        },
      });

      this.logger.log(`Found ${response?.length || 0} tickets for company "${companyName}"`);
      return (response || []) as CWTicket[];
    } catch (error) {
      this.logger.error(`Error fetching tickets for company ${companyName}:`, error);
      throw error;
    }
  }

  /**
   * Search tickets by various criteria
   */
  async searchTickets(params: {
    companyName?: string;
    companyId?: number;
    dateFrom?: Date;
    dateTo?: Date;
    summary?: string;
    limit?: number;
  }): Promise<CWTicket[]> {
    const conditions: string[] = [];

    if (params.companyName) {
      conditions.push(`company/name contains "${params.companyName}"`);
    }
    if (params.companyId) {
      conditions.push(`company/id=${params.companyId}`);
    }
    if (params.dateFrom) {
      conditions.push(`dateEntered >= [${params.dateFrom.toISOString()}]`);
    }
    if (params.dateTo) {
      conditions.push(`dateEntered <= [${params.dateTo.toISOString()}]`);
    }
    if (params.summary) {
      conditions.push(`summary contains "${params.summary}"`);
    }

    // Default: only open tickets
    conditions.push('closedFlag=false');

    const conditionStr = conditions.join(' and ');
    this.logger.log(`Searching CW tickets with conditions: ${conditionStr}`);

    try {
      const response = await this.cw.request({
        path: '/service/tickets',
        method: 'get',
        params: {
          conditions: conditionStr,
          orderBy: 'lastUpdated desc',
          pageSize: params.limit || 20,
        },
      });

      this.logger.log(`Search returned ${response?.length || 0} tickets`);
      return (response || []) as CWTicket[];
    } catch (error) {
      this.logger.error(`Error searching tickets:`, error);
      throw error;
    }
  }

  /**
   * Get a single ticket by ID
   */
  async getTicket(ticketId: number): Promise<CWTicket> {
    try {
      const response = await this.cw.request({
        path: `/service/tickets/${ticketId}`,
        method: 'get',
      });

      if (!response) {
        throw new NotFoundException(`Ticket ${ticketId} not found`);
      }

      return response as CWTicket;
    } catch (error) {
      this.logger.error(`Error fetching ticket ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Add a note to a ticket
   * @param ticketId The ticket ID
   * @param text The note text
   * @param internalOnly If true, note is internal only. If false, it's external (visible to customer portal)
   * @returns The created note object
   */
  async addTicketNote(
    ticketId: number,
    text: string,
    internalOnly: boolean = true,
  ): Promise<{ id: number; text: string }> {
    this.logger.log(`Adding note to ticket ${ticketId} (internalOnly: ${internalOnly})`);

    try {
      const response = await this.cw.request({
        path: `/service/tickets/${ticketId}/notes`,
        method: 'post',
        data: {
          text,
          detailDescriptionFlag: false,
          internalAnalysisFlag: internalOnly,
          resolutionFlag: false,
          // internalFlag and externalFlag control visibility
          internalFlag: internalOnly,
          externalFlag: !internalOnly,
          // Ensure notifications are sent if appropriate
          processNotifications: !internalOnly,
        },
      });

      this.logger.log(`Successfully added note ${response?.id} to ticket ${ticketId}`);
      return response as { id: number; text: string };
    } catch (error) {
      this.logger.error(`Error adding note to ticket ${ticketId}:`, error);
      throw error;
    }
  }
}
