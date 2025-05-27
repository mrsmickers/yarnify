# Progress

This file tracks the project's progress using a task list format.
2025-05-24 12:05:01 - Log of updates made.

*

## Completed Tasks

*   [2025-05-27 10:52:44] - Updated [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:324) to show agent name in general info, ensuring visibility even if analysis fails.
*   [2025-05-27 07:29:12] - Fixed agent name display on call details page ([`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:247:1)) to show agent name from the call data (`callDetails.agentName`) instead of from the analysis data.
*   [2025-05-27 07:22:54] - Updated `ServeStaticModule` `exclude` pattern in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts:49:1) to `['/api/**']` to address `path-to-regexp` and TypeScript errors.
*   [2025-05-27 07:13:35] - Configured `ServeStaticModule` in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts:50:1) for SPA routing by setting `exclude: ['/api/*']` and `renderPath: '*'`.
*   [2025-05-26 23:37:46] - Corrected `path` module import in [`StorageController`](apps/api/src/modules/storage/storage.controller.ts:14:1) to fix `TypeError` in call recording streaming.
*   [2025-05-26 23:22:51] - Added audio player to [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:0) for playing call recordings.
*   [2025-05-26 21:15:32] - Configured NestJS build in `apps/api/nest-cli.json` to copy static client assets from `apps/api/client` to `dist/apps/api/client`, enabling `ServeStaticModule` to serve them correctly.
*   [2025-05-25 15:16:58] - Implemented a recurring BullMQ job to sync call recordings every 15 minutes. This included creating a new queue (`CALL_RECORDING_SYNC_QUEUE`), a producer service (`CallRecordingSyncProducerService`) to schedule the job, and a consumer service (`CallRecordingSyncConsumer`) to fetch recent recordings and queue them for detailed processing. The `CallRecordingService` was refactored to support this, and `VoipModule` was updated.
*   [2025-05-25 15:13:17] - Enhanced [`CallProcessingConsumer`](apps/api/src/modules/call-analysis/call-processing.consumer.ts:0) to handle transcription failures. If transcription yields no text, the call is marked `"TRANSCRIPTION_FAILED"`, and analysis is skipped.
*   [2025-05-25 15:09:20] - Updated [`CallProcessingConsumer`](apps/api/src/modules/call-analysis/call-processing.consumer.ts:0) to handle calls with missing phone numbers by marking them as `"INTERNAL_CALL_SKIPPED"` and bypassing company lookup and analysis.
*   [2025-05-25 10:42:58] - Updated [`CallRecordingService`](apps/api/src/modules/voip/call-recording.service.ts:0) to prevent queuing duplicate call processing jobs by checking the database for existing `COMPLETED` calls.
*   [2025-05-25 10:37:01] - Created API endpoint `/call-analysis/calls` for retrieving paginated and filtered call and call analysis data.
    *   Created DTOs (`GetCallsQueryDto`, `CallResponseDto`, `PaginatedCallsResponseDto`) in `apps/api/src/modules/call-analysis/dto/get-calls.dto.ts`.
    *   Created `CallAnalysisController` in `apps/api/src/modules/call-analysis/call-analysis.controller.ts`.
    *   Added `getCalls` method to `CallAnalysisService` in `apps/api/src/modules/call-analysis/call-analysis.service.ts`.
    *   Added `findMany` and `count` methods to `CallRepository` in `apps/api/src/modules/call-analysis/repositories/call.repository.ts`.
    *   Updated `CallAnalysisModule` in `apps/api/src/modules/call-analysis/call-analysis.module.ts` to include the new controller.
    *   Installed `@nestjs/swagger`, `class-transformer`, `class-validator`.
    *   Downgraded `@nestjs/swagger` to `^6.3.0` to resolve runtime compatibility issues with NestJS 9.x.
    *   Corrected Prisma type imports and usage.
    *   Switched to standard `ValidationPipe` in `CallAnalysisController`.
*   [2025-05-25 10:04:01] - Planned database integration for call processing in `CallProcessingConsumer`. This includes Prisma schema modifications (optional `companyId` in `CallAnalysis` and `processingLog`), creation of repository services (`CallRepository`, `CompanyRepository`, `CallAnalysisRepository`, `ProcessingLogRepository`), updates to consumer logic to use repositories and Prisma transactions, and defining status enums. Plan documented in `call_processing_db_integration_plan.md`. Clarified that VoIP `uniqueid` (as `callRecordingId` in job data) will be used for `Call.callSid`.
*   [2025-05-24 19:29:37] - Added ConnectWise Manage module.
*   [2025-05-24 19:16:52] - Revised call processing workflow:
    *   `CallProcessingJobData` DTO updated to expect `callRecordingId` (VoIP `uniqueid`).
    *   `CallRecordingService` updated: `getRecordingsByDateRange` now queues jobs with only `callRecordingId` to `CallProcessingProducerService`. `fetchCallRecording` retained for consumer use.
    *   `CallProcessingConsumer` updated: Injects `CallRecordingService`. Fetches full recording data using `callRecordingId` from job, uploads audio to blob storage via `StorageService`, then transcribes and analyzes.
    *   `VoipController` simplified, delegates to `CallRecordingService`.
    *   `CallAnalysisModule` updated to import `VoipModule`.
    *   `VoipModule` and `CallAnalysisModule` updated with `forwardRef()` to resolve circular dependencies.
*   [2025-05-24 18:53:17] - Refactored `CallAnalysisService` to be a standard NestJS service (non-VoltAgent), created `CallAnalysisModule`, moved prompt, and updated `AppModule` and `AgentsModule`. Deleted old Volt-based call analysis service files.
*   [2025-05-24 18:36:09] - Implemented BullMQ producer/consumer for audio transcription with concurrency 5 and integrated with `/voip/recordings/transcribe` endpoint.
*   [2025-05-24 18:16:24] - Updated `/voip/recordings/transcribe` endpoint to default to the last 24 hours if `startDate` or `endDate` are not provided.
*   [2025-05-24 18:13:06] - Implemented endpoint `/voip/recordings/transcribe` to fetch call recordings by date range and transcribe them.
*   [2025-05-24 17:55:52] - Added `@nestjs/bullmq` to `apps/api` and configured `BullModule`.
*   [2025-05-24 17:50:59] - Added Azure Blob Storage module to `apps/api` NestJS project.
*   [2025-05-24 17:47:24] - Added Prisma to the `apps/api` NestJS project.
*   [2025-05-24 17:09:05] - Updated `SupervisorAgentService` instructions to use the exact tool name "Get-Voice-Call-Recording-Transcription".
*   [2025-05-24 16:48:48] - Updated `CallAnalysisService` prompt to include the explicit JSON output schema (`callAnalysisSchema`).
*   [2025-05-24 16:48:48] - Observed that `AgentsController` was updated to take `uniqueId` as a path parameter and uses it in the prompt for `generateObject`.
*   [2025-05-24 16:47:18] - Updated `SupervisorAgentService` description to explicitly guide LLM to produce output matching `callAnalysisSchema`.
*   [2025-05-24 16:45:09] - Corrected misleading Zod schema description for `uniqueid` parameter in `getCallRecordingTranscription` tool.
*   [2025-05-24 16:04:53] - Commented out conflicting `VoltAgent` initialization in `apps/agents/src/index.ts`.
*   [2025-05-24 16:02:56] - Explicitly registered `CallAnalysisService` with `VoltAgent` in `main.ts`.
*   [2025-05-24 16:00:54] - Initialized `VoltAgent` in `main.ts` to register agent services with `@voltagent/core`.
*   [2025-05-24 15:58:00] - Refactored agent instantiation to use NestJS dependency injection.

## Current Tasks

*   Implement the database integration plan for call processing (Target: Code Mode).
    *   Modify Prisma schema in `apps/api/prisma/schema.prisma`.
    *   Create repository service files in `apps/api/src/modules/call-analysis/repositories/`.
    *   Update `apps/api/src/modules/call-analysis/call-analysis.module.ts`.
    *   Update `apps/api/src/modules/call-analysis/call-processing.consumer.ts`.

## Next Steps

*   User to run `pnpm --filter api exec prisma generate` after schema modifications are applied.
*   User to configure `DATABASE_URL` in `apps/api/.env` if not already done.
*   User to add `AZURE_STORAGE_CONNECTION_STRING` and `AZURE_STORAGE_CONTAINER_NAME` to `apps/api/.env` if not already done.
*   Thoroughly test the updated call processing workflow, including various scenarios (new call, existing call, company found/not found, errors at different stages).
*   Verify data persistence in all relevant tables (`Company`, `Call`, `CallAnalysis`, `processingLog`).
*   Address any remaining "Open Questions/Issues" from `activeContext.md` as implementation progresses.
*   Test the new `/call-analysis/calls` endpoint.
*   Monitor for issues related to `nestjs-zod` peer dependency on `@nestjs/swagger` now that `@nestjs/swagger` is downgraded.
