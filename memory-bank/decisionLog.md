# Decision Log

This file records architectural and implementation decisions using a list format.
2025-05-24 12:05:05 - Log of updates made.

*   [2025-05-28 22:51:03] - Simplified "Technical Info" section in CallDetailPage.
    ## Decision
    *   Removed the "ID" field from the "Technical Info" section of [`apps/frontend/src/pages/CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:528). The "Call SID" field was updated to span the full width of its grid row (`md:col-span-2`).
    ## Rationale
    *   The user requested to only show "Call SID" in this section, as the internal "ID" might be less relevant for the user viewing this page.
    ## Implementation Details
    *   Used `apply_diff` to remove the `div` container for the "ID" field and to add `md:col-span-2` to the "Call SID" `div` to make it full-width on medium screens and above.
*   [2025-05-28 22:49:31] - Improved "Technical Info" section styling in CallDetailPage.
    ## Decision
    *   Replaced the simple `div` and `span` structure for "ID" and "Call SID" in the "Technical Info" section of [`apps/frontend/src/pages/CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:521) with a grid layout where each item is presented in a styled box, similar to a Shadcn `Card` or definition list item.
    ## Rationale
    *   The user requested to make the "Technical Info" section look better using Shadcn principles. The new structure provides better visual separation and a cleaner look, aligning with the styling of other information blocks on the page.
    ## Implementation Details
    *   Used `apply_diff` to change the JSX structure. The new structure uses a `grid` container and individual `div` elements for each technical detail, styled with Tailwind CSS classes (`p-4 bg-gray-50 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200`). Added `break-all` to the value spans to prevent long IDs from breaking the layout.
*   [2025-05-28 22:48:01] - Corrected duplicated code in CallDetailPage.
    ## Decision
    *   Removed a duplicated block of JSX code from the end of the file [`apps/frontend/src/pages/CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:557).
    ## Rationale
    *   The duplicated code (closing tags for CardContent, Card, motion.div, and two other divs) was causing syntax errors and preventing the component from rendering correctly.
    ## Implementation Details
    *   Used `apply_diff` to remove the extraneous lines. The initial attempt to remove a larger block was too aggressive, but a subsequent check confirmed the first `apply_diff` correctly removed the duplication, and a second `apply_diff` attempt correctly reported no changes were needed.
*   [2025-05-27 21:51:29] - Clarified LLM instructions for handling enum values in call analysis.
    ## Decision
    *   Updated the system prompt in [`apps/api/src/modules/call-analysis/prompt.ts`](apps/api/src/modules/call-analysis/prompt.ts:46) to provide more specific guidance on how to handle undetermined or unclear values for enum fields when generating the `callAnalysisSchema` object.
    ## Rationale
    *   The "AI_NoObjectGeneratedError: No object generated: response did not match schema" error was likely caused by the LLM attempting to use the string "undetermined" for enum fields where it was not a valid option. The previous instruction was ambiguous.
    *   The new instruction explicitly states that for string fields, "undetermined" can be used. For enum fields, one of the *defined* enum values for that specific field *must* be used. It guides the LLM to select neutral/default valid enum options if information is unclear, and restricts the use of "undetermined" to only the `upsell_opportunity` enum where it is explicitly allowed.
    ## Implementation Details
    *   Modified the instruction text on line 46 of [`apps/api/src/modules/call-analysis/prompt.ts`](apps/api/src/modules/call-analysis/prompt.ts:46).
*   [2025-05-27 16:44:16] - Configured periodic data refetching in VoIP Dashboard.
    ## Decision
    *   Updated [`VoipDashboardPage.tsx`](apps/frontend/src/pages/VoipDashboardPage.tsx:53:1) to refetch call data every 10 seconds.
    ## Rationale
    *   Ensures the dashboard displays near real-time call data, providing users with the most up-to-date information.
    ## Implementation Details
    *   Added `refetchInterval: 10000` to the query options of the `useCallAnalysisControllerGetCalls` hook.
*   [2025-05-27 10:52:44] - Moved agent name display in CallDetailPage.tsx to general info.
    ## Decision
    *   Relocated the "Agent Name" display block from the `callDetails.analysis` conditional section to the "General Information" section in [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:324).
    ## Rationale
    *   The agent's name (`callDetails.agentName`) is part of the primary call data, not just the analysis results.
    *   Displaying it in the "General Information" section ensures it's visible even if the `callDetails.analysis` object is not present (e.g., if analysis processing failed or is incomplete). This provides users with key information regardless of the analysis status.
    ## Implementation Details
    *   Removed the "Agent Name" card from the analysis section.
    *   Added a new `div` to display "Agent Name" within the "General Information" grid.
*   [2025-05-27 07:29:12] - Updated agent name display in CallDetailPage.tsx.
    ## Decision
    *   Modified [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:247:1) to display `callDetails.agentName` instead of `callDetails.analysis.agent_name`.
    ## Rationale
    *   The `CallResponseDto` (defined in [`apps/api/src/modules/call-analysis/dto/get-calls.dto.ts`](apps/api/src/modules/call-analysis/dto/get-calls.dto.ts:77:1)) provides an `agentName` field directly on the call object. This is likely the more accurate source for the agent's name associated with the call, as opposed to the `agent_name` field within the nested `analysis` object, which might be a result of AI analysis.
    *   Using the direct `agentName` field ensures that the displayed name is the one explicitly linked to the call record in the backend.
    ## Implementation Details
    *   Changed the data binding for the "Agent Name" field in [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:247:1).
*   [2025-05-27 07:22:54] - Reverted `ServeStaticModule` `exclude` pattern to `['/api/**']`.
    ## Decision
    *   Changed the `exclude` option in `ServeStaticModule` configuration in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts:49:1) from `[/^\/api\//]` back to a string glob `['/api/**']`.
    ## Rationale
    *   The previous attempt to use a regular expression `[/^\/api\//]` for `exclude` caused a TypeScript error because the `exclude` option expects an array of strings (glob patterns).
    *   The runtime error `TypeError: Missing parameter name at 6` from `path-to-regexp` occurred with `exclude: ['/api/*']`.
    *   Using `['/api/**']` is another attempt to find a glob pattern that is correctly interpreted by `path-to-regexp` while satisfying the type requirements for the `exclude` option. The `**` globstar is intended to match any characters including slashes, effectively excluding all paths under `/api/`.
    ## Implementation Details
    *   Modified the `exclude` value in the `ServeStaticModule.forRoot` options in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts:49:1).
*   [2025-05-27 07:13:35] - Configured `ServeStaticModule` for SPA routing.
    ## Decision
    *   Updated `ServeStaticModule` configuration in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts:50:1).
    *   Set `exclude` to `['/api/*']`.
    *   Added `renderPath: '*'`.
    *   Removed `serveStaticOptions: { fallthrough: false }`.
    ## Rationale
    *   Ensures that all requests not matching an API route (`/api/*`) or an existing static file are served `index.html` from the `client` directory. This is standard practice for Single Page Applications (SPAs) to handle client-side routing.
    *   `renderPath: '*'` is the recommended way to achieve SPA fallback with `@nestjs/serve-static`.
    *   The previous `exclude: ['/api/{*test}']` was an unusual glob pattern. `'/api/*'` is more standard.
    *   The default `fallthrough: true` behavior is generally preferred when using `renderPath` for SPA fallbacks.
    ## Implementation Details
    *   Modified the `ServeStaticModule.forRoot` options in [`apps/api/src/app.module.ts`](apps/api/src/app.module.ts:50:1).
