# Active Context

This file tracks the project's current status, including recent changes, current goals, and open questions.
2025-05-24 12:04:57 - Log of updates made.

*

## Current Focus

*   Test the new `/call-analysis/calls` endpoint.
*   Monitor for any issues related to `nestjs-zod` and the downgraded `@nestjs/swagger` version.

## Recent Changes

*   [2025-05-26 23:37:46] - Corrected the import statement for the `path` module in [`StorageController`](apps/api/src/modules/storage/storage.controller.ts:14:1) to `import * as path from 'path';` to resolve a `TypeError` during call recording streaming.
*   [2025-05-26 23:22:51] - Added an audio player to [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:0) to stream call recordings from the `/api/v1/storage/recordings/stream/:callId` endpoint.
*   [2025-05-26 21:15:25] - Configured NestJS build process in `apps/api/nest-cli.json` to copy the `apps/api/client` directory (containing static assets like `index.html`) to the `dist/apps/api/client` output directory. This ensures that the `ServeStaticModule` can correctly serve these files.
*   [2025-05-25 15:16:51] - Added a BullMQ job to sync call recordings every 15 minutes. This involved creating `CallRecordingSyncProducerService` to schedule the job, `CallRecordingSyncConsumer` to fetch recent recordings and queue them for processing using the refactored `CallRecordingService.processRecordingsByDateRangeInternal` method. `VoipModule` was updated to include these new components and register the `CALL_RECORDING_SYNC_QUEUE`.
*   [2025-05-25 15:13:17] - Updated [`CallProcessingConsumer`](apps/api/src/modules/call-analysis/call-processing.consumer.ts:0) to handle transcription failures. If transcription results in an empty or null string, the call status is set to `"TRANSCRIPTION_FAILED"`, and subsequent analysis steps are skipped.
*   [2025-05-25 15:09:20] - Updated [`CallProcessingConsumer`](apps/api/src/modules/call-analysis/call-processing.consumer.ts:0) to handle cases where `externalPhoneNumber` is not found or when ConnectWise lookup fails due to a missing phone number. In such scenarios, the call is marked with status `"INTERNAL_CALL_SKIPPED"` and further processing (company lookup, analysis) is bypassed.
*   [2025-05-25 10:42:58] - Modified [`CallRecordingService`](apps/api/src/modules/voip/call-recording.service.ts:0) in `apps/api` to prevent queuing duplicate call processing jobs. The service now checks if a call with the same `uniqueid` (as `callSid`) already exists in the database with a `COMPLETED` status before adding it to the BullMQ queue. This involved injecting `CallRepository` and using its `findByCallSid` method. Corrected Prisma `CallStatus` enum import and usage.
*   [2025-05-25 10:38:43] - Noted recommendation to enable "strict" compiler option in `apps/api/tsconfig.json` and `apps/api/tsconfig.build.json`.
*   [2025-05-25 10:36:31] - Downgraded `@nestjs/swagger` to `^6.3.0` in `apps/api` to resolve runtime error `Cannot find module '@nestjs/core/router/legacy-route-converter'` due to version incompatibility with NestJS 9.x.
*   [2025-05-25 10:34:20] - Created API endpoint `/call-analysis/calls` for retrieving paginated and filtered call and call analysis data. This involved:
    *   Creating DTOs (`GetCallsQueryDto`, `CallResponseDto`, `PaginatedCallsResponseDto`) in `apps/api/src/modules/call-analysis/dto/get-calls.dto.ts`.
    *   Creating `CallAnalysisController` in `apps/api/src/modules/call-analysis/call-analysis.controller.ts`.
    *   Adding `getCalls` method to `CallAnalysisService` in `apps/api/src/modules/call-analysis/call-analysis.service.ts` to handle fetching and formatting data, using `CallRepository`.
    *   Adding `findMany` and `count` methods to `CallRepository` in `apps/api/src/modules/call-analysis/repositories/call.repository.ts`.
    *   Updating `CallAnalysisModule` in `apps/api/src/modules/call-analysis/call-analysis.module.ts` to include the new controller.
    *   Installed `@nestjs/swagger`, `class-transformer`, `class-validator` dependencies.
    *   Corrected Prisma type imports and usage in DTOs and services.
    *   Switched to standard `ValidationPipe` in `CallAnalysisController`.
