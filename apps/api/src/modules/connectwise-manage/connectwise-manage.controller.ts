import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Logger,
  ForbiddenException,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { ConnectwiseManageService } from './connectwise-manage.service';
import {
  SearchTicketsQueryDto,
  SearchTicketsQuerySchema,
  AddTicketNoteBodyDto,
  AddTicketNoteBodySchema,
  CWTicket,
  AddTicketNoteResponse,
} from './dto/connectwise-tickets.dto';
import { PermissionsService } from '../permissions/permissions.service';
import { AuditService } from '../audit/audit.service';

@ApiTags('ConnectWise')
@ApiBearerAuth()
@Controller('connectwise')
@UseGuards(AuthGuard('jwt'))
export class ConnectwiseManageController {
  private readonly logger = new Logger(ConnectwiseManageController.name);

  constructor(
    private readonly cwService: ConnectwiseManageService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Check if user has connectwise.push permission
   */
  private async checkPushPermission(req: any): Promise<void> {
    const userId = req.user?.userId || req.user?.sub;
    const hasPermission = await this.permissionsService.hasPermission(userId, 'connectwise.push');
    if (!hasPermission) {
      throw new ForbiddenException('You do not have permission to push notes to ConnectWise');
    }
  }

  @Get('tickets')
  @ApiOperation({ summary: 'Search ConnectWise tickets' })
  @ApiResponse({ status: 200, description: 'Returns list of matching tickets' })
  async searchTickets(
    @Query(new ZodValidationPipe(SearchTicketsQuerySchema)) query: SearchTicketsQueryDto,
    @Request() req: any,
  ): Promise<CWTicket[]> {
    await this.checkPushPermission(req);

    this.logger.log(`Searching tickets: ${JSON.stringify(query)}`);

    // Parse the date if provided
    const dateFrom = query.date ? new Date(query.date) : undefined;
    const dateTo = query.date 
      ? new Date(new Date(query.date).getTime() + 24 * 60 * 60 * 1000) // Add 1 day
      : undefined;

    return this.cwService.searchTickets({
      companyName: query.companyName,
      companyId: query.companyId,
      dateFrom,
      dateTo,
      summary: query.summary,
      limit: query.limit,
    });
  }

  @Get('tickets/:ticketId')
  @ApiOperation({ summary: 'Get a specific ConnectWise ticket' })
  @ApiResponse({ status: 200, description: 'Returns the ticket details' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicket(
    @Param('ticketId') ticketId: string,
    @Request() req: any,
  ): Promise<CWTicket> {
    await this.checkPushPermission(req);
    return this.cwService.getTicket(parseInt(ticketId, 10));
  }

  @Post('tickets/:ticketId/notes')
  @ApiOperation({ summary: 'Add a note to a ConnectWise ticket' })
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async addTicketNote(
    @Param('ticketId') ticketId: string,
    @Body(new ZodValidationPipe(AddTicketNoteBodySchema)) body: AddTicketNoteBodyDto,
    @Request() req: any,
  ): Promise<AddTicketNoteResponse> {
    await this.checkPushPermission(req);

    const ticketIdNum = parseInt(ticketId, 10);
    const userId = req.user?.userId || req.user?.sub;
    const userEmail = req.user?.email;

    this.logger.log(`User ${userEmail} adding note to ticket ${ticketIdNum}`);

    const note = await this.cwService.addTicketNote(
      ticketIdNum,
      body.text,
      body.internalOnly,
    );

    // Audit log the action
    this.auditService.log({
      actorId: userId,
      actorEmail: userEmail,
      action: 'connectwise.note.added',
      targetType: 'ticket',
      targetId: ticketId,
      metadata: {
        noteId: note.id,
        internalOnly: body.internalOnly,
        textLength: body.text.length,
      },
    }).catch(() => {}); // Fire-and-forget

    return {
      success: true,
      noteId: note.id,
      ticketId: ticketIdNum,
    };
  }
}
