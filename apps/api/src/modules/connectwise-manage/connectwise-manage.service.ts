import { Injectable, NotFoundException } from '@nestjs/common';
import { ManageAPI } from 'connectwise-rest';
import { Company } from './types';

@Injectable()
export class ConnectwiseManageService {
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
}
