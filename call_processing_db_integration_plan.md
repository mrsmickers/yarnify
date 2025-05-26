# Final Project Plan: Integrate Database Persistence into Call Processing

**Overall Goal:** Modify the `CallProcessingConsumer` to persist call data, analysis results, company information, and processing logs into the database using Prisma. This involves creating repository services for database interactions and updating the consumer logic.

**Key Decisions & Assumptions:**

*   **Repository Location:** `apps/api/src/modules/call-analysis/repositories/`
*   **`Call` Table Timestamps:** Use `new Date()` for `Call.startTime`/`Call.endTime` and calculate `Call.duration`.
*   **Company ID Handling (Schema Change Required):**
    *   `CallAnalysis.companyId` will be made **optional** (`String?`) in `apps/api/prisma/schema.prisma`.
    *   `processingLog.companyId` will be made **optional** (`String?`) in `apps/api/prisma/schema.prisma`.
    *   This allows for comprehensive logging and analysis storage even if a company is not identified or linked.
*   **Prisma Transactions:** All database operations within the `process` method of the consumer will be wrapped in a `prisma.$transaction([...])`.
*   **Status Enums:**
    *   `Call.callStatus`: `PROCESSING`, `COMPLETED`, `FAILED`
    *   `processingLog.status`: `LOG_INFO`, `LOG_ERROR`, `LOG_SUCCESS`
*   **`Call.callSid`**: Assumed to be the `callRecordingId` from the job data and will be used as the primary unique identifier for an incoming call interaction.
*   **`CallAnalysis.data`**: The `analysisResult` object from `callAnalysisService.analyzeTranscript()` will be stored directly in this JSON field.

---

**Phase 1: Prisma Schema Modifications**

File: `apps/api/prisma/schema.prisma`

1.  Modify `CallAnalysis` model:
    ```prisma
    model CallAnalysis {
      // ... existing fields
      companyId String? // Changed to optional
      // ... existing fields
      Company   Company? @relation(fields: [companyId], references: [id]) // Ensure relation matches optionality
    }
    ```
2.  Modify `processingLog` model:
    ```prisma
    model processingLog {
      // ... existing fields
      companyId String? // Changed to optional
      // ... existing fields
      Company Company? @relation(fields: [companyId], references: [id]) // Ensure relation matches optionality
    }
    ```
3.  **Action for User After Schema Change:** Run `pnpm --filter api exec prisma generate` to update the Prisma client.

---

**Phase 2: Create Repository Services**

Location: `apps/api/src/modules/call-analysis/repositories/`

*   **`call.repository.ts`**
    *   `@Injectable()` class `CallRepository`.
    *   Inject `PrismaService`.
    *   Methods:
        *   `findByCallSid(callSid: string, prisma?: Prisma.TransactionClient): Promise<Call | null>`
        *   `create(data: Prisma.CallUncheckedCreateInput, prisma?: Prisma.TransactionClient): Promise<Call>` (Using `UncheckedCreateInput` for flexibility with relations)
        *   `update(id: string, data: Prisma.CallUncheckedUpdateInput, prisma?: Prisma.TransactionClient): Promise<Call>`
*   **`company.repository.ts`**
    *   `@Injectable()` class `CompanyRepository`.
    *   Inject `PrismaService`.
    *   Methods:
        *   `findByConnectwiseId(connectwiseId: string, prisma?: Prisma.TransactionClient): Promise<Company | null>`
        *   `create(data: Prisma.CompanyCreateInput, prisma?: Prisma.TransactionClient): Promise<Company>`
        *   `findOrCreate(connectwiseId: string, name: string, prisma?: Prisma.TransactionClient): Promise<Company>`
*   **`call-analysis.repository.ts`**
    *   `@Injectable()` class `CallAnalysisRepository`.
    *   Inject `PrismaService`.
    *   Methods:
        *   `create(data: Prisma.CallAnalysisUncheckedCreateInput, prisma?: Prisma.TransactionClient): Promise<CallAnalysis>`
*   **`processing-log.repository.ts`**
    *   `@Injectable()` class `ProcessingLogRepository`.
    *   Inject `PrismaService`.
    *   Methods:
        *   `create(data: Prisma.processingLogUncheckedCreateInput, prisma?: Prisma.TransactionClient): Promise<processingLog>`

*   **Module Updates (`call-analysis.module.ts`):**
    *   Add all four repository services to the `providers` array.
    *   Add all four repository services to the `exports` array.
    *   Ensure `PrismaModule` is imported.

