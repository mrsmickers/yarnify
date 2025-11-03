import {
  Injectable,
  Logger,
  StreamableFile,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  promises as fsPromises,
  existsSync,
  mkdirSync,
  createReadStream,
  constants as fsConstants,
} from 'fs';
import { dirname, normalize, resolve } from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly rootPath: string;

  constructor(private configService: ConfigService) {
    const configuredRoot = this.configService.get<string>('FILE_STORAGE_ROOT');
    const defaultRoot = resolve(process.cwd(), 'storage-data');
    this.rootPath = resolve(configuredRoot || defaultRoot);

    if (!existsSync(this.rootPath)) {
      mkdirSync(this.rootPath, { recursive: true });
      this.logger.log(
        `Created storage root at ${this.rootPath}. Set FILE_STORAGE_ROOT to customise.`,
      );
    } else {
      this.logger.log(`Using storage root ${this.rootPath}`);
    }
  }

  async uploadFile(
    fileName: string,
    content: Buffer | string,
    contentType?: string,
  ): Promise<string> {
    try {
      const targetPath = this.resolvePath(fileName);
      await fsPromises.mkdir(dirname(targetPath), { recursive: true });
      const dataToUpload =
        typeof content === 'string' ? Buffer.from(content) : content;
      await fsPromises.writeFile(targetPath, dataToUpload);
      if (contentType) {
        this.logger.debug(
          `Stored ${fileName} (${contentType ?? 'application/octet-stream'})`,
        );
      } else {
        this.logger.debug(`Stored ${fileName}`);
      }
      return fileName;
    } catch (error) {
      this.logger.error(
        `Failed to upload file ${fileName}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getFile(fileName: string): Promise<Buffer> {
    try {
      const targetPath = this.resolvePath(fileName);
      return await fsPromises.readFile(targetPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`[getFile] File not found: ${fileName}`);
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      } else if (error.code === 'EACCES') {
        this.logger.error(
          `[getFile] Permission denied for ${fileName}: ${error.message}`,
          error.stack,
        );
        throw new HttpException(
          'Unable to access file',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        this.logger.error(
          `[getFile] Failed to read file ${fileName}: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }
  }

  async deleteFile(fileName: string): Promise<void> {
    try {
      const targetPath = this.resolvePath(fileName);
      await fsPromises.unlink(targetPath);
      this.logger.log(`Deleted file ${fileName}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`[deleteFile] File already missing: ${fileName}`);
        return;
      }
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
    try {
      const targetPath = this.resolvePath(fileName);
      const stats = await fsPromises.stat(targetPath);
      return { contentLength: stats.size };
    } catch (error) {
      if (error.code === 'ENOENT') {
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
    try {
      const targetPath = this.resolvePath(fileName);
      await this.ensureReadable(targetPath);
      return new StreamableFile(createReadStream(targetPath));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.handleStreamError(error as NodeJS.ErrnoException, fileName);
    }
  }

  async getStreamableFileRange(
    fileName: string,
    start: number,
    end: number,
  ): Promise<StreamableFile> {
    try {
      const targetPath = this.resolvePath(fileName);
      await this.ensureReadable(targetPath);
      return new StreamableFile(
        createReadStream(targetPath, {
          start,
          end,
        }),
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.handleStreamError(error as NodeJS.ErrnoException, fileName, {
        start,
        end,
      });
    }
  }

  private resolvePath(fileName: string): string {
    const normalised = normalize(fileName).replace(/^(\.\.(\/|\\|$))+/, '');
    const absolutePath = resolve(this.rootPath, normalised);
    if (!absolutePath.startsWith(this.rootPath)) {
      this.logger.error(
        `Attempted access outside storage root: ${fileName} -> ${absolutePath}`,
      );
      throw new HttpException(
        'Invalid file path requested',
        HttpStatus.BAD_REQUEST,
      );
    }
    return absolutePath;
  }

  private async ensureReadable(targetPath: string) {
    try {
      await fsPromises.access(targetPath, fsConstants.R_OK);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new HttpException('File not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        'Unable to access file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private handleStreamError(
    error: NodeJS.ErrnoException,
    fileName: string,
    range?: { start: number; end: number },
  ): never {
    const rangeInfo = range
      ? ` range ${range.start}-${range.end}`
      : ' full file';
    if (error.code === 'ENOENT') {
      this.logger.warn(
        `[stream] File not found for${rangeInfo}: ${fileName}`,
      );
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
    this.logger.error(
      `[stream] Failed to open${rangeInfo} for ${fileName}: ${error.message}`,
      error.stack,
    );
    throw new HttpException(
      'Unable to stream file',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