*   [2025-05-25 10:03:14] - Planned integration of database persistence into the call processing workflow. This includes creating repository services, updating the `CallProcessingConsumer` to use Prisma transactions, and modifying the Prisma schema for `CallAnalysis` and `processingLog` to make `companyId` optional. Plan documented in `call_processing_db_integration_plan.md`.
*   [2025-05-24 18:36:09] - Implemented BullMQ producer ([`TranscriptionProducerService`](apps/api/src/modules/transcription/transcription.producer.service.ts:15)) and consumer ([`TranscriptionConsumer`](apps/api/src/modules/transcription/transcription.consumer.ts:9)) for audio transcription with a concurrency of 5. Updated [`TranscriptionModule`](apps/api/src/modules/transcription/transcription.module.ts:19) to register the queue and provide services. Modified [`VoipController`](apps/api/src/modules/voip/voip.controller.ts:14) to use the producer service for queueing transcription jobs.
*   [2025-05-24 15:57:42] - Refactored `supervisorAgent` and `callAnalysisAgent` into injectable NestJS services (`SupervisorAgentService` and `CallAnalysisService`). Updated `AgentsModule` to provide these services and `AgentsController` to inject `SupervisorAgentService`. Removed direct agent instantiations.
*   [2025-05-24 16:00:32] - Updated `apps/api/src/main.ts` to initialize `VoltAgent` with the `SupervisorAgentService` instance obtained from the NestJS application context.
*   [2025-05-24 16:02:31] - Updated `apps/api/src/main.ts` to also register `CallAnalysisService` (obtained via `app.get()`) with the `VoltAgent` instance, making both agents explicitly known at the top level.
*   [2025-05-24 16:04:12] - Commented out conflicting `VoltAgent` initialization and agent instantiations in `apps/agents/src/index.ts` to ensure `apps/api/src/main.ts` is the single source of truth.
*   [2025-05-24 16:44:31] - Corrected the Zod schema description for the `uniqueid` parameter in the `getCallRecordingTranscription` tool to accurately reflect its purpose.
*   [2025-05-24 16:46:34] - Updated the `description` (now `instructions`) of `SupervisorAgentService` to explicitly instruct the LLM to use its tools and sub-agent, and then format the final output according to `callAnalysisSchema`.
*   [2025-05-24 16:47:58] - Updated the prompt/instructions for `CallAnalysisService` in `apps/api/src/modules/agents/agents/callAnalysis/prompt.ts` to explicitly include the required JSON output schema (`callAnalysisSchema`).
*   [2025-05-24 17:08:14] - Updated `SupervisorAgentService` instructions to refer to the `getCallRecordingTranscription` tool by its exact name "Get-Voice-Call-Recording-Transcription".
*   [2025-05-24 17:47:24] - Added Prisma to the `apps/api` NestJS project: installed dependencies, initialized Prisma, created `PrismaService` and `PrismaModule`, imported `PrismaModule` into `AppModule`, and updated `.gitignore`.
*   [2025-05-24 17:50:59] - Added Azure Blob Storage module to `apps/api`: installed `@azure/storage-blob`, created `StorageService` and `StorageModule`, and imported `StorageModule` into `AppModule`.
*   [2025-05-24 17:54:05] - Corrected `uploadData` call in `StorageService` to convert string content to Buffer, resolving a TypeScript error.
*   [2025-05-24 17:55:52] - Added `@nestjs/bullmq` to `apps/api` project and configured `BullModule` in `AppModule` to connect to Redis.
*   [2025-05-24 18:12:49] - Created endpoint `/voip/recordings/transcribe` to get and transcribe call recordings by date range. This involved:
    *   Adding `GetCallRecordingsQueryDto` to `apps/api/src/modules/voip/dto/call-recording.dto.ts`.
    *   Creating `VoipController` in `apps/api/src/modules/voip/voip.controller.ts`.
    *   Installing `nestjs-zod`.
    *   Adding `getRecordingsByDateRange` method to `CallRecordingService`.
    *   Updating `TranscriptionService` to accept `Buffer` and `mimeType`.
    *   Updating `getCallRecordingTranscriptionTool` to pass `Buffer` and `mimeType`.
    *   Updating `VoipModule` to include `VoipController` and import `TranscriptionModule`.
*   [2025-05-24 18:16:07] - Updated `/voip/recordings/transcribe` endpoint in `VoipController` to default to the last 24 hours if `startDate` or `endDate` are not provided. Made `startDate` and `endDate` optional in `GetCallRecordingsQueryDto`.

## Open Questions/Issues

*   User needs to run `pnpm --filter api exec prisma generate` after schema modifications for optional `companyId` fields are applied by Code mode.
*   Verify that the `getCallRecordingTranscription` tool is now being called and that the "No object generated: response did not match schema" error is resolved.
*   User needs to configure `DATABASE_URL`.
*   User needs to add `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` to `apps/api/.env`.
*   The TypeScript error regarding `BlobServiceClient.fromConnectionString` in `apps/api/src/storage/storage.service.ts` (line 28) still needs to be monitored/resolved by the user if it persists after IDE/TS server restart.
*   Test the new `/voip/recordings/process` endpoint (formerly `/voip/recordings/transcribe`) to ensure jobs are queued and processed, including full database persistence.
*   Test the new `/call-analysis/calls` endpoint.
*   Monitor for issues related to `nestjs-zod` peer dependency on `@nestjs/swagger` now that `@nestjs/swagger` is downgraded.
*   Consider enabling "strict" compiler option in `apps/api/tsconfig.json` and `apps/api/tsconfig.build.json` for improved type safety.
