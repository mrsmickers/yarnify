import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';
import { LLMConfigService } from '../prompt-management/llm-config.service';
import { PromptManagementService } from '../prompt-management/prompt-management.service';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly openaiService: OpenAIService,
    private readonly llmConfigService: LLMConfigService,
    private readonly promptService: PromptManagementService,
  ) {}

  async transcribeAudio(
    base64: string,
    mimeType?: string, // MimeType might be useful for some transcription models/APIs
    modelName?: string,
  ): Promise<string> {
    try {
      // Fetch active LLM config for transcription from database
      const transcriptionConfig = await this.llmConfigService.findActiveByUseCase('TRANSCRIPTION');
      const effectiveModelName = transcriptionConfig?.modelName || modelName || 'whisper-1';
      
      this.logger.log(
        `Starting transcription with model: ${effectiveModelName}. MimeType: ${
          mimeType || 'not provided'
        }`,
      );

      // Convert base64 to buffer for OpenAI API
      const audioBuffer = Buffer.from(base64, 'base64');

      // Create a File-like object from the buffer
      const audioFile = new File([audioBuffer], 'audio.wav', {
        type: mimeType || 'audio/wav',
      });

      const transcription = await this.openaiService.transcribeAudio(
        audioFile,
        effectiveModelName,
      );

      this.logger.log('Raw transcription successful. Refining transcript...');
      const rawTranscript = transcription.text;

      // Fetch active prompt and LLM config for transcript refinement
      const refinementPrompt = await this.promptService.findActiveByUseCase('TRANSCRIPTION_REFINEMENT');
      const refinementConfig = await this.llmConfigService.findActiveByUseCase('TRANSCRIPTION_REFINEMENT');
      
      const systemPrompt = refinementPrompt?.content || 
        'You are a helpful assistant that refines raw speech-to-text transcripts. Your goal is to make the transcript more readable by correcting grammar, punctuation, and sentence structure. If possible, identify different speakers and format the transcript accordingly (e.g., Speaker 1:, Speaker 2:). Do not summarize or change the meaning of the content. Output only the refined transcript text.';
      const refinementModelName = refinementConfig?.modelName || 'gpt-4o';
      const settings = (refinementConfig?.settings as any) || { temperature: 0.2 };

      // Refine the transcript using database config
      const refinedTranscript = await this.openaiService.refineTranscript(
        rawTranscript,
        refinementModelName,
        systemPrompt,
        settings,
      );

      this.logger.log('Transcript refinement successful.');
      return refinedTranscript;
    } catch (error) {
      this.logger.error(
        `Error during transcription: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to transcribe audio');
    }
  }
}
