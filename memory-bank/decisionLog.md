# Decision Log

This file records architectural and implementation decisions using a list format.
2025-05-24 12:05:05 - Log of updates made.

*   [2025-05-25 15:16:38] - Implemented a BullMQ job to sync call recordings every 15 minutes.
    ## Decision
    *   Create a new BullMQ queue named `CALL_RECORDING_SYNC_QUEUE`.
    *   Implement `CallRecordingSyncProducerService` to schedule a repeatable job on this queue every 15 minutes. This job will trigger the sync process.
    *   Implement `CallRecordingSyncConsumer` to process jobs from this queue. The consumer will:
        *   Fetch call recordings from the VoIP provider for the last 16 minutes (15 minutes + 1-minute buffer).
        *   Utilize the existing `CallRecordingService` (refactored to `processRecordingsByDateRangeInternal`) to list these recordings and queue individual call processing jobs to the `CALL_PROCESSING_QUEUE`.
    *   Refactor `CallRecordingService` to separate the core logic of fetching and queuing recordings (`processRecordingsByDateRangeInternal`) from the controller-specific method (`getRecordingsByDateRangeAndQueue`).
    *   Update `VoipModule` to register the new queue and provide the new producer and consumer services.
    ## Rationale
    *   Automates the process of fetching recent call recordings, ensuring that new calls are regularly picked up for analysis.
    *   A 15-minute interval provides a good balance between timely processing and system load.
    *   Using a separate queue for the sync job itself allows for independent management and monitoring of this scheduled task.
    *   Reusing the existing call processing infrastructure ensures consistency.
    *   Refactoring `CallRecordingService` improves code reusability and separation of concerns.
    ## Implementation Details
    *   Created `apps/api/src/modules/voip/constants.ts` for `CALL_RECORDING_SYNC_QUEUE`.
    *   Created `apps/api/src/modules/voip/call-recording-sync.producer.service.ts`.
    *   Created `apps/api/src/modules/voip/call-recording-sync.consumer.ts`.
    *   Modified `apps/api/src/modules/voip/call-recording.service.ts` by adding `processRecordingsByDateRangeInternal` and renaming `getRecordingsByDateRange` to `getRecordingsByDateRangeAndQueue`.
    *   Updated `apps/api/src/modules/voip/voip.controller.ts` to use `getRecordingsByDateRangeAndQueue`.
    *   Updated `apps/api/src/modules/voip/voip.module.ts` to include new services and register the queue.
*   [2025-05-25 15:13:17] - Handle transcription failures in call processing.
    ## Decision
    *   In [`CallProcessingConsumer`](apps/api/src/modules/call-analysis/call-processing.consumer.ts:0), if `transcriptionService.transcribeAudio` returns an empty or null transcript, mark the call with status `"TRANSCRIPTION_FAILED"`.
    *   Bypass transcript analysis and analysis saving for such calls.
    *   Log the action appropriately.
    ## Rationale
    *   Prevents errors when transcription yields no usable text, which would cause the analysis step to fail or produce incorrect results.
    *   Allows the system to gracefully handle transcription issues without failing the entire job, while still marking the call appropriately.
    ## Implementation Details
    *   Added a check for `!transcript || transcript.trim() === ''` after the call to `transcriptionService.transcribeAudio`.
    *   If the condition is met, update `Call` status to `"TRANSCRIPTION_FAILED"`, log, and return from the `process` method.
*   [2025-05-25 15:09:20] - Handle missing phone numbers in call processing.
    ## Decision
    *   In [`CallProcessingConsumer`](apps/api/src/modules/call-analysis/call-processing.consumer.ts:0), if `extractExternalPhoneNumber` returns no number, or if `connectwise.getCompanyByPhoneNumber` fails specifically due to a missing phone number, mark the call with status `"INTERNAL_CALL_SKIPPED"`.
    *   Bypass company lookup, transcript analysis, and analysis saving for such calls.
    *   Log the action appropriately.
    ## Rationale
    *   Prevents errors when a phone number is unavailable for ConnectWise lookup, which is required for company identification.
    *   Allows the system to gracefully handle internal calls or calls where the phone number cannot be determined, without failing the entire job.
    ## Implementation Details
    *   Added a check for `externalPhoneNumber` after calling `callAnalysisService.extractExternalPhoneNumber`.
    *   If `externalPhoneNumber` is falsy, update `Call` status to `"INTERNAL_CALL_SKIPPED"`, log, and return.
    *   Wrapped the `connectwise.getCompanyByPhoneNumber` call in a try-catch block.
    *   If an error occurs and its message indicates a missing phone number, perform the same "INTERNAL_CALL_SKIPPED" logic.
    *   Other ConnectWise errors are re-thrown.
