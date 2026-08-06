export const MEDIA_RESPONSIVE_WIDTHS = Object.freeze([320, 480, 640, 960, 1600]);
export const MEDIA_MANIFEST_VERSION = 1;

const IMAGE_EXTENSIONS = new Set(['gif', 'jpg', 'jpeg', 'png', 'webp', 'avif']);
const RESPONSIVE_IMAGE_EXTENSIONS = new Set(['gif', 'jpg', 'jpeg', 'png']);
const VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4', 'webm']);
const SOURCE_VIDEO_EXTENSIONS = new Set(['m4v', 'mov', 'mp4']);
const BASE_AUDIO_EXTENSIONS = ['aac', 'm4a', 'mp3', 'ogg', 'wav'];
const MAX_REPO_PATH_LENGTH = 2048;
const MAX_KNOWN_PATHS = 100_000;

export function normalizeMediaRepoPath(value = '') {
  const raw = String(value || '');
  if (raw.length > MAX_REPO_PATH_LENGTH || /[\u0000-\u001f\u007f]/.test(raw)) return '';
  const normalized = raw
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
  if (normalized.split('/').some((part) => part === '.' || part === '..')) return '';
  return normalized;
}

export function mediaPublicPath(value = '') {
  const repoPath = normalizeMediaRepoPath(value);
  return repoPath.startsWith('assets/') ? `/${repoPath}` : '';
}

export function mediaPathExtension(value = '') {
  const filename = normalizeMediaRepoPath(value).split('/').pop() || '';
  const index = filename.lastIndexOf('.');
  return index >= 0 ? filename.slice(index + 1).toLowerCase() : '';
}

