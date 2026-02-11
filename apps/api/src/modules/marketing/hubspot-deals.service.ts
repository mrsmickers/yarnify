import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface HubSpotContact {
  email: string;
  firstName: string;
  lastName: string;
  company: string;
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    closedate?: string;
    lost_reason?: string;
    amount?: string;
  };
}

interface HubSpotSearchResponse {
  results: HubSpotDeal[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

interface HubSpotAssociationResponse {
  results: { id: string; type: string }[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

interface HubSpotContactResponse {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    company?: string;
  };
}

@Injectable()
export class HubspotDealsService {
  private readonly logger = new Logger(HubspotDealsService.name);
  private readonly baseUrl = 'https://api.hubapi.com';
  private readonly accessToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.accessToken = this.configService.get<string>(
      'HUBSPOT_ACCESS_TOKEN',
      '',
    );
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Search for all deals in the closedlost stage, handling pagination.
   */
  private async getClosedLostDeals(): Promise<HubSpotDeal[]> {
    const allDeals: HubSpotDeal[] = [];
    let after: string | undefined;

    do {
      const body: any = {
        filterGroups: [
          {
            filters: [
              {
                propertyName: 'dealstage',
                operator: 'EQ',
                value: 'closedlost',
              },
            ],
          },
        ],
        properties: ['dealname', 'closedate', 'lost_reason', 'amount'],
        limit: 100,
      };
      if (after) {
        body.after = after;
      }

      const { data } = await firstValueFrom(
        this.httpService.post<HubSpotSearchResponse>(
          `${this.baseUrl}/crm/v3/objects/deals/search`,
          body,
          { headers: this.headers },
        ),
      );

      allDeals.push(...data.results);
      after = data.paging?.next?.after;
    } while (after);

    this.logger.log(`Found ${allDeals.length} Closed Lost deals in HubSpot`);
    return allDeals;
  }

  /**
   * Get associated contact IDs for a deal.
   */
  private async getAssociatedContactIds(dealId: string): Promise<string[]> {
    const contactIds: string[] = [];
    let after: string | undefined;

    do {
      const params: any = {};
      if (after) params.after = after;

      const { data } = await firstValueFrom(
        this.httpService.get<HubSpotAssociationResponse>(
          `${this.baseUrl}/crm/v3/objects/deals/${dealId}/associations/contacts`,
          { headers: this.headers, params },
        ),
      );

      contactIds.push(...data.results.map((r) => r.id));
      after = data.paging?.next?.after;
    } while (after);

    return contactIds;
  }

  /**
   * Get contact details by ID.
   */
  private async getContactById(
    contactId: string,
  ): Promise<HubSpotContact | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<HubSpotContactResponse>(
          `${this.baseUrl}/crm/v3/objects/contacts/${contactId}`,
          {
            headers: this.headers,
            params: {
              properties: 'email,firstname,lastname,company',
            },
          },
        ),
      );

      if (!data.properties.email) return null;

      return {
        email: data.properties.email,
        firstName: data.properties.firstname ?? '',
        lastName: data.properties.lastname ?? '',
        company: data.properties.company ?? '',
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch HubSpot contact ${contactId}: ${err.message}`,
      );
      return null;
    }
  }

  /**
   * Main entry: get all contacts from Closed Lost deals, deduplicated by email.
   */
  async getContactsFromClosedLostDeals(): Promise<HubSpotContact[]> {
    const deals = await this.getClosedLostDeals();
    const contactMap = new Map<string, HubSpotContact>();

    for (const deal of deals) {
      const contactIds = await this.getAssociatedContactIds(deal.id);

      for (const contactId of contactIds) {
        const contact = await this.getContactById(contactId);
        if (contact) {
          // Deduplicate by lowercase email
          contactMap.set(contact.email.toLowerCase(), contact);
        }
      }

      // Small delay between deals to respect HubSpot rate limits
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    const contacts = Array.from(contactMap.values());
    this.logger.log(
      `Resolved ${contacts.length} unique contacts from ${deals.length} Closed Lost deals`,
    );
    return contacts;
  }
}
