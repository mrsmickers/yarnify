import { Injectable, Logger, StreamableFile } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { Readable } from 'stream';

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
      this.logger.error(`Failed to upload file ${fileName}: ${error.message}`);
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
      this.logger.error(
        `Failed to download file ${fileName}: ${error.message}`,
      );
      throw error;
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
      this.logger.error(`Failed to delete file ${fileName}: ${error.message}`);
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
      return new StreamableFile(
        downloadBlockBlobResponse.readableStreamBody as Readable,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get streamable file ${fileName}: ${error.message}`,
      );
      throw error;
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
      return new StreamableFile(
        downloadBlockBlobResponse.readableStreamBody as Readable,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get streamable file range ${fileName} (${start}-${end}): ${error.message}`,
      );
      throw error;
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
      readableStream.on('error', reject);
    });
  }
}
