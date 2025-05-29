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
        language: 'en', // Default to English, can be overridden in options
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

  /**
   * Refine a transcript using OpenAI GPT-4o for better readability.
   */
  async refineTranscript(
    rawTranscript: string,
    model = 'gpt-4o', // Use gpt-4o for refinement
    options?: Partial<OpenAI.Chat.ChatCompletionCreateParams>,
  ): Promise<string> {
    this.logger.log(`Refining transcript with model: ${model}`);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content:
          'You are a helpful assistant that refines raw speech-to-text transcripts. Your goal is to make the transcript more readable by correcting grammar, punctuation, and sentence structure. If possible, identify different speakers and format the transcript accordingly (e.g., Speaker 1:, Speaker 2:). Do not summarize or change the meaning of the content. Output only the refined transcript text.',
      },
      {
        role: 'user',
        content: `Please refine the following transcript:\n\n${rawTranscript}`,
      },
    ];

    try {
      const completion = await this.createChatCompletion(messages, model, {
        temperature: 0.2, // Lower temperature for more deterministic output
        ...options,
      });

      const refinedText = completion.choices[0]?.message?.content?.trim();

      if (!refinedText) {
        this.logger.warn('Transcript refinement resulted in empty text.');
        // Fallback to raw transcript if refinement fails or returns empty
        return rawTranscript;
      }

      this.logger.log('Transcript refined successfully.');
      return refinedText;
    } catch (error) {
      this.logger.error(
        `Error during transcript refinement: ${error.message}`,
        error.stack,
      );
      // Fallback to raw transcript in case of error
      this.logger.warn(
        'Falling back to raw transcript due to refinement error.',
      );
      return rawTranscript;
    }
  }
}