*   [2025-05-25 10:42:58] - Prevent duplicate call processing jobs.
    ## Decision
    *   Modify [`CallRecordingService`](apps/api/src/modules/voip/call-recording.service.ts:0) to check the database before queuing a call processing job.
    *   If a `Call` record with the same `callSid` (VoIP `uniqueid`) already exists and has a `callStatus` of `COMPLETED`, the job will not be queued.
    ## Rationale
    *   Avoids redundant processing of calls that have already been successfully analyzed and stored.
    *   Saves computational resources and prevents potential data inconsistencies.
    ## Implementation Details
    *   Injected `CallRepository` into [`CallRecordingService`](apps/api/src/modules/voip/call-recording.service.ts:0).
    *   In the `getRecordingsByDateRange` method, before calling `callProcessingProducer.addCallToProcessingQueue`, added a check using `callRepository.findByCallSid(listedRec.uniqueid)`.
    *   Imported `CallStatus` from `@db` and used `CallStatus.COMPLETED` for the check.
*   [2025-05-25 10:36:31] - Downgraded `@nestjs/swagger` to `^6.3.0` to fix runtime error.
    ## Decision
    *   Downgrade `@nestjs/swagger` from `11.2.0` to `^6.3.0` in `apps/api`.
    ## Rationale
    *   Runtime error `Error: Cannot find module '@nestjs/core/router/legacy-route-converter'` indicated an incompatibility between `@nestjs/swagger@11.2.0` and the project's NestJS 9.x core dependencies. Version `6.3.0` of `@nestjs/swagger` is known to be compatible with NestJS 9.
    ## Implementation Details
    *   Executed `pnpm --filter api add '@nestjs/swagger@^6.3.0'`.
*   [2025-05-25 10:34:20] - Created API endpoint `/call-analysis/calls` for retrieving paginated and filtered call and call analysis data.
    ## Decision
    *   Implement a GET endpoint at `/call-analysis/calls`.
    *   Support pagination via `page` and `limit` query parameters.
    *   Support filtering by `startDate`, `endDate`, `companyId`, `status`, and a generic `searchTerm`.
    *   Return a paginated response including call details and associated analysis data.
    ## Rationale
    *   Provides a standardized way to access call and analysis data for frontend display or other services.
    *   Filtering and pagination are essential for handling potentially large datasets efficiently.
    ## Implementation Details
    *   Created `GetCallsQueryDto`, `CallResponseDto`, and `PaginatedCallsResponseDto` in `apps/api/src/modules/call-analysis/dto/get-calls.dto.ts`.
    *   Created `CallAnalysisController` with a `getCalls` method in `apps/api/src/modules/call-analysis/call-analysis.controller.ts`.
    *   Added `getCalls` method to `CallAnalysisService` to orchestrate data fetching and transformation.
    *   Added `findMany` and `count` methods to `CallRepository`.
    *   Updated `CallAnalysisModule` to include the new controller.
    *   Installed `@nestjs/swagger`, `class-transformer`, `class-validator`.
    *   Used standard `ValidationPipe` for DTO validation.
    *   Corrected Prisma type imports to use `@db` alias and `Prisma.CallWhereInput`.
    *   Addressed spread operator issues for date filters in `CallAnalysisService`.
