# Plan: Transcript Storage and Vector Embedding Integration (with Chunking)

**Date:** 2025-05-27

**Overall Goal:** Modify the existing call processing workflow to:
1.  Store the generated call transcript as a text file in Azure Blob Storage.
2.  Chunk the transcript if it exceeds the model's token limit.
3.  Generate a vector embedding for each chunk using OpenAI.
4.  Store these embeddings (one per chunk) in a new PostgreSQL database table, leveraging the `pgvector` extension.

---

## 1. Prisma Schema Modifications

File: `apps/api/prisma/schema.prisma`

*   **Update `Call` Model:**
    *   Add a new optional field to store the URL/path of the transcript in Azure Blob Storage.
      ```prisma
      model Call {
        // ... existing fields ...
        transcriptUrl String? // Path to the transcript in blob storage
      }
      ```

*   **Create `CallTranscriptEmbedding` Model:**
    *   This model will store embeddings for chunks of a transcript.
      ```prisma
      model CallTranscriptEmbedding {
        id            String   @id @default(cuid())
        createdAt     DateTime @default(now())
        updatedAt     DateTime @updatedAt
        call          Call     @relation(fields: [callId], references: [id])
        callId        String   // Foreign key to Call
        chunkSequence Int      // Order of this chunk within the call's transcript
        embedding     Unsupported("vector") // e.g., vector(1536) for text-embedding-ada-002
        modelName     String   // e.g., "text-embedding-ada-002"

        @@index([callId])
        @@index([callId, chunkSequence])
        @@unique([callId, chunkSequence])
      }
      ```
    *   **Note on `Unsupported("vector")`:** Define as `Unsupported("vector(dimensions)")` (e.g., `Unsupported("vector(1536)")`). Manual adjustment of SQL migration might be needed.

---

## 2. New Services and Modules

*   **`TextChunkingService` (New):**
    *   Location: `apps/api/src/modules/text-chunking/text-chunking.service.ts`
    *   **Responsibilities:**
        *   Method: `chunkText(text: string, chunkSizeTokens: number, overlapTokens: number): string[]`.
        *   Logic: Split text based on token count using a tokenizer (e.g., `tiktoken`).
        *   Strategies: Recursive character splitting, sentence splitting, token splitting.
        *   `chunkSizeTokens`: e.g., 7500 (less than model max).
        *   `overlapTokens`: e.g., 100-200.
    *   **`TextChunkingModule`:**
        *   Location: `apps/api/src/modules/text-chunking/text-chunking.module.ts`
        *   Provides `TextChunkingService`.

*   **`EmbeddingService` (Revised):**
    *   Location: `apps/api/src/modules/embedding/embedding.service.ts`
    *   **Responsibilities:**
        *   Inject `ConfigService` for `OPENAI_API_KEY`.
        *   Initialize OpenAI client.
        *   Method: `async generateEmbedding(textChunk: string, model: string = "text-embedding-ada-002"): Promise<number[]>`.
    *   **`EmbeddingModule`:**
        *   Location: `apps/api/src/modules/embedding/embedding.module.ts`
        *   Provides `EmbeddingService`. Imports `ConfigModule`.

---

## 3. Update `CallProcessingConsumer`

File: `apps/api/src/modules/call-analysis/call-processing.consumer.ts`

*   **Inject Dependencies:**
    *   `EmbeddingService`
    *   `TextChunkingService`
    *   `CallTranscriptEmbeddingRepository`

*   **Modify `process` method:**
    *   **After successful transcription:**
        1.  **Store Full Transcript in Azure Blob Storage:**
            *   Use `storageService`. Filename: `transcripts/${callRecordingId}.txt`.
            *   Upload transcript string (as Buffer).
            *   Log and update `Call` entity with `transcriptUrl`.
        2.  **Chunk the Transcript:**
            *   Call `textChunkingService.chunkText(transcript, CHUNK_SIZE, CHUNK_OVERLAP)`.
            *   `CHUNK_SIZE` (e.g., 7500 tokens), `CHUNK_OVERLAP` (e.g., 200 tokens) from `ConfigService`.
            *   Log number of chunks.
        3.  **Iterate over Chunks for Embeddings:**
            *   Loop through each `chunkText` with `index`.
            *   `embeddingVector = await embeddingService.generateEmbedding(chunkText)`.
            *   `await callTranscriptEmbeddingRepository.create({ callId: callEntity.id, chunkSequence: index, embedding: embeddingVector, modelName: "text-embedding-ada-002" })`.
            *   Log each chunk's processing.

    *   **Error Handling:**
        *   Chunking failure: Log and potentially fail job.
        *   Individual chunk embedding failure: Log error. Initial strategy: fail the entire job.

