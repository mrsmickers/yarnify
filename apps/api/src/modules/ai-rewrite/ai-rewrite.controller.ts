import {
  Controller,
  Post,
  Body,
  UseGuards,
  Logger,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { AiRewriteService } from './ai-rewrite.service';
import {
  RewriteTextBodyDto,
  RewriteTextBodySchema,
  RewriteTextResponse,
} from './dto/ai-rewrite.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(AuthGuard('jwt'))
export class AiRewriteController {
  private readonly logger = new Logger(AiRewriteController.name);

  constructor(private readonly aiRewriteService: AiRewriteService) {}

  @Post('rewrite')
  @ApiOperation({ summary: 'Rewrite text using AI in a specified style' })
  @ApiResponse({ status: 200, description: 'Returns rewritten text' })
  async rewriteText(
    @Body(new ZodValidationPipe(RewriteTextBodySchema)) body: RewriteTextBodyDto,
    @Request() req: any,
  ): Promise<RewriteTextResponse> {
    const userEmail = req.user?.email;
    this.logger.log(`User ${userEmail} requesting text rewrite in "${body.style}" style`);

    const rewrittenText = await this.aiRewriteService.rewriteText(
      body.text,
      body.style,
    );

    return {
      originalText: body.text,
      rewrittenText,
      style: body.style,
    };
  }
}
