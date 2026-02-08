import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIService } from '../openai/openai.service';
import { NvidiaService } from '../nvidia/nvidia.service';
import { WhisperService } from './whisper.service';
import { LLMConfigService } from '../prompt-management/llm-config.service';
import { PromptManagementService } from '../prompt-management/prompt-management.service';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private readonly useLocalWhisper: boolean;
  private readonly skipRefinement: boolean;
  private readonly llmProvider: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly openaiService: OpenAIService,
    private readonly nvidiaService: NvidiaService,
    private readonly whisperService: WhisperService,
    private readonly llmConfigService: LLMConfigService,
    private readonly promptService: PromptManagementService,
  ) {
    // Use self-hosted Whisper by default, fallback to OpenAI if WHISPER_API_URL is not set
    this.useLocalWhisper = this.configService.get<string>('TRANSCRIPTION_PROVIDER', 'whisper') === 'whisper';
    // Skip refinement step to save costs - raw transcript goes directly to analysis
    this.skipRefinement = this.configService.get<string>('SKIP_TRANSCRIPT_REFINEMENT', 'false') === 'true';
    // LLM provider for refinement (nvidia = free Kimi-k2.5, openai = GPT-4o)
    this.llmProvider = this.configService.get<string>('LLM_PROVIDER', 'openai');
    this.logger.log(`Transcription provider: ${this.useLocalWhisper ? 'Self-hosted Whisper' : 'OpenAI'}, Refinement: ${this.skipRefinement ? 'disabled' : `enabled (${this.llmProvider})`}`);
  }

  async transcribeAudio(
    base64: string,
    mimeType?: string,
    modelName?: string,
  ): Promise<string> {
    try {
      // Fetch active LLM config for transcription from database
      const transcriptionConfig = await this.llmConfigService.findActiveByUseCase('TRANSCRIPTION');
      const effectiveModelName = transcriptionConfig?.modelName || modelName || 'whisper-1';
      
      this.logger.log(
        `Starting transcription with provider: ${this.useLocalWhisper ? 'Whisper' : 'OpenAI'}. ` +
        `Model: ${effectiveModelName}. MimeType: ${mimeType || 'not provided'}`,
      );

      // Convert base64 to buffer
      const audioBuffer = Buffer.from(base64, 'base64');

      let rawTranscript: string;

      if (this.useLocalWhisper) {
        // Use self-hosted Whisper
        const result = await this.whisperService.transcribeAudio(audioBuffer, {
          language: 'en',
          task: 'transcribe',
          output: 'json',
          vadFilter: true,
        });
        rawTranscript = result.text;
      } else {
        // Use OpenAI Whisper
        const audioFile = new File([audioBuffer], 'audio.wav', {
          type: mimeType || 'audio/wav',
        });

        const transcription = await this.openaiService.transcribeAudio(
          audioFile,
          effectiveModelName,
        );
        rawTranscript = transcription.text;
      }

      this.logger.log('Raw transcription successful.');

      // Skip refinement if configured - send raw transcript directly to analysis
      if (this.skipRefinement) {
        this.logger.log('Skipping transcript refinement (SKIP_TRANSCRIPT_REFINEMENT=true)');
        return rawTranscript;
      }

      this.logger.log('Refining transcript...');

      // Fetch active prompt and LLM config for transcript refinement
      const refinementPrompt = await this.promptService.findActiveByUseCase('TRANSCRIPTION_REFINEMENT');
      const refinementConfig = await this.llmConfigService.findActiveByUseCase('TRANSCRIPTION_REFINEMENT');
      
      const systemPrompt = refinementPrompt?.content || 
        'You are a helpful assistant that refines raw speech-to-text transcripts. Your goal is to make the transcript more readable by correcting grammar, punctuation, and sentence structure. If possible, identify different speakers and format the transcript accordingly (e.g., Speaker 1:, Speaker 2:). Do not summarize or change the meaning of the content. Output only the refined transcript text.';
      const refinementModelName = refinementConfig?.modelName || 'gpt-4o';
      const settings = (refinementConfig?.settings as any) || { temperature: 0.2 };

      let refinedTranscript: string;

      // Route refinement through configured LLM provider
      if (this.llmProvider === 'nvidia' && this.nvidiaService.isAvailable()) {
        this.logger.log('Refining transcript via NVIDIA (Kimi-k2.5)...');
        const completion = await this.nvidiaService.createChatCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Please refine the following transcript:\n\n${rawTranscript}` },
          ],
          {
            temperature: settings.temperature ?? 0.2,
            maxTokens: settings.max_tokens ?? 4096,
            topP: settings.top_p ?? 1,
          },
        );
        refinedTranscript = completion.choices[0]?.message?.content?.trim() || rawTranscript;
      } else {
        this.logger.log(`Refining transcript via OpenAI (${refinementModelName})...`);
        refinedTranscript = await this.openaiService.refineTranscript(
          rawTranscript,
          refinementModelName,
          systemPrompt,
          settings,
        );
      }

      this.logger.log(`Transcript refinement successful (provider: ${this.llmProvider}).`);
      return refinedTranscript;
    } catch (error) {
      this.logger.error(
        `Error during transcription: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to transcribe audio');
    }
  }

  /**
   * Transcribe audio without refinement (raw output)
   */
  async transcribeAudioRaw(
    base64: string,
    mimeType?: string,
  ): Promise<{ text: string; segments?: any[]; language?: string }> {
    try {
      const audioBuffer = Buffer.from(base64, 'base64');

      if (this.useLocalWhisper) {
        return await this.whisperService.transcribeAudio(audioBuffer, {
          language: 'en',
          task: 'transcribe',
          output: 'json',
          vadFilter: true,
        });
      } else {
        const audioFile = new File([audioBuffer], 'audio.wav', {
          type: mimeType || 'audio/wav',
        });
        const result = await this.openaiService.transcribeAudio(audioFile);
        // Cast to any to access verbose_json properties (segments, language)
        const verboseResult = result as any;
        return {
          text: result.text,
          segments: verboseResult.segments,
          language: verboseResult.language,
        };
      }
    } catch (error) {
      this.logger.error(`Error during raw transcription: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to transcribe audio');
    }
  }
}
