import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CallAnalysisService } from './call-analysis.service';
import {
  GetCallsQueryDto,
  PaginatedCallsResponseDto,
  CallResponseDto, // Import CallResponseDto for single call response
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
}
