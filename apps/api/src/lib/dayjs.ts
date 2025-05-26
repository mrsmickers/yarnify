import * as dayjs from 'dayjs';
import * as relativeTime from 'dayjs/plugin/relativeTime';
// StorageService and CallProcessingProducerService are now used by CallRecordingService

dayjs.extend(relativeTime);

export { dayjs };
