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

  /**
   * Transcribe audio and optionally refine the transcript.
   * Returns { text, metadata } with LLM provider/model info for each step.
   */
  async transcribeAudio(
    base64: string,
    mimeType?: string,
    modelName?: string,
  ): Promise<{ text: string; metadata: { transcriptionProvider: string; transcriptionModel: string; refinementProvider: string | null; refinementModel: string | null } }> {
    const metadata = {
      transcriptionProvider: this.useLocalWhisper ? 'self-hosted-whisper' : 'openai',
      transcriptionModel: '',
      refinementProvider: null as string | null,
      refinementModel: null as string | null,
    };

    try {
      // Fetch active LLM config for transcription from database
      const transcriptionConfig = await this.llmConfigService.findActiveByUseCase('TRANSCRIPTION');
      const effectiveModelName = transcriptionConfig?.modelName || modelName || 'whisper-1';
      metadata.transcriptionModel = effectiveModelName;
      
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
        return { text: rawTranscript, metadata };
      }

      this.logger.log('Refining transcript...');

      // Fetch active prompt and LLM config for transcript refinement
      const refinementPrompt = await this.promptService.findActiveByUseCase('TRANSCRIPTION_REFINEMENT');
      const refinementConfig = await this.llmConfigService.findActiveByUseCase('TRANSCRIPTION_REFINEMENT');
      
      const systemPrompt = refinementPrompt?.content || 
        `You are a transcript formatter for an IT managed services provider (MSP) called Ingenio Technologies.

Your task: take a raw speech-to-text transcript and format it with clear speaker separation and clean text.

RULES:
1. ALWAYS separate speakers onto their own lines using this format:
   **Speaker Name:** Their dialogue here.

2. Speaker identification:
   - If a speaker introduces themselves by name (e.g. "Hi, it's Joel from Ingenio"), use their name: **Joel:**
   - If you can identify the company name, label the external party: **Ben (Postage People):** or **Customer:**
   - For automated messages/IVR: **Automated Message:**
   - If you cannot identify a speaker, use **Speaker 1:**, **Speaker 2:** etc.
   - The Ingenio agent is usually the one who says "calling from Ingenio" or answers with "Ingenio Technologies"

3. Text cleanup:
   - Fix obvious speech-to-text errors and misspellings
   - Add proper punctuation and capitalisation
   - Remove filler words (um, uh, er) unless they convey meaning
   - Keep all technical terms, names, and numbers exactly as spoken

4. NEVER summarise, skip content, or change the meaning
5. NEVER add commentary or notes — output ONLY the formatted transcript
6. Every line of dialogue MUST start with a speaker label in bold markdown format`;
      const refinementModelName = refinementConfig?.modelName || 'gpt-5-mini';
      const settings = (refinementConfig?.settings as any) || { temperature: 0.2 };

      let refinedTranscript: string;

      // Route refinement through configured LLM provider
      // Use kimi-k2-instruct (fast) for refinement, not the thinking model
      const refinementNvidiaModel = this.configService.get<string>('NVIDIA_REFINEMENT_MODEL', 'moonshotai/kimi-k2-instruct');
      if (this.llmProvider === 'nvidia' && this.nvidiaService.isAvailable()) {
        this.logger.log(`Refining transcript via NVIDIA (${refinementNvidiaModel})...`);
        metadata.refinementProvider = 'nvidia';
        metadata.refinementModel = refinementNvidiaModel;
        const completion = await this.nvidiaService.createChatCompletion(
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Format and clean up this raw transcript. Remember: EVERY line of dialogue must have a speaker label.\n\n${rawTranscript}` },
          ],
          {
            temperature: settings.temperature ?? 0.1,
            maxTokens: settings.max_tokens ?? 8192,
            topP: settings.top_p ?? 1,
          },
          refinementNvidiaModel, // Override the default model
        );
        refinedTranscript = completion.choices[0]?.message?.content?.trim() || rawTranscript;
      } else {
        this.logger.log(`Refining transcript via OpenAI (${refinementModelName})...`);
        metadata.refinementProvider = 'openai';
        metadata.refinementModel = refinementModelName;
        refinedTranscript = await this.openaiService.refineTranscript(
          rawTranscript,
          refinementModelName,
          systemPrompt,
          settings,
        );
      }

      this.logger.log(`Transcript refinement successful (provider: ${this.llmProvider}).`);
      return { text: refinedTranscript, metadata };
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
