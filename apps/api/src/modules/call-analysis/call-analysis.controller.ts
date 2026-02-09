import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
  Param,
  Req,
  NotFoundException,
  UseGuards,
  Post, // Added Post
  HttpCode, // Added HttpCode
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtOrStagingGuard } from '../../common/guards/jwt-or-staging.guard';
import { CallAnalysisService } from './call-analysis.service';
import { AuditService } from '../audit/audit.service';
import {
  GetCallsQueryDto,
  PaginatedCallsResponseDto,
  CallResponseDto, // Import CallResponseDto for single call response
  CompanyListItemDto, // Added
  AgentListItemDto, // Added
} from './dto/get-calls.dto';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/cls-store.interface';

@UseGuards(JwtOrStagingGuard)
@ApiTags('Call Analysis')
@Controller('call-analysis')
export class CallAnalysisController {
  constructor(
    private readonly callAnalysisService: CallAnalysisService,
    private readonly auditService: AuditService,
  ) {}

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
    @Req() req: Request,
    @Query() query: GetCallsQueryDto,
  ): Promise<PaginatedCallsResponseDto> {
    const payload = req.user as JwtPayload;
    
    // Build user context for role-based call scoping
    let userContext: { role: string; userId: string; department?: string | null } | undefined;
    if (payload?.oid) {
      // Look up the user's actual role and department from DB
      // (JWT roles array is for guard checks; we need the single role value for scoping)
      const storedUser = await this.callAnalysisService.getUserContext(payload.oid);
      if (storedUser) {
        userContext = {
          role: storedUser.role,
          userId: payload.oid,
          department: storedUser.department,
        };
      }
    }

    return this.callAnalysisService.getCalls(query, userContext);
  }

  @Get('calls/mine')
  @ApiOperation({
    summary: 'Get calls for the currently logged-in user (via linked agent)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated calls for the logged-in user\'s linked agent.',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getMyCalls(
    @Req() req: Request,
    @Query() query: GetCallsQueryDto,
  ) {
    const payload = req.user as JwtPayload;
    if (!payload?.oid) {
      return {
        data: [],
        total: 0,
        page: query.page || 1,
        limit: query.limit || 10,
        totalPages: 0,
        metrics: {
          totalPositiveSentiment: 0,
          totalNegativeSentiment: 0,
          totalNeutralSentiment: 0,
          averageConfidence: 0,
        },
        agentLinked: false,
      };
    }

    return this.callAnalysisService.getMyCalls(payload.oid, query);
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
  async getCallById(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<CallResponseDto> {
    const call = await this.callAnalysisService.getCallById(id);
    if (!call) {
      throw new NotFoundException(`Call with ID ${id} not found`);
    }

    // Audit log: call viewed
    const payload = req.user as JwtPayload | undefined;
    if (payload) {
      // Look up user ID from OID
      const userContext = payload.oid
        ? await this.callAnalysisService.getUserContext(payload.oid)
        : null;

      this.auditService.log({
        actorId: userContext?.entraUserId || undefined,
        actorEmail: payload.email,
        action: 'call.view',
        targetType: 'call',
        targetId: id,
        targetName: call.externalPhoneNumber || call.callSid,
        metadata: {
          callSid: call.callSid,
          direction: call.callDirection,
          externalPhoneNumber: call.externalPhoneNumber,
          agentName: call.agentName,
          companyId: call.companyId,
        },
      }).catch(() => {}); // Fire-and-forget
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
