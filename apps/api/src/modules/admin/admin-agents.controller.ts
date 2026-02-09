import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtOrStagingGuard } from '../../common/guards/jwt-or-staging.guard';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminAgentsService } from './admin-agents.service';
import { AgentAutoMatchService } from './agent-auto-match.service';
import { UpdateAgentDto, CreateAgentDto } from './dto/agent.dto';
import { ZodValidationPipe } from 'nestjs-zod';

@ApiTags('admin-agents')
@Controller('admin/agents')
@UseGuards(JwtOrStagingGuard, RolesGuard)
@Roles('admin')
export class AdminAgentsController {
  private readonly logger = new Logger(AdminAgentsController.name);

  constructor(
    private readonly adminAgentsService: AdminAgentsService,
    private readonly agentAutoMatchService: AgentAutoMatchService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all agents (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all agents with their linked users and call counts',
  })
  async getAllAgents() {
    return this.adminAgentsService.getAllAgents();
  }

  @Get('sync')
  @ApiOperation({ summary: 'Sync agents from VoIP system (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Syncs all extensions from VoIP and creates/updates agents',
  })
  async syncAgents() {
    this.logger.log('Triggering agent sync from VoIP system');
    return this.adminAgentsService.syncAgentsFromVoIP();
  }

  @Post('auto-match')
  @ApiOperation({ summary: 'Bulk auto-match unlinked agents to users by email/name (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns the number of agents matched and list of unmatched agent names',
  })
  async bulkAutoMatch() {
    this.logger.log('Triggering bulk agent-user auto-match');
    return this.agentAutoMatchService.bulkAutoMatch();
  }

  @Get('link-calls')
  @ApiOperation({ summary: 'Link existing calls to agents by extension (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Updates calls to link them to agents by matching extension numbers',
  })
  async linkCallsToAgents() {
    this.logger.log('Triggering call-to-agent linking process');
    return this.adminAgentsService.linkCallsToAgents();
  }

  @Get('propagate-agents')
  @ApiOperation({ summary: 'Propagate agent attribution from queue legs to primary calls (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'For grouped calls, copies agent from queue→phone leg to external→number leg',
  })
  async propagateAgentsFromQueueLegs() {
    this.logger.log('Triggering agent propagation from queue legs');
    return this.adminAgentsService.propagateAgentsFromQueueLegs();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get agent statistics including call counts (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns statistics about agents and their calls',
  })
  async getAgentStats() {
    this.logger.log('Fetching agent statistics');
    return this.adminAgentsService.getAgentStats();
  }

  @Get('debug/:extension')
  @ApiOperation({ summary: 'Debug agent calls by extension (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all calls for a specific agent extension',
  })
  async debugAgentCalls(@Param('extension') extension: string) {
    this.logger.log(`Debugging calls for extension ${extension}`);
    return this.adminAgentsService.debugAgentCalls(extension);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get agent by ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns agent details',
  })
  async getAgent(@Param('id') id: string) {
    return this.adminAgentsService.getAgent(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new agent manually (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Agent created successfully',
  })
  async createAgent(
    @Body(new ZodValidationPipe(CreateAgentDto.schema)) body: CreateAgentDto,
  ) {
    this.logger.log(`Creating agent: ${body.name}`);
    return this.adminAgentsService.createAgent(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an agent (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Agent updated successfully',
  })
  async updateAgent(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAgentDto.schema)) body: UpdateAgentDto,
  ) {
    this.logger.log(`Updating agent ${id}`);
    return this.adminAgentsService.updateAgent(id, body);
  }
}

