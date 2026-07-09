import { invoke, Channel } from '@tauri-apps/api/core';
import { isWebAppPlatform } from '@/services/environment';
import { AppService } from '@/types/system';

export type UploadMethod = 'POST' | 'PUT';

export const enum UploadFileError {
  Unauthorized = 'Unauthorized access',
  DownloadFailed = 'File download failed',
}

export interface ProgressPayload {
  progress: number;
  total: number;
  transferSpeed: number;
}

export type ProgressHandler = (progress: ProgressPayload) => void;

export const createProgressHandler = (
  totalFiles: number,
  completedFilesRef: { count: number },
  onProgress?: ProgressHandler,
) => {
  return (progress: ProgressPayload) => {
    const fileProgress = progress.progress / progress.total;
    const overallProgress = ((completedFilesRef.count + fileProgress) / totalFiles) * 100;

    if (onProgress) {
      onProgress({
        progress: overallProgress,
        total: 100,
        transferSpeed: progress.transferSpeed,
      });
    }
  };
};

export interface ProgressThrottle {
  /** Record a progress payload, emitting at most once per interval. */
  push: (progress: ProgressPayload) => void;
  /** Emit any pending payload immediately (e.g. when the transfer finishes). */
  flush: () => void;
  /** Drop any pending payload and clear the trailing timer. */
  cancel: () => void;
}

/**
 * Coalesce high-frequency progress emissions to at most one per `intervalMs`
 * (leading + trailing edges). Web and native download streams call onProgress
 * once per chunk, often as a dense microtask burst for already-buffered sources
 * (`while (true) { await reader.read(); onProgress(...) }`), and `transferSpeed`
 * is recomputed from wall-clock time on every call. Emitting each one churns the
 * transfer store per chunk and sustains a synchronous React update storm past
 * the nested-update limit. Throttling caps store writes and
 * defers the trailing emit to a macrotask, so the render fan-out cannot loop.
 */
export const createProgressThrottle = (
  emit: (progress: ProgressPayload) => void,
  intervalMs: number,
): ProgressThrottle => {
  let lastEmit = Number.NEGATIVE_INFINITY;
  let pending: ProgressPayload | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const fire = () => {
    timer = null;
    if (!pending) return;
    const payload = pending;
    pending = null;
    lastEmit = Date.now();
    emit(payload);
  };

  return {
    push: (progress) => {
      pending = progress;
      const elapsed = Date.now() - lastEmit;
      if (elapsed >= intervalMs) {
        fire();
      } else if (timer === null) {
        timer = setTimeout(fire, intervalMs - elapsed);
      }
    },
    flush: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      fire();
    },
    cancel: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
  };
};

export const webUpload = (
  file: File, 
  uploadUrl: string, 
  onProgress?: ProgressHandler,
  headers?: Record<string, string>,
) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    
    if (headers) {
      for (const [key, val] of Object.entries(headers)) {
        console.log(`${key}: ${val}`);
        xhr.setRequestHeader(key, val);
      }
    }

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress({
          progress: event.loaded,
          total: event.total,
          transferSpeed: event.loaded / ((Date.now() - startTime) / 1000),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));

    xhr.send(file);
  });
};

export const webDownload = async (
  downloadUrl: string,
  onProgress?: ProgressHandler,
  headers?: Record<string, string>,
) => {
  const response = await fetch(downloadUrl, {
    method: 'GET',
    headers: headers ? headers : undefined,
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(UploadFileError.Unauthorized);
    }
    throw new Error(UploadFileError.DownloadFailed);
  }

  const responseHeaders = Object.fromEntries(response.headers.entries());
  const contentLength =
    response.headers.get('Content-Length') || response.headers.get('X-Content-Length');

  if (!contentLength && onProgress) {
    throw new Error('Cannot track progress: Content-Length missing');
  }
    
  const totalSize = parseInt(contentLength || '0', 10);
  let receivedSize = 0;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];

  const startTime = Date.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedSize += value.length;

    if (onProgress) {
      onProgress({
        progress: receivedSize,
        total: totalSize,
        transferSpeed: receivedSize / ((Date.now() - startTime) / 1000),
      });
    }
  }

  return { headers: responseHeaders, blob: new Blob(chunks as BlobPart[]) };
};

export const tauriUpload = async (
  url: string,
  filePath: string,
  method: UploadMethod,
  progressHandler?: ProgressHandler,
  headers?: Map<string, string>,
): Promise<string> => {
  const ids = new Uint32Array(1);
  window.crypto.getRandomValues(ids);
  const id = ids[0];

  const onProgress = new Channel<ProgressPayload>();
  if (progressHandler) {
    onProgress.onmessage = progressHandler;
  }

  return await invoke('upload_file', {
    id,
    url,
    filePath,
    method,
    headers: headers ?? {},
    onProgress,
  });
};

export const tauriDownload = async (
  url: string,
  filePath: string,
  progressHandler?: ProgressHandler,
  headers?: Record<string, string>,
  body?: string,
  singleThreaded?: boolean,
  skipSslVerification?: boolean,
): Promise<Record<string, string>> => {
  const ids = new Uint32Array(1);
  window.crypto.getRandomValues(ids);
  const id = ids[0];

  const onProgress = new Channel<ProgressPayload>();
  if (progressHandler) {
    onProgress.onmessage = progressHandler;
  }

  const responseHeaders = await invoke<Record<string, string>>('download_file', {
    id,
    url,
    filePath,
    headers: headers ?? {},
    onProgress,
    body,
    singleThreaded,
    skipSslVerification,
  });
  return responseHeaders;
};

type DownloadFileParams = {
  appService: AppService;
  dst: string;
  url?: string;
  headers?: Record<string, string>;
  singleThreaded?: boolean;
  skipSslVerification?: boolean;
  onProgress?: ProgressHandler;
};

// for download opds
export const downloadFile = async ({
  appService,
  dst,
  url,
  headers,
  singleThreaded,
  skipSslVerification,
  onProgress,
}: DownloadFileParams) => {
  try {
    let downloadUrl = url;
    if (!downloadUrl) {
      throw new Error('No download URL available');
    }

    if (isWebAppPlatform()) {
      const { headers: responseHeaders, blob } = await webDownload(
        downloadUrl,
        onProgress,
        headers,
      );
      await appService.writeFile(dst, 'None', await blob.arrayBuffer());
      return responseHeaders;
    } else {
      return await tauriDownload(
        downloadUrl,
        dst,
        onProgress,
        headers,
        undefined,
        singleThreaded,
        skipSslVerification,
      );
    }
  } catch (error) {
    console.error(`File '${dst}' download failed:`, error);
    throw error;
  }
};