---

## 4. New `CallTranscriptEmbeddingRepository`

*   Location: `apps/api/src/modules/call-analysis/repositories/call-transcript-embedding.repository.ts`
*   Provides CRUD for `CallTranscriptEmbedding` model.
*   Injects `PrismaService`.

---

## 5. Module Updates

*   **`TextChunkingModule`:**
    *   Declare and export `TextChunkingService`.

*   **`EmbeddingModule`:**
    *   Declare and export `EmbeddingService`.
    *   Import `ConfigModule`.

*   **`CallAnalysisModule`:**
    *   Import `EmbeddingModule` and `TextChunkingModule`.
    *   Add `CallTranscriptEmbeddingRepository` to `providers` and `exports`.

*   **`AppModule`:**
    *   Import `EmbeddingModule` and `TextChunkingModule`.

---

## 6. Configuration

*   Add `OPENAI_API_KEY` to `apps/api/.env`.
*   Add `EMBEDDING_CHUNK_SIZE_TOKENS` (e.g., 7500) and `EMBEDDING_CHUNK_OVERLAP_TOKENS` (e.g., 200) to `apps/api/.env`.
*   Ensure `ConfigService` loads these variables.

---

## 7. Database Migration and Setup

*   **Prisma Migration:**
    *   Run `pnpm --filter api exec prisma migrate dev --name add_transcript_embeddings_and_chunks`.
    *   Review and potentially adjust SQL for `vector` type.
*   **`pgvector` Extension:**
    *   Ensure `CREATE EXTENSION IF NOT EXISTS vector;` is run in PostgreSQL.

---

## Mermaid Diagram: Updated Call Processing Flow (with Chunking)

```mermaid
sequenceDiagram
    participant VoIP as VoIP Provider
    participant CallRecService as CallRecordingService
    participant CallProcQueue as BullMQ (CALL_PROCESSING_QUEUE)
    participant CallProcConsumer as CallProcessingConsumer
    participant StorageService as AzureBlobStorageService
    participant TransService as TranscriptionService
    participant ChunkService as TextChunkingService (New)
    participant EmbService as EmbeddingService
    participant OpenAI as OpenAI API
    participant CallRepo as CallRepository (DB)
    participant EmbRepo as CallTranscriptEmbeddingRepository (DB)
    participant LogRepo as ProcessingLogRepository (DB)

    CallRecService ->>+ CallProcQueue: Add Job (callRecordingId)
    CallProcQueue ->>+ CallProcConsumer: Process Job
    CallProcConsumer ->>+ CallRecService: fetchCallRecording(callRecordingId)
    CallRecService -->>- CallProcConsumer: recordingData
    
    CallProcConsumer ->>+ StorageService: uploadFile(audioBuffer, audioFileName)
    StorageService -->>- CallProcConsumer: audioBlobPath
    CallProcConsumer ->>+ CallRepo: update(callId, { recordingUrl: audioBlobPath })
    
    CallProcConsumer ->>+ TransService: transcribeAudio(audioBase64, mimeType)
    TransService -->>- CallProcConsumer: fullTranscript
    
    CallProcConsumer ->>+ StorageService: uploadFile(fullTranscriptBuffer, transcriptFileName)
    StorageService -->>- CallProcConsumer: transcriptBlobPath
    CallProcConsumer ->>+ CallRepo: update(callId, { transcriptUrl: transcriptBlobPath })

    CallProcConsumer ->>+ ChunkService: chunkText(fullTranscript, chunkSize, overlap)
    ChunkService -->>- CallProcConsumer: transcriptChunks[]

    loop For each chunk in transcriptChunks
        CallProcConsumer ->>+ EmbService: generateEmbedding(chunkText)
        EmbService ->>+ OpenAI: Create Embedding Request for chunk
        OpenAI -->>- EmbService: embeddingVectorForChunk
        EmbService -->>- CallProcConsumer: embeddingVectorForChunk
        
        CallProcConsumer ->>+ EmbRepo: create(callId, chunkSequence, embeddingVectorForChunk, modelName)
    end
    
    %% ... existing analysis steps ...
    
    CallProcConsumer ->>+ LogRepo: Log various steps
    CallProcConsumer -->>- CallProcQueue: Job Completed / Failed
