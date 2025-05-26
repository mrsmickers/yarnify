import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

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
