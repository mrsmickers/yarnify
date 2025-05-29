import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { OpenAIService } from '../openai/openai.service';

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(private readonly openaiService: OpenAIService) {}

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
      // Convert base64 to buffer for OpenAI API
      const audioBuffer = Buffer.from(base64, 'base64');

      // Create a File-like object from the buffer
      const audioFile = new File([audioBuffer], 'audio.wav', {
        type: mimeType || 'audio/wav',
      });

      const transcription = await this.openaiService.transcribeAudio(
        audioFile,
        modelName,
      );

      this.logger.log('Raw transcription successful. Refining transcript...');
      const rawTranscript = transcription.text;

      // Refine the transcript using the new method
      const refinedTranscript = await this.openaiService.refineTranscript(
        rawTranscript,
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
