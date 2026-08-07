import fs from 'node:fs/promises';
import path from 'node:path';

function isInside(basePath, targetPath, { allowBase = false } = {}) {
  const relative = path.relative(basePath, targetPath);
  return (allowBase && relative === '')
    || (relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function requiredPath(value, label) {
  if (typeof value !== 'string' || value.trim() === '' || /[\u0000\r\n]/u.test(value)) {
    throw new TypeError(`${label} must be a non-empty path string`);
  }
  return value;
}

export function resolveProductVideoPathPolicy({ cwd = process.cwd(), workRoot, targetPath }) {
  const absoluteCwd = path.resolve(requiredPath(cwd, 'cwd'));
  const absoluteWorkRoot = path.resolve(absoluteCwd, requiredPath(workRoot, 'workRoot'));
  const absoluteTarget = path.resolve(absoluteCwd, requiredPath(targetPath, 'targetPath'));
  if (!isInside(absoluteCwd, absoluteWorkRoot)) {
    throw new RangeError('workRoot must be a child of cwd');
  }
  if (!isInside(absoluteWorkRoot, absoluteTarget)) {
    throw new RangeError('targetPath must be a child of workRoot');
  }
  return { cwd: absoluteCwd, workRoot: absoluteWorkRoot, targetPath: absoluteTarget };
}

export async function createProductVideoOutputDirectory(policy) {
  const resolved = resolveProductVideoPathPolicy(policy);
  await fs.mkdir(resolved.workRoot, { recursive: true });
  const realCwd = await fs.realpath(resolved.cwd);
  const realWorkRoot = await fs.realpath(resolved.workRoot);
  if (!isInside(realCwd, realWorkRoot)) {
    throw new RangeError('workRoot resolves outside cwd');
  }

  const parent = path.dirname(resolved.targetPath);
  await fs.mkdir(parent, { recursive: true });
  const realParent = await fs.realpath(parent);
  if (!isInside(realWorkRoot, realParent, { allowBase: true })) {
    throw new RangeError('targetPath parent resolves outside workRoot');
  }

  try {
    await fs.mkdir(resolved.targetPath);
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error('targetPath already exists; product-video output is never overwritten or recursively deleted');
    }
    throw error;
  }
  return resolved.targetPath;
}

export async function resolveExistingProductVideoDirectory(policy) {
  const resolved = resolveProductVideoPathPolicy(policy);
  const realCwd = await fs.realpath(resolved.cwd);
  const realWorkRoot = await fs.realpath(resolved.workRoot);
  const realTarget = await fs.realpath(resolved.targetPath);
  if (!isInside(realCwd, realWorkRoot) || !isInside(realWorkRoot, realTarget)) {
    throw new RangeError('existing target resolves outside the allowed workRoot');
  }
  const stat = await fs.stat(realTarget);
  if (!stat.isDirectory()) {
    throw new TypeError('existing target must be a directory');
  }
  return realTarget;
}