*   [2025-05-25 10:02:10] - Planned database integration for call processing.
    ## Decision
    *   Integrate database persistence into `CallProcessingConsumer` using Prisma for `Company`, `Call`, `CallAnalysis`, and `processingLog` tables.
    *   Create repository services (`CallRepository`, `CompanyRepository`, `CallAnalysisRepository`, `ProcessingLogRepository`) in `apps/api/src/modules/call-analysis/repositories/`.
    *   Modify Prisma schema to make `CallAnalysis.companyId` and `processingLog.companyId` optional (`String?`).
    *   Use `new Date()` for `Call.startTime`/`endTime` and calculate `Call.duration`.
    *   Employ Prisma transactions (`prisma.$transaction`) for database operations within the consumer.
    *   Use generic status enums: `Call.callStatus` (`PROCESSING`, `COMPLETED`, `FAILED`) and `processingLog.status` (`LOG_INFO`, `LOG_ERROR`, `LOG_SUCCESS`).
    *   `Call.callSid` will be the `callRecordingId` from job data.
    *   `analysisResult` object will be stored in `CallAnalysis.data`.
    *   The `CallProcessingConsumer` logic will be updated to:
        *   Check for existing calls by `callSid` and skip if already `COMPLETED`.
        *   Create or resume `Call` records.
        *   Log processing steps to `processingLog`.
        *   Find/create `Company` records.
        *   Store analysis results in `CallAnalysis`.
        *   Update `Call` record with final status, `endTime`, and `duration`.
        *   Handle errors gracefully, update statuses, and log errors.
    ## Rationale
    *   Persisting call processing data provides a historical record, enables advanced analytics, and improves traceability and debugging capabilities.
    *   Repository pattern abstracts data access logic, making the consumer cleaner and services more testable.
    *   Optional `companyId` fields allow logging and analysis storage even if a company is not identified, preventing data loss.
    *   Prisma transactions ensure atomicity of database operations for a given call, maintaining data integrity.
    *   Generic status enums simplify status management, with detailed information in log messages.
    ## Implementation Details
    *   Modify `apps/api/prisma/schema.prisma` for `CallAnalysis.companyId?` and `processingLog.companyId?`.
    *   Run `pnpm --filter api exec prisma generate` after schema changes.
    *   Create `*.repository.ts` files in `apps/api/src/modules/call-analysis/repositories/`.
    *   Update `apps/api/src/modules/call-analysis/call-analysis.module.ts` to provide and export repositories.
    *   Refactor `apps/api/src/modules/call-analysis/call-processing.consumer.ts` as per the detailed plan, including transaction management and new repository usage.
*   [2025-05-24 15:57:52] - Refactored agent instantiation to use NestJS dependency injection.
*   [2025-05-24 16:00:41] - Initialized `VoltAgent` in `main.ts` to register agent services with `@voltagent/core`.
*   [2025-05-24 16:02:42] - Explicitly registered `CallAnalysisService` with `VoltAgent` in `main.ts`.
*   [2025-05-24 16:04:29] - Commented out conflicting `VoltAgent` initialization in `apps/agents/src/index.ts`.
*   [2025-05-24 16:44:45] - Corrected misleading Zod schema description for `uniqueid` parameter in `getCallRecordingTranscription` tool.
*   [2025-05-24 16:46:49] - Updated `SupervisorAgentService` description to explicitly guide LLM to produce output matching `callAnalysisSchema`.
*   [2025-05-24 16:48:16] - Updated `CallAnalysisService` prompt to include the explicit JSON output schema (`callAnalysisSchema`).
*   [2025-05-24 17:08:33] - Updated `SupervisorAgentService` instructions to use the exact tool name "Get-Voice-Call-Recording-Transcription".
*   [2025-05-24 17:47:24] - Integrated Prisma into the `apps/api` NestJS project.
*   [2025-05-24 17:50:59] - Added Azure Blob Storage module to `apps/api` NestJS project.
*   [2025-05-24 17:54:05] - Corrected `StorageService.uploadFile` to convert string content to Buffer.
*   [2025-05-24 17:55:52] - Added `@nestjs/bullmq` to `apps/api` for message queuing.
*   [2025-05-24 18:01:12] - Created dedicated NestJS services for call recording fetching (`CallRecordingService` in `VoipModule`) and audio transcription (`TranscriptionService` in `TranscriptionModule`). Refactored the `getCallRecordingTranscription` tool to be a factory function (`getCallRecordingTranscriptionTool`) that uses these services, resolving them via a static `AppInstance` set in `main.ts`.
*   [2025-05-24 18:13:17] - Created `/voip/recordings/transcribe` endpoint.
*   [2025-05-24 18:16:36] - Updated `/voip/recordings/transcribe` endpoint to default to the last 24 hours if `startDate` or `endDate` are not provided.
*   [2025-05-24 18:36:09] - Implemented BullMQ producer/consumer for audio transcription.
*   [2025-05-24 18:53:17] - Refactored Call Analysis to be a standard NestJS service, removing VoltAgent dependency. Created `CallAnalysisModule` and `CallAnalysisService` in `apps/api/src/modules/call-analysis/`. Moved prompt logic to this new module. Updated `AppModule` and `AgentsModule`.
*   [2025-05-24 19:16:52] - Revised call processing workflow: `CallRecordingService` now queues a job with just `callRecordingId` (VoIP `uniqueid`). `CallProcessingConsumer` is now responsible for: 1. Fetching full recording data (including base64 audio) from the VoIP provider via `CallRecordingService.fetchCallRecording()`. 2. Uploading the fetched audio to Azure Blob Storage via `StorageService`. 3. Transcribing the audio via `TranscriptionService`. 4. Analyzing the transcript via `CallAnalysisService`.
*   [2025-05-24 19:20:11] - Resolved circular dependency between `VoipModule` and `CallAnalysisModule` by using `forwardRef()` in both module's imports array for the other module.
*   [2025-05-24 19:29:32] - Added ConnectWise Manage module using `connectwise-rest` package.
## Decision