export function mediaPathLabel(value = '') {
  const filename = normalizeMediaRepoPath(value).split('/').pop() || '';
  return filename
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/-\d+$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function responsiveImageDerivativeInfo(value = '') {
  const repoPath = normalizeMediaRepoPath(value);
  const match = repoPath.match(/^(.*)-(\d+)\.webp$/i);
  if (!match) return null;
  const width = Number(match[2]);
  return MEDIA_RESPONSIVE_WIDTHS.includes(width) ? { basePath: match[1], width } : null;
}

export function probableResponsiveImageSourcePaths(value = '') {
  const info = responsiveImageDerivativeInfo(value);
  return info
    ? ['png', 'jpg', 'jpeg', 'gif'].map((extension) => `${info.basePath}.${extension}`)
    : [];
}

export function probableVideoSourcePaths(value = '') {
  const repoPath = normalizeMediaRepoPath(value);
  if (mediaPathExtension(repoPath) !== 'webm' || !repoPath.startsWith('assets/videos/')) return [];
  const base = repoPath.slice(0, -'.webm'.length);
  return ['mp4', 'mov', 'm4v'].map((extension) => `${base}.${extension}`);
}

function knownPathSet(value) {
  if (value instanceof Set) {
    if (value.size > MAX_KNOWN_PATHS) throw new RangeError('Known media paths exceed the supported limit');
    return value;
  }
  const values = Array.isArray(value) ? value : [];
  if (values.length > MAX_KNOWN_PATHS) throw new RangeError('Known media paths exceed the supported limit');
  return new Set(values);
}

export function createMediaCatalog({
  scopeForPath,
  entitySlugForPath = () => '',
  entitySlugKey = 'entitySlug',
  placementBudgets,
  defaultPlacement,
  includeWebmAudio = true,
  includeBrokenReferences = false
} = {}) {
  if (typeof scopeForPath !== 'function' || typeof entitySlugForPath !== 'function') {
    throw new TypeError('Media scope and entity-slug policies must be functions');
  }
  const slugKey = String(entitySlugKey || '').trim();
  if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(slugKey)) {
    throw new TypeError('Media entity slug key is invalid');
  }
  if (!placementBudgets || typeof placementBudgets !== 'object' || Array.isArray(placementBudgets)) {
    throw new TypeError('Media placement budgets are required');
  }
  const fallbackPlacement = String(defaultPlacement || '').trim().toLowerCase();
  if (!placementBudgets[fallbackPlacement]) throw new TypeError('Default media placement is missing');
  const audioExtensions = new Set([
    ...BASE_AUDIO_EXTENSIONS,
    ...(includeWebmAudio ? ['webm'] : [])
  ]);

  function classifyMediaPath(value = '', knownPaths = null) {
    const repoPath = normalizeMediaRepoPath(value);
    const extension = mediaPathExtension(repoPath);
    let type = '';
    if (IMAGE_EXTENSIONS.has(extension) && repoPath.startsWith('assets/images/')) type = 'image';
    else if (VIDEO_EXTENSIONS.has(extension) && repoPath.startsWith('assets/videos/')) type = 'video';
    else if (audioExtensions.has(extension) && repoPath.startsWith('assets/audio/')) type = 'audio';
    if (!type) return null;

    const paths = knownPathSet(knownPaths);
    const responsive = type === 'image' ? responsiveImageDerivativeInfo(repoPath) : null;
    const imageSourcePath = responsive
      ? probableResponsiveImageSourcePaths(repoPath).find((candidate) => paths.has(candidate)) || ''
      : '';
    const videoSourcePath = type === 'video' && extension === 'webm'
      ? probableVideoSourcePaths(repoPath).find((candidate) => paths.has(candidate)) || ''
      : '';
    const derivative = Boolean(responsive && imageSourcePath) || Boolean(videoSourcePath);
    return {
      path: repoPath,
      publicPath: mediaPublicPath(repoPath),
      name: repoPath.split('/').pop() || '',
      label: mediaPathLabel(repoPath),
      extension,
      type,
      role: derivative ? 'derived' : 'source',
      sourcePath: imageSourcePath || videoSourcePath,
      derivativeWidth: responsive?.width || null,
      scope: scopeForPath(repoPath),
      [slugKey]: entitySlugForPath(repoPath)
    };
  }

  function expectedMediaDerivativePaths(value = '', metadata = {}) {
    const classified = classifyMediaPath(value);
    if (!classified || classified.role !== 'source') return [];
    if (classified.type === 'image' && RESPONSIVE_IMAGE_EXTENSIONS.has(classified.extension)) {
      const width = Math.max(0, Number(metadata.width || 0) || 0);
      const base = classified.path.slice(0, -(classified.extension.length + 1));
      return MEDIA_RESPONSIVE_WIDTHS
        .filter((targetWidth) => !width || width > targetWidth)
        .map((targetWidth) => `${base}-${targetWidth}.webp`);
    }
    if (classified.type === 'video' && SOURCE_VIDEO_EXTENSIONS.has(classified.extension)) {
      return [`${classified.path.slice(0, -(classified.extension.length + 1))}.webm`];
    }
    return [];
  }

  function normalizeMediaManifest(value = {}) {
    if (!value || Number(value.version) !== MEDIA_MANIFEST_VERSION || !Array.isArray(value.assets)) {
      return {
        version: MEDIA_MANIFEST_VERSION,
        assets: [],
        ...(includeBrokenReferences ? { brokenReferences: [] } : {})
      };
    }
    return {
      version: MEDIA_MANIFEST_VERSION,
      policy: value.policy && typeof value.policy === 'object' ? value.policy : {},
      ...(includeBrokenReferences
        ? { brokenReferences: Array.isArray(value.brokenReferences) ? value.brokenReferences : [] }
        : {}),
      assets: value.assets.filter((asset) => asset && typeof asset === 'object' && asset.path)
    };
  }

  function mediaPlacementBudget(placement = '') {
    const normalized = String(placement || '').trim().toLowerCase();
    return placementBudgets[normalized] || placementBudgets[fallbackPlacement];
  }

  return Object.freeze({
    classifyMediaPath,
    expectedMediaDerivativePaths,
    mediaPlacementBudget,
    normalizeMediaManifest
  });
}
