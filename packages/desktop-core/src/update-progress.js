/** Tauri's download event accounting. Presentation and install/restart stay with the app. */
export function createUpdateProgress() {
  let downloadedBytes = 0;
  let totalBytes = 0;
  return event => {
    if (event?.event === 'Started') {
      downloadedBytes = 0;
      totalBytes = Number(event.data?.contentLength) || 0;
    } else if (event?.event === 'Progress') {
      downloadedBytes += Number(event.data?.chunkLength) || 0;
    }
    return { downloadedBytes, totalBytes,
      percentage: totalBytes > 0 ? Math.min(100, Math.floor(downloadedBytes / totalBytes * 100)) : 0 };
  };
}