---

**Phase 3: Update `CallProcessingConsumer` Logic**

File: `apps/api/src/modules/call-analysis/call-processing.consumer.ts`

1.  **Imports:**
    *   Import the four new repository services.
    *   Import `PrismaService` (if not already) and `Prisma` namespace for types.
2.  **Constructor:**
    *   Inject the four repository services.
3.  **`process(job)` Method Overhaul:**

    ```typescript
    // At the top of the file
    import { Prisma } from '@prisma/client'; // Or your generated client path

    // ... other imports

    // Inside the class
    // ... constructor injections

    async process(job: Job<CallProcessingJobData, any, string>): Promise<any> {
      const { callRecordingId, recordgroup, recordid } = job.data; // callRecordingId is used as callSid
      this.logger.log(`Processing job ${job.id} for call SID: ${callRecordingId}`);

      return this.prisma.$transaction(async (tx) => { // tx is the Prisma.TransactionClient
        let callEntity: Call | null = null;
        let companyEntity: Company | null = null;

        // Step 0: Check for Existing Call
        const existingCall = await this.callRepository.findByCallSid(callRecordingId, tx);
        if (existingCall && existingCall.callStatus === 'COMPLETED') {
          this.logger.warn(`Call SID ${callRecordingId} (Job ${job.id}) has already been COMPLETED. Skipping.`);
          await this.processingLogRepository.create({
            data: {
              callId: existingCall.id,
              companyId: existingCall.companyId,
              status: 'LOG_INFO',
              message: `Skipped: Call SID ${callRecordingId} already COMPLETED.`
            }
          }, tx);
          return { jobId: job.id, message: 'Skipped, already COMPLETED.' };
        }

        if (existingCall) {
          callEntity = existingCall;
          this.logger.log(`Resuming processing for existing Call ID ${callEntity.id} (SID: ${callRecordingId})`);
          callEntity = await this.callRepository.update(callEntity.id, { callStatus: 'PROCESSING' }, tx);
        } else {
          callEntity = await this.callRepository.create({
            callSid: callRecordingId,
            startTime: new Date(),
            callStatus: 'PROCESSING',
          }, tx);
          this.logger.log(`Created new Call record with ID: ${callEntity.id} for SID: ${callRecordingId}`);
        }

        await this.processingLogRepository.create({
          data: { callId: callEntity.id, status: 'LOG_INFO', message: `Job ${job.id} started processing for Call ID: ${callEntity.id}.` }
        }, tx);

        try {
          // 1. Fetch full recording data
          this.logger.log(`Fetching recording data for ${callRecordingId}`);
          const recordingResponse = await this.callRecordingService.fetchCallRecording(callRecordingId, recordgroup, recordid);
          if (!recordingResponse?.data?.data) { 
            // Simplified error handling for plan brevity
            throw new Error('Failed to fetch recording data or audio data missing.');
          }
          await this.processingLogRepository.create({ data: { callId: callEntity.id, status: 'LOG_INFO', message: 'Recording data fetched.'}}, tx);
          const recordingData = recordingResponse.data;
          const audioBase64 = recordingData.data;
          const mimeType = recordingData.mimetype || 'audio/mpeg';

          // 2. Upload fetched audio to blob storage
          const blobFileName = `call-recordings/${callRecordingId}.${mimeType.split('/')[1] || 'mp3'}`;
          const audioBufferForUpload = Buffer.from(audioBase64, 'base64');
          const blobPath = await this.storageService.uploadFile(blobFileName, audioBufferForUpload, mimeType);
          callEntity = await this.callRepository.update(callEntity.id, { recordingUrl: blobPath }, tx);
          await this.processingLogRepository.create({ data: { callId: callEntity.id, status: 'LOG_INFO', message: `Audio uploaded to ${blobPath}`}}, tx);

          // 3. Transcribe audio
          const transcript = await this.transcriptionService.transcribeAudio(audioBase64, mimeType);
          if (!transcript) { throw new Error('Transcription failed or returned empty text.'); }
          await this.processingLogRepository.create({ data: { callId: callEntity.id, status: 'LOG_INFO', message: 'Transcription successful.'}}, tx);

          // 4. Handle Company
          const externalPhoneNumber = await this.callAnalysisService.extractExternalPhoneNumber(recordingData);
          const companyFromConnectwise = await this.connectwise.getCompanyByPhoneNumber(externalPhoneNumber);

          if (companyFromConnectwise) {
            companyEntity = await this.companyRepository.findOrCreate(companyFromConnectwise.id.toString(), companyFromConnectwise.name, tx);
            callEntity = await this.callRepository.update(callEntity.id, { companyId: companyEntity.id }, tx);
            await this.processingLogRepository.create({ data: { callId: callEntity.id, companyId: companyEntity.id, status: 'LOG_INFO', message: `Company identified/created: ${companyEntity.name} (ID: ${companyEntity.id})`}}, tx);
          } else {
            await this.processingLogRepository.create({ data: { callId: callEntity.id, status: 'LOG_INFO', message: `No ConnectWise company found for phone ${externalPhoneNumber}`}}, tx);
          }

          // 5. Analyze transcript
          const promptTranscript = `client_name: ${companyEntity?.name || 'Not found'}\nPhone Number: ${externalPhoneNumber}\nTranscript: ${transcript}`;
          const analysisResult = await this.callAnalysisService.analyzeTranscript(promptTranscript);
          await this.processingLogRepository.create({ data: { callId: callEntity.id, companyId: companyEntity?.id, status: 'LOG_INFO', message: 'Transcript analysis successful.'}}, tx);

          // 6. Save analysis result
          const callAnalysisEntity = await this.callAnalysisRepository.create({
            callId: callEntity.id,
            companyId: companyEntity?.id, 
            data: analysisResult as unknown as Prisma.InputJsonValue,
          }, tx);
          callEntity = await this.callRepository.update(callEntity.id, { callAnalysisId: callAnalysisEntity.id }, tx);
          await this.processingLogRepository.create({ data: { callId: callEntity.id, companyId: companyEntity?.id, status: 'LOG_SUCCESS', message: `Call analysis saved. Analysis ID: ${callAnalysisEntity.id}`}}, tx);

          // 7. Finalize Call Record
          const endTime = new Date();
          const duration = Math.round((endTime.getTime() - new Date(callEntity.startTime).getTime()) / 1000);
          await this.callRepository.update(callEntity.id, {
            endTime: endTime,
            duration: duration,
            callStatus: 'COMPLETED',
          }, tx);

          await this.processingLogRepository.create({ data: { callId: callEntity.id, companyId: companyEntity?.id, status: 'LOG_SUCCESS', message: `Job ${job.id} processing COMPLETED.`}}, tx);
          this.logger.log(`Processing COMPLETED for job ${job.id}, Call ID: ${callEntity.id}`);
          return { jobId: job.id, analysis: analysisResult, blobPath, callId: callEntity.id };

        } catch (error) {
          this.logger.error(`Job ${job.id} FAILED during processing for Call ID: ${callEntity?.id || 'UNKNOWN'}. SID: ${callRecordingId}`, error.stack);
          if (callEntity) {
            await this.callRepository.update(callEntity.id, { callStatus: 'FAILED' }, tx).catch(e => this.logger.error(`Failed to update call status to FAILED for Call ID ${callEntity.id}: ${e.message}`));
            await this.processingLogRepository.create({
              data: { callId: callEntity.id, companyId: companyEntity?.id, status: 'LOG_ERROR', message: `Processing FAILED: ${error.message}` }
            }, tx).catch(e => this.logger.error(`Failed to log JOB_FAILED for Call ID ${callEntity.id}: ${e.message}`));
          }
          throw error;
        }
      }).catch(transactionError => {
          this.logger.error(`Prisma transaction FAILED for job ${job.id}, SID: ${callRecordingId}. Error: ${transactionError.message}`, transactionError.stack);
          throw transactionError;
      });
    }
    ```

    **Error Handling within `process` method:**
    *   Each major step should have specific error logging to `processingLog` with `status: 'LOG_ERROR'`.
    *   If a step fails, the `Call` record status should be updated to `FAILED`.
    *   The main `try/catch` (inside the transaction) will catch unhandled errors, log them, set call status to `FAILED`, and re-throw.
    *   The outer `.catch()` on `this.prisma.$transaction` handles failures of the transaction itself.

