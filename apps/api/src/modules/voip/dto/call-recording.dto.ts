import e from 'express';
import z from 'zod';

export const CallRecordSchema = z.object({
  scustomer: z.string(),
  stype: z.string(),
  status: z.string(),
  callerid_internal: z.string(),
  size: z.string(),
  dtype: z.string(),
  totaltime: z.string(),
  dnumber: z.string(),
  dnumber_display: z.string(),
  spresent: z.union([z.literal(0), z.literal(1)]),
  migrated: z.string(),
  callid: z.string(),
  machine: z.union([z.literal(0), z.literal(1)]),
  ctype: z.string(),
  name: z.string(),
  uniqueid: z.string(),
  data: z.string().optional(), // This will be the base64 audio data
  path: z.string(),
  asteriskid: z.string(),
  stale: z.string(),
  end: z.string(),
  dcustomer: z.string(),
  recordid: z.string(),
  cnumber: z.string(),
  recordgroup: z.string(),
  talktime: z.string(),
  mimetype: z.string(),
  snumber: z.string(),
  snumber_display: z.string(),
  start: z.string(),
  complete: z.union([z.literal(0), z.literal(1)]),
  expires: z.string(),
});

export type CallRecord = z.infer<typeof CallRecordSchema>;

export const CallRecordResponseSchema = z.object({
  data: CallRecordSchema,
});

export const ListCallRecordingsSchema = z.object({
  data: z.array(CallRecordSchema),
});
export type ListCallRecordings = z.infer<typeof ListCallRecordingsSchema>;

export type CallRecordResponse = z.infer<typeof CallRecordResponseSchema>;

export const GetCallRecordingsQuerySchema = z.object({
  startDate: z
    .string()
    .datetime({
      message: 'Invalid date string format. Expected ISO 8601 format.',
    })
    .optional(),
  endDate: z
    .string()
    .datetime({
      message: 'Invalid date string format. Expected ISO 8601 format.',
    })
    .optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export type GetCallRecordingsQueryDto = z.infer<
  typeof GetCallRecordingsQuerySchema
>;
