import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AgentRepository } from '../call-analysis/repositories/agent.repository';
import { CallRecordingService } from '../voip/call-recording.service';
import { CallAnalysisService } from '../call-analysis/call-analysis.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import {
  GetAgentsResponse,
  UpdateAgent,
  CreateAgent,
  SyncAgentsResponse,
} from './dto/agent.dto';

@Injectable()
export class AdminAgentsService {
  private readonly logger = new Logger(AdminAgentsService.name);
  private readonly voipBaseUrl: string;
  private readonly voipUsername: string;
  private readonly voipPassword: string;

  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly callRecordingService: CallRecordingService,
    private readonly callAnalysisService: CallAnalysisService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.voipBaseUrl =
      this.configService.get<string>('VOIP_BASE_URL') ||
      'https://pbx.newtechaccess.com.au';
    this.voipUsername = this.configService.get<string>('VOIP_USERNAME');
    this.voipPassword = this.configService.get<string>('VOIP_PASSWORD');
  }

  async getAllAgents(): Promise<GetAgentsResponse> {
    const agents = await this.agentRepository.findAllWithRelations();
    return {
      agents: agents as any,
      total: agents.length,
    };
  }

  async getAgent(id: string) {
    const agent = await this.agentRepository.findByIdWithRelations(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }
    return { agent };
  }

  async createAgent(data: CreateAgent) {
    const agent = await this.agentRepository.create({
      name: data.name,
      email: data.email || null,
      extension: data.extension || null,
      entraUser: data.entraUserId
        ? { connect: { id: data.entraUserId } }
        : undefined,
    });

    this.logger.log(`Created agent: ${agent.name} (${agent.id})`);
    return { agent };
  }

  async updateAgent(id: string, data: UpdateAgent) {
    const agent = await this.agentRepository.findById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with ID ${id} not found`);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.extension !== undefined) updateData.extension = data.extension;

    // Handle entraUser connection
    if (data.entraUserId !== undefined) {
      if (data.entraUserId === null) {
        updateData.entraUser = { disconnect: true };
      } else {
        updateData.entraUser = { connect: { id: data.entraUserId } };
      }
    }

    const updatedAgent = await this.agentRepository.update(id, updateData);
    this.logger.log(`Updated agent: ${updatedAgent.name} (${updatedAgent.id})`);

    return { agent: updatedAgent };
  }

  /**
   * Sync agents from VoIP system
   * Fetches all extensions from VoIP and creates/updates agents
   */
  async syncAgentsFromVoIP(): Promise<SyncAgentsResponse> {
    this.logger.log('Starting agent sync from VoIP system...');

    try {
      // Fetch all extensions from VoIP
      const extensions = await this.fetchAllExtensions();
      this.logger.log(`Found ${extensions.length} extensions in VoIP system`);

      // Log first few extensions to see structure
      if (extensions.length > 0) {
        this.logger.log(
          `Sample extension data (first 3):`,
          JSON.stringify(
            extensions.slice(0, 3).map((ext) => ({
              name: ext.name,
              callername_internal: ext.callername_internal,
              display: ext.display,
              missedemail: ext.missedemail,
            })),
            null,
            2,
          ),
        );
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const ext of extensions) {
        const extension = ext.name;
        const name = ext.callername_internal || ext.display || ext.name;
        const email = ext.missedemail || null;

        this.logger.debug(
          `Processing extension ${extension}: name="${name}", email="${email}"`,
        );

        if (!extension || !name) {
          this.logger.warn(
            `Skipping extension with missing data: extension="${extension}", name="${name}"`,
          );
          skipped++;
          continue;
        }

        try {
          const existingAgent =
            await this.agentRepository.findByExtension(extension);

          if (existingAgent) {
            // Update existing agent
            await this.agentRepository.update(existingAgent.id, {
              name,
              email,
            });
            updated++;
            this.logger.log(`Updated agent: ${name} (${extension})`);
          } else {
            // Create new agent
            await this.agentRepository.create({
              name,
              extension,
              email,
            });
            created++;
            this.logger.log(`Created agent: ${name} (${extension})`);
          }
        } catch (error) {
          this.logger.error(
            `Error processing extension ${extension} (${name}):`,
            error.message,
            error.stack,
          );
          skipped++;
        }
      }

      const agents = await this.agentRepository.findAllWithRelations();

      this.logger.log(
        `Agent sync complete: ${created} created, ${updated} updated, ${skipped} skipped, ${agents.length} total agents in database`,
      );

      return {
        created,
        updated,
        total: agents.length,
        agents: agents as any,
      };
    } catch (error) {
      this.logger.error('Error syncing agents from VoIP:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Fetch all extensions from VoIP system
   */
  private async fetchAllExtensions(): Promise<any[]> {
    const customerId = this.configService.get<string>('VOIP_CUSTOMER_ID');
    const url = `${this.voipBaseUrl}/api/json/phones/list?auth_username=${this.voipUsername}&auth_password=***&customer=${customerId}`;
    
    this.logger.log(`Fetching extensions from: ${url.replace(/auth_password=[^&]*/, 'auth_password=***')}`);

    try {
      const actualUrl = `${this.voipBaseUrl}/api/json/phones/list?auth_username=${this.voipUsername}&auth_password=${this.voipPassword}&customer=${customerId}`;
      const { data, status } = await firstValueFrom(this.httpService.get(actualUrl));
      
      this.logger.log(`VoIP API responded with status ${status}`);
      this.logger.log(`Response structure: ${JSON.stringify({ 
        hasData: !!data, 
        hasDataArray: !!data?.data, 
        dataLength: data?.data?.length || 0 
      })}`);
      
      const extensions = data.data || [];
      
      if (extensions.length === 0) {
        this.logger.warn('VoIP API returned zero extensions. This might indicate an API issue or empty customer.');
      }
      
      return extensions;
    } catch (error) {
      this.logger.error(
        'Error fetching extensions from VoIP:',
        error.message,
        error.response?.status,
        error.response?.data,
      );
      throw error;
    }
  }

  /**
   * Link existing calls to agents by fetching call metadata from VoIP
   * and matching by extension
   */
  async linkCallsToAgents(): Promise<{
    linked: number;
    skipped: number;
    errors: number;
  }> {
    this.logger.log('Starting call-to-agent linking process...');

    let linked = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Get calls from the last 7 days without an agent link
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const calls = await this.prisma.call.findMany({
        where: {
          agentsId: null,
          startTime: {
            gte: sevenDaysAgo,
          },
          callStatus: {
            notIn: ['INTERNAL_CALL_SKIPPED', 'FAILED'],
          },
        },
        select: {
          id: true,
          callSid: true,
          startTime: true,
        },
        orderBy: {
          startTime: 'desc',
        },
        take: 200, // Increased limit
      });

      this.logger.log(`Found ${calls.length} calls from the last 7 days without agent links (status COMPLETED, limit 200)`);

      for (const call of calls) {
        try {
          // Try to fetch recording metadata - try multiple record IDs
          let data: any = null;
          
          for (const recordId of [2, 1, 3]) {
            const url = `${this.voipBaseUrl}/api/json/recording/recordings/get?auth_username=${this.voipUsername}&auth_password=${this.voipPassword}&recordgroup=4303&uniqueid=${call.callSid}&recordid=${recordId}`;
            
            try {
              const response = await firstValueFrom(this.httpService.get(url));
              if (response.data?.data) {
                data = response.data;
                this.logger.debug(`Found metadata for call ${call.callSid} with recordid=${recordId}`);
                break;
              }
            } catch (error) {
              // Try next record ID
              continue;
            }
          }
          
          if (!data?.data) {
            this.logger.warn(`No recording data found for call ${call.callSid} (tried recordid 2, 1, 3)`);
            skipped++;
            continue;
          }

          // Log the raw fields we're checking
          this.logger.log(`Call ${call.callSid} (${call.startTime.toISOString().split('T')[0]}): snumber="${data.data.snumber}", callerid_internal="${data.data.callerid_internal}", cnumber="${data.data.cnumber}", dnumber="${data.data.dnumber}"`);
          
          // Use the same extraction logic as call processing
          const extension = await this.callAnalysisService.extractInternalPhoneNumber(data.data);
          
          if (!extension) {
            this.logger.warn(`❌ Could not extract internal extension for call ${call.callSid}`);
            skipped++;
            continue;
          }
          
          this.logger.log(`✅ Extracted extension ${extension} for call ${call.callSid}`);
          
          // Find agent by extension
          const agent = await this.agentRepository.findByExtension(extension);
          
          if (!agent) {
            this.logger.warn(`No agent found with extension ${extension} for call ${call.callSid}`);
            skipped++;
            continue;
          }

          // Update call with agent link
          await this.prisma.call.update({
            where: { id: call.id },
            data: { agentsId: agent.id },
          });

          linked++;
          this.logger.log(`Linked call ${call.callSid} to agent ${agent.name} (${extension})`);
        } catch (error) {
          this.logger.error(`Error processing call ${call.callSid}:`, error.message);
          errors++;
        }
      }

      this.logger.log(
        `Call linking complete: ${linked} linked, ${skipped} skipped, ${errors} errors`,
      );

      return { linked, skipped, errors };
    } catch (error) {
      this.logger.error('Error during call-to-agent linking:', error.message, error.stack);
      throw error;
    }
  }

  /**
   * Get agent statistics including detailed call counts
   */
  async getAgentStats(): Promise<{
    totalAgents: number;
    agentsWithCalls: number;
    totalCalls: number;
    callsWithoutAgent: number;
    recentCallsSample: Array<{
      callSid: string;
      startTime: Date;
      hasAgent: boolean;
      agentName?: string;
    }>;
  }> {
    const agents = await this.prisma.agent.findMany({
      include: {
        _count: {
          select: {
            calls: true,
          },
        },
      },
    });

    const totalCalls = await this.prisma.call.count({
      where: {
        callStatus: {
          notIn: ['INTERNAL_CALL_SKIPPED'],
        },
      },
    });

    const callsWithoutAgent = await this.prisma.call.count({
      where: {
        agentsId: null,
        callStatus: {
          notIn: ['INTERNAL_CALL_SKIPPED'],
        },
      },
    });

    const recentCalls = await this.prisma.call.findMany({
      where: {
        callStatus: {
          notIn: ['INTERNAL_CALL_SKIPPED'],
        },
      },
      include: {
        Agents: {
          select: {
            name: true,
            extension: true,
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 10,
    });

    return {
      totalAgents: agents.length,
      agentsWithCalls: agents.filter((a) => a._count.calls > 0).length,
      totalCalls,
      callsWithoutAgent,
      recentCallsSample: recentCalls.map((call) => ({
        callSid: call.callSid,
        startTime: call.startTime,
        hasAgent: !!call.agentsId,
        agentName: call.Agents?.name,
      })),
    };
  }

  /**
   * Debug agent calls - shows all calls for a specific extension from database
   */
  async debugAgentCalls(extension: string): Promise<{
    agent: any;
    callsInDatabase: number;
    recentCalls: Array<{
      callSid: string;
      startTime: Date;
      duration: number;
      callStatus: string;
      hasRecording: boolean;
    }>;
  }> {
    // Find agent by extension
    const agent = await this.agentRepository.findByExtension(extension);
    
    if (!agent) {
      this.logger.warn(`No agent found with extension ${extension}`);
      return {
        agent: null,
        callsInDatabase: 0,
        recentCalls: [],
      };
    }

    // Get all calls for this agent
    const calls = await this.prisma.call.findMany({
      where: {
        agentsId: agent.id,
      },
      select: {
        callSid: true,
        startTime: true,
        endTime: true,
        callStatus: true,
        recordingUrl: true,
      },
      orderBy: {
        startTime: 'desc',
      },
      take: 20,
    });

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        extension: agent.extension,
      },
      callsInDatabase: calls.length,
      recentCalls: calls.map((call) => ({
        callSid: call.callSid,
        startTime: call.startTime,
        duration: call.endTime
          ? Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000)
          : 0,
        callStatus: call.callStatus,
        hasRecording: !!call.recordingUrl,
      })),
    };
  }
}