*   [2025-05-26 23:37:46] - Corrected `path` module import in [`StorageController`](apps/api/src/modules/storage/storage.controller.ts:14:1).
    ## Decision
    *   Changed `import path from 'path';` to `import * as path from 'path';`.
    ## Rationale
    *   The `path` module is a built-in Node.js module and does not have a default export. The `import * as path` syntax correctly imports all named exports from the module under the `path` namespace, resolving the `TypeError: Cannot read properties of undefined (reading 'basename')` that occurred because `path` itself was undefined.
    ## Implementation Details
    *   Updated the import statement in [`apps/api/src/modules/storage/storage.controller.ts`](apps/api/src/modules/storage/storage.controller.ts:14:1).
*   [2025-05-26 23:22:51] - Added audio player to Call Details page.
    ## Decision
    *   Add an HTML `<audio>` element to [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:0).
    *   The `src` attribute of the audio player will point to `/api/v1/storage/recordings/stream/:callId`.
    ## Rationale
    *   Provides users with the ability to play call recordings directly on the call details page.
    *   Utilizes the existing API endpoint for streaming recordings.
    ## Implementation Details
    *   Modified [`CallDetailPage.tsx`](apps/frontend/src/pages/CallDetailPage.tsx:195) to include the `<audio>` tag and construct the `src` URL using the `callId` from `useParams`.
*   [2025-05-26 21:15:11] - Configured NestJS build to copy static client assets.
    ## Decision
    *   Modify `apps/api/nest-cli.json` to include the `apps/api/client` directory in the build assets.
    *   The `compilerOptions.assets` array was updated to include `{"include": "../client/**/*", "outDir": "./client", "watchAssets": false}`.
    ## Rationale
    *   The `ServeStaticModule` in `apps/api/src/app.module.ts` is configured to serve static files from a `client` directory relative to the application's root (`dist/apps/api/client` after build).
    *   Without explicitly defining these assets in `nest-cli.json`, the `client` directory and its contents (e.g., `index.html`) would not be copied to the `dist` folder during the build process, leading to 404 errors for static content.
    ## Implementation Details
    *   Updated `apps/api/nest-cli.json` by adding the `compilerOptions.assets` configuration.
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
