import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import FormData from 'form-data';

export interface WhisperTranscription {
  text: string;
  segments?: Array<{
    id: number;
    seek: number;
    start: number;
    end: number;
    text: string;
    tokens: number[];
    temperature: number;
    avg_logprob: number;
    compression_ratio: number;
    no_speech_prob: number;
  }>;
  language?: string;
}

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);
  private readonly whisperUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Default to internal Docker network name, fallback to localhost for dev
    this.whisperUrl = this.configService.get<string>(
      'WHISPER_API_URL',
      'http://whisper-asr:9000',
    );
    this.logger.log(`Whisper API URL configured: ${this.whisperUrl}`);
  }

  /**
   * Transcribe audio using self-hosted Whisper ASR service
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    options?: {
      language?: string;
      task?: 'transcribe' | 'translate';
      output?: 'text' | 'json' | 'vtt' | 'srt' | 'tsv';
      vadFilter?: boolean;
      wordTimestamps?: boolean;
    },
  ): Promise<WhisperTranscription> {
    const {
      language = 'en',
      task = 'transcribe',
      output = 'json',
      vadFilter = true,
      wordTimestamps = false,
    } = options || {};

    this.logger.log(
      `Starting Whisper transcription. Language: ${language}, Task: ${task}, VAD: ${vadFilter}`,
    );

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });

      const queryParams = new URLSearchParams({
        output,
        task,
        language,
        vad_filter: vadFilter.toString(),
        word_timestamps: wordTimestamps.toString(),
        encode: 'true',
      });

      const url = `${this.whisperUrl}/asr?${queryParams.toString()}`;
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Whisper API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();

      this.logger.log(
        `Transcription completed. Segments: ${result.segments?.length || 0}, Language: ${result.language || 'unknown'}`,
      );

      return {
        text: result.text,
        segments: result.segments,
        language: result.language,
      };
    } catch (error) {
      this.logger.error(
        `Error during Whisper transcription: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Detect the language of an audio file
   */
  async detectLanguage(
    audioBuffer: Buffer,
  ): Promise<{ detected_language: string; language_code: string; confidence: number }> {
    this.logger.log('Detecting language...');

    try {
      const formData = new FormData();
      formData.append('audio_file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
      });

      const response = await fetch(`${this.whisperUrl}/detect-language`, {
        method: 'POST',
        body: formData as any,
        headers: formData.getHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Whisper API error: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      const result = await response.json();
      this.logger.log(
        `Language detected: ${result.detected_language} (${result.language_code}) with confidence ${result.confidence}`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error detecting language: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Check if the Whisper service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.whisperUrl}/`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