*   Implement BullMQ producer ([`TranscriptionProducerService`](apps/api/src/modules/transcription/transcription.producer.service.ts:15)) and consumer ([`TranscriptionConsumer`](apps/api/src/modules/transcription/transcription.consumer.ts:9)) for audio transcription jobs with a concurrency of 5.
*   Refactor `supervisorAgent` and `callAnalysisAgent` from direct instantiations to injectable NestJS services.
*   Initialize `VoltAgent` *solely* in `apps/api/src/main.ts` by retrieving agent service instances (`SupervisorAgentService`, `CallAnalysisService`) from the NestJS application context and passing them to the `VoltAgent` constructor's `agents` map.
*   Remove or comment out the redundant `VoltAgent` initialization and direct agent instantiations in `apps/agents/src/index.ts`.
*   Correct the Zod schema description for the `uniqueid` parameter in the `getCallRecordingTranscription` tool.
*   Update the `SupervisorAgentService`'s `instructions` to explicitly instruct the LLM to perform its multi-step process (get transcript using the exact tool name "Get-Voice-Call-Recording-Transcription", then delegate to callAnalysis sub-agent) and then format its *final* output according to the `callAnalysisSchema` when `generateObject` is used.
*   Update the `CallAnalysisService`'s prompt/instructions in `apps/api/src/modules/agents/agents/callAnalysis/prompt.ts` to explicitly define the required JSON output structure, matching `callAnalysisSchema`.
*   Add Prisma ORM to the `apps/api` NestJS project for database interaction.
*   Add Azure Blob Storage integration to the `apps/api` NestJS project using the `@azure/storage-blob` SDK.
*   Add `@nestjs/bullmq` to the `apps/api` project for message queuing.
*   Create `VoipModule` with `CallRecordingService` for fetching call recordings, encapsulating VOIP provider interactions.
*   Create `TranscriptionModule` with `TranscriptionService` for audio transcription, centralizing AI SDK usage.
*   Refactor the `getCallRecordingTranscription` tool into a factory function (`getCallRecordingTranscriptionTool`) that accepts the NestJS application context. This allows the tool to resolve its dependencies (`CallRecordingService`, `TranscriptionService`) via DI.
*   Introduce a static `AppInstance` holder (`apps/api/src/app.instance.ts`) to make the NestJS application context available to the tool factory when it's invoked within `SupervisorAgentService`.
*   Modify `apps/api/src/main.ts` to set the `AppInstance` after the NestJS application is created.
*   Update `SupervisorAgentService` to import `getCallRecordingTranscriptionTool` and `AppInstance`, and then provide `getCallRecordingTranscriptionTool(AppInstance)` to its `tools` array.
*   Create a new endpoint `/voip/recordings/transcribe` to get call recordings by date range and transcribe them. This includes a new DTO `GetCallRecordingsQueryDto`, a new `VoipController`, and updates to `CallRecordingService` and `TranscriptionService`.
*   The `/voip/recordings/transcribe` endpoint will default to fetching recordings from the last 24 hours if `startDate` or `endDate` query parameters are not provided. The DTO `GetCallRecordingsQueryDto` was updated to make these parameters optional.
*   The `/voip/recordings/process` endpoint (formerly `/voip/recordings/transcribe`) in [`VoipController`](apps/api/src/modules/voip/voip.controller.ts:17) will delegate to `CallRecordingService`.
*   Refactor `CallAnalysisService` to be a standard NestJS service, independent of `@voltagent/core`. This involved creating a new `CallAnalysisModule` ([`apps/api/src/modules/call-analysis/call-analysis.module.ts`](apps/api/src/modules/call-analysis/call-analysis.module.ts:1)), a new `CallAnalysisService` ([`apps/api/src/modules/call-analysis/call-analysis.service.ts`](apps/api/src/modules/call-analysis/call-analysis.service.ts:1)) that uses the `ai` SDK directly, and moving the prompt logic ([`apps/api/src/modules/call-analysis/prompt.ts`](apps/api/src/modules/call-analysis/prompt.ts:1)). The old Volt-based service and related files in the `agents` directory were removed or updated.
*   Implement a new BullMQ queue (`CALL_PROCESSING_QUEUE`) for a multi-step call processing.
    *   `CallRecordingService` (`getRecordingsByDateRange` method) will list recordings and queue jobs containing only the `callRecordingId` (`uniqueid`) (and optional `recordgroup`, `recordid`) to `CALL_PROCESSING_QUEUE`.
    *   `CallProcessingConsumer` will:
        1. Receive the job with `callRecordingId`.
        2. Fetch the full call recording data (including base64 audio and mimetype) from the VoIP provider using `CallRecordingService.fetchCallRecording()`.
        3. Upload the fetched audio data to Azure Blob Storage using `StorageService`.
        4. Transcribe the fetched audio data using `TranscriptionService`.
        5. Analyze the transcript using `CallAnalysisService`.
    *   This workflow centralizes the fetching, storage, and processing logic within the consumer, triggered by a lightweight job.
