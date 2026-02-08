import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Logger,
  UsePipes,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompanyInfoService } from './company-info.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  UpsertCompanyInfoDto,
  UpsertCompanyInfoSchema,
} from './dto/upsert-company-info.dto';

@ApiTags('Admin - Company Info')
@ApiBearerAuth()
@Controller('admin/company-info')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class CompanyInfoController {
  private readonly logger = new Logger(CompanyInfoController.name);

  constructor(private readonly companyInfoService: CompanyInfoService) {}

  @Get()
  @ApiOperation({ summary: 'Get company info' })
  @ApiResponse({ status: 200, description: 'Returns the company info' })
  async get() {
    this.logger.log('Admin requested company info');
    return this.companyInfoService.get();
  }

  @Put()
  @UsePipes(new ZodValidationPipe(UpsertCompanyInfoSchema))
  @ApiOperation({ summary: 'Update company info' })
  @ApiResponse({ status: 200, description: 'Company info updated successfully' })
  async upsert(@Body() dto: UpsertCompanyInfoDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.email || null;
    this.logger.log(`Admin updating company info (by: ${userId})`);
    return this.companyInfoService.upsert(dto, userId);
  }
}
