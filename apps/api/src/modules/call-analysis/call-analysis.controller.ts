import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Param,
  NotFoundException,
  UseGuards,
  Post, // Added Post
  HttpCode, // Added HttpCode
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CallAnalysisService } from './call-analysis.service';
import {
  GetCallsQueryDto,
  PaginatedCallsResponseDto,
  CallResponseDto, // Import CallResponseDto for single call response
  CompanyListItemDto, // Added
  AgentListItemDto, // Added
} from './dto/get-calls.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@ApiTags('Call Analysis')
@Controller('call-analysis')
export class CallAnalysisController {
  constructor(private readonly callAnalysisService: CallAnalysisService) {}

  @Get('calls')
  @ApiOperation({
    summary: 'Get a paginated list of calls with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved calls.',
    type: PaginatedCallsResponseDto,
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getCalls(
    @Query() query: GetCallsQueryDto,
  ): Promise<PaginatedCallsResponseDto> {
    return this.callAnalysisService.getCalls(query);
  }

  @Get('calls/:id')
  @ApiOperation({ summary: 'Get a single call by ID' })
  @ApiParam({
    name: 'id',
    description: 'The ID of the call to retrieve',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved call.',
    type: CallResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Call not found.' })
  async getCallById(@Param('id') id: string): Promise<CallResponseDto> {
    const call = await this.callAnalysisService.getCallById(id);
    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }
    return call;
  }

  @Post('calls/:id/reprocess')
  @HttpCode(202) // Accepted
  @ApiOperation({ summary: 'Queue a call for reprocessing' })
  @ApiParam({
    name: 'id',
    description: 'The ID of the call to reprocess',
    type: String,
  })
  @ApiResponse({
    status: 202,
    description: 'Call has been queued for reprocessing.',
  })
  @ApiResponse({ status: 404, description: 'Call not found.' })
  async reprocessCall(@Param('id') id: string): Promise<{ message: string }> {
    return this.callAnalysisService.reprocessCall(id);
  }

  @Get('companies-list')
  @ApiOperation({ summary: 'Get a list of all companies for filter dropdown' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved company list.',
    type: [CompanyListItemDto],
  })
  async getCompanyList(): Promise<CompanyListItemDto[]> {
    return this.callAnalysisService.getCompanyList();
  }

  @Get('agents-list')
  @ApiOperation({ summary: 'Get a list of all agents for filter dropdown' })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved agent list.',
    type: [AgentListItemDto],
  })
  async getAgentList(): Promise<AgentListItemDto[]> {
    return this.callAnalysisService.getAgentList();
  }
}
