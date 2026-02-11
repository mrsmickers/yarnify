import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface CWContact {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  company: { id: number; identifier: string; name: string } | null;
  types?: { id: number; name: string }[];
}

interface CWCompany {
  id: number;
  identifier: string;
  name: string;
  status: { id: number; name: string };
  types?: { id: number; name: string }[];
}

interface FilterConfig {
  companyTypes: number[];
  companyExcludeTypes: number[];
  companyStatuses: number[];
  contactTypes: number[];
  contactExcludeTypes: number[];
}

@Injectable()
export class ConnectwiseContactsService {
  private readonly logger = new Logger(ConnectwiseContactsService.name);
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly clientId: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const companyId = this.configService.get<string>(
      'CONNECTWISE_COMPANY_ID',
      'computereyez',
    );
    const publicKey = this.configService.get<string>('CONNECTWISE_PUBLIC_KEY', '');
    const privateKey = this.configService.get<string>('CONNECTWISE_PRIVATE_KEY', '');
    this.clientId = this.configService.get<string>('CONNECTWISE_CLIENT_ID', '');

    // Use the existing CW env vars; fall back to CW_* prefixed vars from the spec
    const cwPublicKey =
      publicKey || this.configService.get<string>('CW_PUBLIC_KEY', '');
    const cwPrivateKey =
      privateKey || this.configService.get<string>('CW_PRIVATE_KEY', '');
    const cwClientId =
      this.clientId || this.configService.get<string>('CW_CLIENT_ID', '');
    this.clientId = cwClientId;

    this.authHeader = `Basic ${Buffer.from(`${companyId}+${cwPublicKey}:${cwPrivateKey}`).toString('base64')}`;

    const cwUrl = this.configService.get<string>(
      'CONNECTWISE_URL',
      'https://api-eu.myconnectwise.net',
    );
    // Normalise: strip trailing slash, ensure we point at the REST endpoint
    this.baseUrl = cwUrl.replace(/\/+$/, '');
    if (!this.baseUrl.includes('/apis/')) {
      this.baseUrl += '/v2025_1/apis/3.0';
    }
  }

  private get headers() {
    return {
      Authorization: this.authHeader,
      clientId: this.clientId,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch all companies matching status filter, then filter in code for types.
   */
  private async getFilteredCompanies(
    filter: FilterConfig,
  ): Promise<CWCompany[]> {
    const statusCondition = filter.companyStatuses
      .map((s) => `status/id=${s}`)
      .join(' OR ');
    const condition = `(${statusCondition})`;

    let allCompanies: CWCompany[] = [];
    let page = 1;
    const pageSize = 250;

    while (true) {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/company/companies`, {
          headers: this.headers,
          params: {
            conditions: condition,
            fields: 'id,identifier,name,status,types',
            pageSize,
            page,
          },
        }),
      );
      if (!data || data.length === 0) break;
      allCompanies = allCompanies.concat(data);
      if (data.length < pageSize) break;
      page++;
    }

    this.logger.log(
      `Fetched ${allCompanies.length} active companies from ConnectWise`,
    );

    // Filter for required company types and exclude unwanted types
    return allCompanies.filter((company) => {
      const typeIds = (company.types ?? []).map((t) => t.id);
      const hasRequired = filter.companyTypes.some((t) => typeIds.includes(t));
      const hasExcluded = filter.companyExcludeTypes.some((t) =>
        typeIds.includes(t),
      );
      return hasRequired && !hasExcluded;
    });
  }

  /**
   * Fetch contacts for a set of company IDs, filter by contact types.
   */
  private async getFilteredContacts(
    companyIds: number[],
    filter: FilterConfig,
  ): Promise<CWContact[]> {
    let allContacts: any[] = [];

    // Batch company IDs to avoid oversized query strings
    const batchSize = 50;
    for (let i = 0; i < companyIds.length; i += batchSize) {
      const batch = companyIds.slice(i, i + batchSize);
      const companyCondition = batch
        .map((id) => `company/id=${id}`)
        .join(' OR ');
      const condition = `(${companyCondition}) AND inactiveFlag=false`;

      let page = 1;
      const pageSize = 250;

      while (true) {
        const { data } = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/company/contacts`, {
            headers: this.headers,
            params: {
              conditions: condition,
              fields:
                'id,firstName,lastName,company,types,communicationItems',
              pageSize,
              page,
            },
          }),
        );
        if (!data || data.length === 0) break;
        allContacts = allContacts.concat(data);
        if (data.length < pageSize) break;
        page++;
      }
    }

    this.logger.log(
      `Fetched ${allContacts.length} active contacts from ConnectWise`,
    );

    // Filter by contact type
    const filtered = allContacts.filter((contact) => {
      const typeIds = (contact.types ?? []).map((t: any) => t.id);
      const hasRequired = filter.contactTypes.some((t) => typeIds.includes(t));
      const hasExcluded = filter.contactExcludeTypes.some((t) =>
        typeIds.includes(t),
      );
      return hasRequired && !hasExcluded;
    });

    // Extract email from communicationItems
    return filtered
      .map((contact) => {
        const emailItem = (contact.communicationItems ?? []).find(
          (ci: any) =>
            ci.type?.name?.toLowerCase() === 'email' ||
            ci.communicationType === 'Email',
        );
        return {
          id: contact.id,
          firstName: contact.firstName ?? '',
          lastName: contact.lastName ?? '',
          email: emailItem?.value ?? null,
          company: contact.company ?? null,
          types: contact.types,
        } as CWContact;
      })
      .filter((c) => c.email); // Only contacts with a valid email
  }

  /**
   * Main entry: get all CW contacts matching the sync's filter config.
   */
  async getContactsForSync(filterConfig: FilterConfig): Promise<CWContact[]> {
    const companies = await this.getFilteredCompanies(filterConfig);
    if (companies.length === 0) {
      this.logger.warn('No companies matched the filter config');
      return [];
    }

    this.logger.log(
      `${companies.length} companies matched filter. Fetching contacts...`,
    );

    const companyIds = companies.map((c) => c.id);
    const contacts = await this.getFilteredContacts(companyIds, filterConfig);

    this.logger.log(
      `${contacts.length} contacts matched after type filtering`,
    );
    return contacts;
  }
}