---

**Phase 4: Mermaid Diagram (Reflects Final Plan)**

```mermaid
sequenceDiagram
    participant JobQueue
    participant CallProcessingConsumer as Consumer
    participant PrismaTransaction as TX
    participant CallRepository as CR
    participant ProcessingLogRepository as PLR
    participant CallRecordingService as CRS
    participant StorageService as SS
    participant TranscriptionService as TS
    participant ConnectwiseManageService as CWM
    participant CompanyRepository as CompR
    participant CallAnalysisService as CAS
    participant CallAnalysisRepository as CAR

    JobQueue->>Consumer: process(job{callRecordingId})
    Consumer->>TX: Start Prisma Transaction
    TX->>CR: findByCallSid(callRecordingId)
    alt Call Exists & COMPLETED
        CR-->>TX: existingCall (COMPLETED)
        TX->>PLR: create(log: SKIPPED)
        TX-->>Consumer: Skipped
        Consumer-->>JobQueue: Success (Skipped)
    else
        alt Call Not Exists
            TX->>CR: create(callSid, status='PROCESSING')
            CR-->>TX: callEntity
        else Call Exists (Not COMPLETED)
            CR-->>TX: callEntity (existing)
            TX->>CR: update(callEntity.id, status='PROCESSING')
            CR-->>TX: updatedCallEntity
        end
        TX->>PLR: create(log: JOB_STARTED)

        TX->>CRS: fetchCallRecording(callRecordingId)
        CRS-->>TX: recordingResponse / Error
        opt On Error
            TX->>PLR: create(log: FETCH_FAILED, status='LOG_ERROR')
            TX->>CR: update(callId, status='FAILED')
            TX-->>Consumer: Throw Error
        end
        TX->>PLR: create(log: FETCH_SUCCESS, status='LOG_INFO')

        TX->>SS: uploadFile(audioBuffer)
        SS-->>TX: blobPath / Error
        opt On Error
            TX->>PLR: create(log: UPLOAD_FAILED, status='LOG_ERROR')
            TX->>CR: update(callId, status='FAILED')
            TX-->>Consumer: Throw Error
        end
        TX->>CR: update(callId, recordingUrl=blobPath)
        TX->>PLR: create(log: UPLOAD_SUCCESS, status='LOG_INFO')

        TX->>TS: transcribeAudio(audioBase64)
        TS-->>TX: transcript / Error
         opt On Error
            TX->>PLR: create(log: TRANSCRIPTION_FAILED, status='LOG_ERROR')
            TX->>CR: update(callId, status='FAILED')
            TX-->>Consumer: Throw Error
        end
        TX->>PLR: create(log: TRANSCRIPTION_SUCCESS, status='LOG_INFO')

        TX->>CAS: extractExternalPhoneNumber(recordingData)
        CAS-->>TX: externalPhoneNumber
        TX->>CWM: getCompanyByPhoneNumber(externalPhoneNumber)
        CWM-->>TX: companyFromConnectwise / null
        opt companyFromConnectwise is not null
            TX->>CompR: findOrCreate(cwId, name)
            CompR-->>TX: companyEntity
            TX->>CR: update(callId, companyId=companyEntity.id)
            TX->>PLR: create(log: COMPANY_IDENTIFIED, status='LOG_INFO')
        else
            TX->>PLR: create(log: COMPANY_NOT_FOUND, status='LOG_INFO')
        end

        TX->>CAS: analyzeTranscript(transcript, companyName)
        CAS-->>TX: analysisResult / Error
        opt On Error
            TX->>PLR: create(log: ANALYSIS_FAILED, status='LOG_ERROR')
            TX->>CR: update(callId, status='FAILED')
            TX-->>Consumer: Throw Error
        end
        TX->>PLR: create(log: ANALYSIS_SUCCESS, status='LOG_INFO')

        TX->>CAR: create(callId, companyId?, data=analysisResult)
        CAR-->>TX: callAnalysisEntity
        TX->>CR: update(callId, callAnalysisId=callAnalysisEntity.id)
        TX->>PLR: create(log: ANALYSIS_SAVED, status='LOG_SUCCESS')

        TX->>CR: update(callId, endTime, duration, status='COMPLETED')
        TX->>PLR: create(log: JOB_COMPLETED, status='LOG_SUCCESS')
        TX-->>Consumer: Success {jobId, analysis, blobPath, callId}
        Consumer-->>JobQueue: Success
    end
    alt Error within Transaction
        TX->>PLR: create(log: JOB_FAILED, status='LOG_ERROR')
        opt callEntity exists
             TX->>CR: update(callId, status='FAILED')
        end
        TX-->>Consumer: Throw Error (Rollback by Prisma)
        Consumer-->>JobQueue: Throw Error
    end
    alt Transaction Call Error
        Consumer-->>JobQueue: Throw Error (Job Fails)
    end
```

---
