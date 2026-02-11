import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface EnchargePerson {
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  company?: string;
  tags?: string;
  [key: string]: any;
}

@Injectable()
export class EnchargeService {
  private readonly logger = new Logger(EnchargeService.name);
  private readonly baseUrl = 'https://api.encharge.io/v1';
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('ENCHARGE_REST_API_KEY', '');
  }

  private get headers() {
    return {
      'X-Encharge-Token': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  async getAllPeople(): Promise<EnchargePerson[]> {
    this.logger.log('Fetching all Encharge contacts');
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.baseUrl}/people/all`, {
        headers: this.headers,
      }),
    );
    return data?.people ?? [];
  }

  async upsertPerson(person: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    tags?: string;
  }): Promise<void> {
    this.logger.debug(`Upserting Encharge contact: ${person.email}`);
    await firstValueFrom(
      this.httpService.post(`${this.baseUrl}/people`, person, {
        headers: this.headers,
      }),
    );
  }

  async addTag(email: string, tag: string): Promise<void> {
    this.logger.debug(`Adding tag "${tag}" to ${email}`);
    await firstValueFrom(
      this.httpService.post(
        `${this.baseUrl}/tags`,
        { tag, email },
        { headers: this.headers },
      ),
    );
  }

  async removeTag(email: string, tag: string): Promise<void> {
    this.logger.debug(`Removing tag "${tag}" from ${email}`);
    await firstValueFrom(
      this.httpService.delete(`${this.baseUrl}/tags`, {
        headers: this.headers,
        data: { tag, email },
      }),
    );
  }
}
