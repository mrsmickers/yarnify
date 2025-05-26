export interface CallProcessingJobData {
  callRecordingId: string; // This is the uniqueid from the VoIP system
  // blobPath is removed, consumer will fetch and then upload
  // mimeType might be known after fetching, or a default can be assumed by consumer if necessary
  // originalFileName will also be known after fetching
  // Add any other identifiers needed by CallRecordingService.fetchCallRecording if not using defaults
  recordgroup?: string;
  recordid?: string;
}
