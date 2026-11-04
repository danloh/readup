import { createSerialRunner } from '@/utils/concurrency';

/**
 * One import run at a time, app-wide: file/folder imports, the watched-folder
 * auto-scan and feed updates must not interleave. Each builds a lookup index
 * over the same live library array, so overlapping runs re-import the same
 * files as duplicate rows (#5601).
 */
export const enqueueImportRun = createSerialRunner();
