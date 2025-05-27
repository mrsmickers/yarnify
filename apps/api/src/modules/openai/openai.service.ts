import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private readonly openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'OPENAI_API_KEY is not set. OpenAI services will likely fail.',
      );
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Get the OpenAI client instance
   */
  getClient(): OpenAI {
    return this.openai;
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  async transcribeAudio(
    audioFile: File,
    model = 'whisper-1',
    options?: Partial<OpenAI.Audio.TranscriptionCreateParams>,
  ): Promise<OpenAI.Audio.Transcription> {
    this.logger.log(`Starting transcription with model: ${model}`);

    try {
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model,
        ...options, // Spread options first
        response_format: 'verbose_json', // Ensure verbose_json for timestamps
        timestamp_granularities: ['segment'], // Ensure segment-level timestamps
        stream: false, // Explicitly set stream to false for non-streaming
      });

      this.logger.log(
        `Transcription completed. Segments: ${
          transcription.segments?.length || 0
        }`,
      );

      return transcription;
    } catch (error) {
      this.logger.error(
        `Error during transcription: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Create embeddings using OpenAI
   */
  async createEmbeddings(
    input: string | string[],
    model = 'text-embedding-3-small',
    options?: Partial<OpenAI.EmbeddingCreateParams>,
  ): Promise<OpenAI.Embedding[]> {
    this.logger.log(`Creating embeddings with model: ${model}`);

    try {
      const response = await this.openai.embeddings.create({
        input,
        model,
        ...options,
      });

      this.logger.log(`Created ${response.data.length} embeddings`);
      return response.data;
    } catch (error) {
      this.logger.error(
        `Error creating embeddings: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Generate chat completion using OpenAI
   */
  async createChatCompletion(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
    model = 'gpt-4o-mini',
    options?: Partial<OpenAI.Chat.ChatCompletionCreateParams>,
  ): Promise<OpenAI.Chat.ChatCompletion> {
    this.logger.log(`Creating chat completion with model: ${model}`);

    try {
      const completion = await this.openai.chat.completions.create({
        messages,
        model,
        stream: false, // Ensure we are not streaming for this method signature
        ...options,
      });

      this.logger.log('Chat completion created successfully');
      return completion as OpenAI.Chat.ChatCompletion; // Added type assertion
    } catch (error) {
      this.logger.error(
        `Error creating chat completion: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