*   Use `forwardRef()` in `CallAnalysisModule` (for `VoipModule`) and in `VoipModule` (for `CallAnalysisModule`) to resolve circular dependencies arising from `CallProcessingConsumer` (in `CallAnalysisModule`) injecting `CallRecordingService` (from `VoipModule`), and `CallRecordingService` (in `VoipModule`) injecting `CallProcessingProducerService` (from `CallAnalysisModule`).

## Rationale

*   Using a message queue (BullMQ) for transcription tasks decouples the HTTP request-response cycle from the potentially long-running transcription process. This improves API responsiveness and allows for better resource management and fault tolerance. Setting a concurrency of 5 on the consumer allows processing multiple transcriptions in parallel.
*   Decoupling the `CallAnalysisService` from `@voltagent/core` simplifies its architecture, makes it a standard NestJS injectable service, and removes dependencies on the Volt agent lifecycle for this specific functionality. It can now be called directly by other services.
*   Centralizing the multi-step process (fetch from VoIP, upload to blob, transcribe, analyze) within the `CallProcessingConsumer` makes the `CallRecordingService` simpler (only responsible for listing and queuing identifiers) and makes the job data lighter.
*   Storing audio files in Azure Blob Storage before transcription and analysis is more robust and scalable than passing large audio buffers directly in queue messages. It also allows for easier retries or re-processing if needed, as the source audio is persisted.
*   The original approach of directly instantiating and exporting agents is not standard NestJS practice and was causing "Agent not found" errors during application startup. NestJS relies on a robust dependency injection system. Services should be defined as providers within modules and injected into controllers or other services where needed. This promotes better modularity, testability, and adherence to the framework's conventions.
*   The `@voltagent/core` library's `AgentEventEmitter` likely relies on agents being registered with a single, central `VoltAgent` instance and looks them up by ID from the `agents` map provided to that `VoltAgent` constructor. Having a second `VoltAgent` initialization in `apps/agents/src/index.ts` created a separate, conflicting agent management context, leading to the "Agent not found" errors when events were emitted within the context of the `apps/api` application. Consolidating to a single `VoltAgent` instance in `apps/api/src/main.ts` ensures all parts of the system refer to the same agent registry.
*   A misleading Zod schema description for a tool parameter (`uniqueid` in `getCallRecordingTranscription`) can cause the LLM to generate input that doesn't match the schema, leading to "No object generated: response did not match schema" errors. Correcting the description helps the LLM provide valid input.
*   When using `agent.generateObject(prompt, schema)`, the agent's final output must conform to the provided schema. If the agent's internal process involves multiple steps or tool calls, its instructions/description must clearly guide it to produce the final, schema-compliant object *after* all internal steps are complete. Similarly, if a sub-agent is responsible for generating data that forms part of this final object, that sub-agent must also be clearly instructed on the schema it needs to produce for its part.
*   LLMs may be sensitive to the exact naming of tools in prompts. Using the tool's precise `name` (e.g., "Get-Voice-Call-Recording-Transcription") in the agent's instructions can improve the reliability of tool invocation.
*   Prisma provides a type-safe ORM for Node.js and TypeScript, simplifying database interactions and migrations within a NestJS application.
*   `@nestjs/bullmq` provides a NestJS-idiomatic way to integrate BullMQ, a robust and fast Redis-based queue system, for handling background jobs and message queuing.
*   Using the official `@azure/storage-blob` SDK is the standard way to interact with Azure Blob Storage from a Node.js application, providing robust and maintained functionality. The `uploadData` method requires binary data, so string content must be converted to a Buffer.
*   Separating concerns for fetching call data and transcribing audio into dedicated services (`CallRecordingService`, `TranscriptionService`) improves modularity, testability, and adherence to NestJS best practices.
*   Tools that require NestJS services (dependencies) should be instantiated in a way that allows these dependencies to be injected. A factory function pattern for the tool, combined with a mechanism to pass the application context (like the static `AppInstance`), enables this. This avoids tightly coupling the tool's internal logic with direct environment variable access or other non-DI patterns for its core functionalities.
*   A dedicated controller (`VoipController`) for VoIP-related actions improves separation of concerns. Query parameters for date ranges should be validated using a DTO and `ZodValidationPipe`. Services should handle specific data transformations (e.g., ISO date to Unix timestamp, base64 to Buffer). Providing default behavior (last 24 hours) for optional date range parameters enhances usability.

