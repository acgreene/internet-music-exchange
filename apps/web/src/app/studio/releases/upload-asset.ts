import type { ApiClient, ApiResult } from '@ime/api-client';
import { uploadFile } from '@ime/client-data';
import {
  ApiError,
  ApiErrorKind,
  type ConfirmAssetRequest,
  type ReleaseAssetResponse,
} from '@ime/models';

/**
 * Upload a file as a release asset: ask for a target, send the file, and
 * record it.
 */
export async function uploadAsset(
  api: ApiClient,
  releaseId: string,
  file: File,
  details: Omit<ConfirmAssetRequest, 'objectKey'>,
  onProgress: (fraction: number) => void,
): Promise<ApiResult<ReleaseAssetResponse>> {
  const target = await api.releases.createAssetUpload(
    releaseId,
    details.kind,
    file.type,
  );
  if (!target.ok) return target;
  try {
    await uploadFile(target.data.uploadUrl, file, onProgress);
  } catch (error) {
    return failed(error);
  }
  return api.releases.confirmAsset(releaseId, {
    ...details,
    objectKey: target.data.objectKey,
  });
}

/**
 * Upload a track's audio and record it, with its length when the browser
 * can read it.
 */
export async function uploadTrackAudio(
  api: ApiClient,
  releaseId: string,
  trackId: string,
  file: File,
  durationMs: number | null,
  onProgress: (fraction: number) => void,
): Promise<ApiResult<unknown>> {
  const target = await api.releases.createAudioUpload(
    releaseId,
    trackId,
    file.type,
  );
  if (!target.ok) return target;
  try {
    await uploadFile(target.data.uploadUrl, file, onProgress);
  } catch (error) {
    return failed(error);
  }
  return api.releases.confirmAudio(
    releaseId,
    trackId,
    target.data.objectKey,
    durationMs,
  );
}

function failed(error: unknown): ApiResult<never> {
  const message = error instanceof Error ? error.message : 'The upload failed.';
  return {
    ok: false,
    error: new ApiError(ApiErrorKind.Network, null, message),
  };
}
