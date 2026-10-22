/**
 * Send a file to a presigned upload URL, reporting progress from 0 to 1.
 *
 * @throws Error when the upload fails or storage refuses it.
 */
export function uploadFile(
  uploadUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // XMLHttpRequest, since fetch cannot report upload progress
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    request.setRequestHeader('Content-Type', file.type);
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });
    request.addEventListener('load', () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`The upload was refused (${request.status}).`)),
    );
    request.addEventListener('error', () =>
      reject(
        new Error('The upload did not go through. Check your connection.'),
      ),
    );
    request.send(file);
  });
}

/**
 * How long an audio file plays, read by the browser, or null when it cannot
 * tell (the worker measures it later).
 */
export function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (durationMs: number | null) => {
      URL.revokeObjectURL(url);
      resolve(durationMs);
    };
    audio.addEventListener('loadedmetadata', () =>
      done(
        Number.isFinite(audio.duration)
          ? Math.round(audio.duration * 1000)
          : null,
      ),
    );
    audio.addEventListener('error', () => done(null));
    audio.preload = 'metadata';
    audio.src = url;
  });
}