## Implementation Details

*   Created `CallAnalysisService` in `apps/api/src/modules/agents/agents/callAnalysis/callAnalysis.service.ts` (ensuring `id: 'callAnalysis'` is present). Updated its prompt in `apps/api/src/modules/agents/agents/callAnalysis/prompt.ts` to explicitly require output matching `callAnalysisSchema`.
*   Created `SupervisorAgentService` in `apps/api/src/modules/agents/agents/supervisor/supervisor.service.ts` (ensuring `id: 'supervisor'` is present), injecting `CallAnalysisService`. Updated its `instructions` to guide the LLM towards outputting an object matching `callAnalysisSchema` after its internal workflow, and to use the exact tool name "Get-Voice-Call-Recording-Transcription".
*   Updated `AgentsModule` (`apps/api/src/modules/agents/agents.module.ts`) to include `CallAnalysisService` and `SupervisorAgentService` in its `providers` array.
*   Updated `AgentsController` (`apps/api/src/modules/agents/agents.controller.ts`) to inject `SupervisorAgentService` via its constructor and use `generateObject` with `callAnalysisSchema`.
*   Commented out/removed the original agent instantiations in `apps/api/src/modules/agents/agents/callAnalysis/agent.ts` (API version) and `apps/api/src/modules/agents/index.ts`.
*   Modified `apps/api/src/main.ts` to import `VoltAgent`, `SupervisorAgentService`, and `CallAnalysisService`. After creating the NestJS `app`, it retrieves instances of both services using `app.get()` and then instantiates `new VoltAgent({ agents: { supervisor: supervisorAgentInstance, callAnalysis: callAnalysisAgentInstance } })`.
*   Commented out the `VoltAgent` initialization and agent instantiations in `apps/agents/src/index.ts`. The file `apps/agents/src/agents/callAnalysis/agent.ts` is now also redundant.
*   Corrected the `.describe()` string for the `uniqueid` parameter in the Zod schema within `apps/api/src/modules/agents/agents/tools/getCallRecordingTranscription.ts`.
*   Installed `prisma` and `@prisma/client` in `apps/api`.
*   Ran `prisma init --datasource-provider postgresql` in `apps/api`.
*   Created `PrismaService` in `apps/api/src/prisma/prisma.service.ts`.
*   Ran `prisma generate` in `apps/api` and updated `PrismaService` import path.
*   Created `PrismaModule` in `apps/api/src/prisma/prisma.module.ts`.
*   Imported `PrismaModule` into `apps/api/src/app.module.ts`.
*   Added `prisma/` and `generated/` to `apps/api/.gitignore`.
*   Installed `@azure/storage-blob` in `apps/api`.
*   Created `StorageService` in `apps/api/src/storage/storage.service.ts` and corrected `uploadFile` method to convert string to Buffer.
*   Created `StorageModule` in `apps/api/src/storage/storage.module.ts`.
*   Imported `StorageModule` into `apps/api/src/app.module.ts`.
*   Installed `@nestjs/bullmq` and `bullmq` in `apps/api`.
*   Imported `BullModule` into `apps/api/src/app.module.ts` and configured it to connect to Redis using environment variables for host, port, and password, with defaults to `localhost:6379`.
*   Created DTO `apps/api/src/modules/voip/dto/call-recording.dto.ts` for call recording schemas.
*   Added `@nestjs/axios` to `apps/api` dependencies.
*   Created `CallRecordingService` in `apps/api/src/modules/voip/call-recording.service.ts`.
*   Created `VoipModule` in `apps/api/src/modules/voip/voip.module.ts`.
*   Imported `VoipModule` into `apps/api/src/app.module.ts`.
*   Created `TranscriptionService` in `apps/api/src/modules/transcription/transcription.service.ts`.
*   Created `TranscriptionModule` in `apps/api/src/modules/transcription/transcription.module.ts`.
*   Imported `TranscriptionModule` into `apps/api/src/app.module.ts`.
*   Refactored `apps/api/src/modules/agents/agents/tools/getCallRecordingTranscription.ts` to export `getCallRecordingTranscriptionTool` factory function.
*   Created `apps/api/src/app.instance.ts` to hold a static reference to the NestJS app.
*   Updated `apps/api/src/main.ts` to call `setAppInstance(app)`.
*   Updated `apps/api/src/modules/agents/agents/supervisor/supervisor.service.ts` to import `getCallRecordingTranscriptionTool` and `AppInstance`, and use `getCallRecordingTranscriptionTool(AppInstance)` in its tools array.
*   Added `GetCallRecordingsQueryDto` to `apps/api/src/modules/voip/dto/call-recording.dto.ts` and made `startDate` and `endDate` optional.
*   Created `VoipController` in `apps/api/src/modules/voip/voip.controller.ts` and implemented default 24-hour date range logic.
*   Installed `nestjs-zod` in `apps/api`.
*   Added `getRecordingsByDateRange` method to `CallRecordingService`.
*   Updated `TranscriptionService` to accept `Buffer` and `mimeType`.
*   Updated `getCallRecordingTranscriptionTool` to convert base64 audio to `Buffer` and pass `mimeType`.
*   Updated `VoipModule` to include `VoipController` and import `TranscriptionModule`.
*   Created `apps/api/src/modules/transcription/constants.ts` to define `TRANSCRIPTION_QUEUE`.
*   Created `apps/api/src/modules/transcription/transcription.producer.service.ts` with `TranscriptionProducerService`.
*   Created `apps/api/src/modules/transcription/transcription.consumer.ts` with `TranscriptionConsumer` (worker) and set concurrency to 5.
*   Updated `apps/api/src/modules/transcription/transcription.module.ts` to register the `TRANSCRIPTION_QUEUE` with BullMQ, and provide/export the producer and consumer services.
*   Updated `apps/api/src/modules/voip/voip.controller.ts` to inject `TranscriptionProducerService` and use it to queue jobs (this was later changed, see below).
*   Created `apps/api/src/modules/call-analysis/call-analysis.service.ts` with an `analyzeTranscript` method using `generateObject` from the `ai` SDK and `openai('gpt-4o')`.
*   Moved prompt logic (including Zod schema `callAnalysisSchema`) to `apps/api/src/modules/call-analysis/prompt.ts`.
*   Created `apps/api/src/modules/call-analysis/call-analysis.module.ts` providing and exporting `CallAnalysisService`.
*   Imported `CallAnalysisModule` into `apps/api/src/app.module.ts`.
*   Removed old `CallAnalysisService` (Volt-based) from `apps/api/src/modules/agents/agents.module.ts`.
*   Confirmed `VoltAgent` setup in `apps/api/src/main.ts` was already commented out.
*   Deleted old service files: `apps/api/src/modules/agents/agents/callAnalysis/callAnalysis.service.ts` and `apps/api/src/modules/agents/agents/callAnalysis/new-call-analysis.service.ts`.
