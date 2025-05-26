import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { experimental_transcribe as transcribe } from 'ai';
import { openai } from '@ai-sdk/openai'; // Ensure OPENAI_API_KEY is set in .env

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'OPENAI_API_KEY is not set. Transcription will likely fail.',
      );
      // Depending on strictness, you might throw an error here
      // throw new InternalServerErrorException('OPENAI_API_KEY environment variable must be set');
    }
  }

  async transcribeAudio(
    base64: string,
    mimeType?: string, // MimeType might be useful for some transcription models/APIs
    modelName = 'whisper-1',
  ): Promise<string> {
    this.logger.log(
      `Starting transcription with model: ${modelName}. MimeType: ${
        mimeType || 'not provided'
      }`,
    );
    try {
      const { text } = await transcribe({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: openai.transcription(modelName as any),
        audio: base64,
        // TODO: Potentially use mimeType if the SDK/API supports it
        // For example, some APIs might take a `contentType` parameter.
        // OpenAI's API usually infers from common audio formats.
      });

      this.logger.log('Transcription successful.');
      return text;
    } catch (error) {
      this.logger.error(
        `Error during transcription: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to transcribe audio');
    }
  }
}
