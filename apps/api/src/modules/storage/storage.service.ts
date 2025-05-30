import {
  Injectable,
  Logger,
  StreamableFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  ContainerClient,
  BlobDownloadOptions, // Keep for potential future use, but not strictly needed for current reverted logic
} from '@azure/storage-blob';
import { Readable, PassThrough } from 'stream';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private blobServiceClient: BlobServiceClient;
  private containerClient: ContainerClient;
  private containerName: string;

  constructor(private configService: ConfigService) {
    const connectionString = this.configService.get<string>(
      'AZURE_STORAGE_CONNECTION_STRING',
    );
    this.containerName = this.configService.get<string>(
      'AZURE_STORAGE_CONTAINER_NAME',
    );

    if (!connectionString || !this.containerName) {
      this.logger.error(
        'Azure Storage connection string or container name is not configured. Please check your .env file.',
      );
      throw new Error('Azure Storage not configured.');
    }

    this.blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(
      this.containerName,
    );
  }

  async uploadFile(
    fileName: string,
    content: Buffer | string,
    contentType?: string,
  ): Promise<string> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    try {
      const dataToUpload =
        typeof content === 'string' ? Buffer.from(content) : content;
      await blockBlobClient.uploadData(dataToUpload, {
        blobHTTPHeaders: {
          blobContentType: contentType || 'application/octet-stream',
        },
      });
      this.logger.log(
        `File ${fileName} uploaded to Azure Blob Storage container ${this.containerName}`,
      );
      return blockBlobClient.url;
    } catch (error) {
      this.logger.error(
        `Failed to upload file ${fileName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getFile(fileName: string): Promise<Buffer> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    try {
      const downloadBlockBlobResponse = await blockBlobClient.download(0);
      if (!downloadBlockBlobResponse.readableStreamBody) {
        throw new Error(`Readable stream not available for file ${fileName}`);
      }
      return this.streamToBuffer(downloadBlockBlobResponse.readableStreamBody);
    } catch (error) {
      if (error.message && error.message.includes('Premature close')) {
        this.logger.warn(
          `[getFile] Download for ${fileName} failed due to 'Premature close' (likely client disconnect): ${error.message}`,
        );
        throw new HttpException(
          'Client connection closed prematurely.',
          HttpStatus.BAD_REQUEST,
        );
      } else {
        this.logger.error(
          `[getFile] Failed to download file ${fileName}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    try {
      await blockBlobClient.delete();
      this.logger.log(
        `File ${fileName} deleted from Azure Blob Storage container ${this.containerName}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to delete file ${fileName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getFileStats(
    fileName: string,
  ): Promise<{ contentLength: number } | null> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    try {
      const properties = await blockBlobClient.getProperties();
      if (properties.contentLength === undefined) {
        this.logger.warn(`Content length not available for file ${fileName}.`);
        return null;
      }
      return { contentLength: properties.contentLength };
    } catch (error) {
      if (error.statusCode === 404) {
        this.logger.warn(`File not found for stats: ${fileName}`);
        return null;
      }
      this.logger.error(
        `Failed to get file stats for ${fileName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getStreamableFile(fileName: string): Promise<StreamableFile> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    try {
      const downloadBlockBlobResponse = await blockBlobClient.download(0);
      if (!downloadBlockBlobResponse.readableStreamBody) {
        throw new Error(
          `Readable stream not available for file ${fileName} (full file)`,
        );
      }
      const azureStream =
        downloadBlockBlobResponse.readableStreamBody as Readable;
      const passThroughStream = new PassThrough();

      azureStream.on('error', (err) => {
        if (err.message && err.message.includes('Premature close')) {
          this.logger.warn(
            `Azure stream error for ${fileName} (full file) - Premature close (likely client disconnect): ${err.message}`,
          );
        } else {
          this.logger.error(
            `Azure stream error for ${fileName} (full file): ${err.message}`,
            err.stack,
          );
        }
        if (!passThroughStream.destroyed) {
          passThroughStream.destroy(err);
        }
      });

      passThroughStream.on('close', () => {
        if (!azureStream.destroyed) {
          this.logger.warn(
            `PassThrough stream for ${fileName} (full file) closed. Azure stream state: destroyed=${azureStream.destroyed}.`,
          );
        }
      });
      azureStream.pipe(passThroughStream);

      return new StreamableFile(passThroughStream);
    } catch (error) {
      if (error.message && error.message.includes('Premature close')) {
        this.logger.warn(
          `[getStreamableFile] Stream setup for ${fileName} (full file) failed due to 'Premature close' (likely client disconnect): ${error.message}`,
        );
        throw new HttpException(
          'Client connection closed prematurely during stream setup.',
          HttpStatus.BAD_REQUEST,
        );
      } else {
        this.logger.error(
          `[getStreamableFile] Failed to get streamable file ${fileName} (full file): ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  async getStreamableFileRange(
    fileName: string,
    start: number,
    end: number,
  ): Promise<StreamableFile> {
    const blockBlobClient = this.containerClient.getBlockBlobClient(fileName);
    const count = end - start + 1;
    try {
      const downloadBlockBlobResponse = await blockBlobClient.download(
        start,
        count,
      );
      if (!downloadBlockBlobResponse.readableStreamBody) {
        throw new Error(
          `Readable stream not available for file range ${fileName} (${start}-${end})`,
        );
      }
      const azureStream =
        downloadBlockBlobResponse.readableStreamBody as Readable;
      const passThroughStream = new PassThrough();

      azureStream.on('error', (err) => {
        if (err.message && err.message.includes('Premature close')) {
          this.logger.warn(
            `Azure stream error for ${fileName} (range ${start}-${end}) - Premature close (likely client disconnect): ${err.message}`,
          );
        } else {
          this.logger.error(
            `Azure stream error for ${fileName} (range ${start}-${end}): ${err.message}`,
            err.stack,
          );
        }
        if (!passThroughStream.destroyed) {
          passThroughStream.destroy(err);
        }
      });

      passThroughStream.on('close', () => {
        if (!azureStream.destroyed) {
          this.logger.warn(
            `PassThrough stream for ${fileName} (range ${start}-${end}) closed. Azure stream state: destroyed=${azureStream.destroyed}.`,
          );
        }
      });
      azureStream.pipe(passThroughStream);

      return new StreamableFile(passThroughStream);
    } catch (error) {
      if (error.message && error.message.includes('Premature close')) {
        this.logger.warn(
          `[getStreamableFileRange] Stream setup for ${fileName} (range ${start}-${end}) failed due to 'Premature close' (likely client disconnect): ${error.message}`,
        );
        throw new HttpException(
          'Client connection closed prematurely during stream setup.',
          HttpStatus.BAD_REQUEST,
        );
      } else {
        this.logger.error(
          `[getStreamableFileRange] Failed to get streamable file range ${fileName} (${start}-${end}): ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  private async streamToBuffer(
    readableStream: NodeJS.ReadableStream,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject); // Errors here will be caught by the calling method's try/catch
    });
  }
}
