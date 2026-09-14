import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

/** Node-only local Markdown validation. Consumers supply file discovery and content policy. */
export function checkDocumentation({ root, files, requiredFiles = [], restrictToRoot = false,
  malformedLinks = 'throw', anchorError = 'broken local heading anchor', validateSource = () => [] }) {
  if (!['throw', 'report'].includes(malformedLinks)) throw new TypeError('Unknown malformedLinks policy');
  root = resolve(root);
  const errors = [];
  const anchorsByFile = new Map();
  for (const file of requiredFiles) {
    if (!existsSync(join(root, file))) errors.push(`Missing required documentation: ${file}`);
  }
  let localLinkCount = 0;
  for (const file of files) {
    const label = relative(root, file);
    const source = readFileSync(file, 'utf8');
    errors.push(...validateSource(source, label));
    for (const match of withoutFencedCode(source).matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const raw = match[1].trim();
      const target = raw.startsWith('<') ? raw.slice(1, raw.indexOf('>')) : raw.split(/\s+["']/)[0];
      if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) continue;
      localLinkCount++;
      try {
        const hash = target.indexOf('#');
        const path = decodeURIComponent(hash < 0 ? target : target.slice(0, hash));
        const anchor = hash < 0 ? '' : decodeURIComponent(target.slice(hash + 1));
        const destination = path ? resolve(dirname(file), path) : file;
        const relativePath = relative(root, destination);
        if (restrictToRoot && (relativePath === '..' || relativePath.startsWith(`..${sep}`))) {
          errors.push(`${label}: local link leaves repository: ${target}`);
          continue;
        }
        if (!existsSync(destination)) {
          errors.push(`${label}: broken local link ${target}`);
          continue;
        }
        if (!anchor || extname(destination).toLowerCase() !== '.md') continue;
        if (!anchorsByFile.has(destination)) anchorsByFile.set(destination, headingAnchors(readFileSync(destination, 'utf8')));
        if (!anchorsByFile.get(destination).has(anchor)) errors.push(`${label}: ${anchorError} ${target}`);
      } catch (error) {
        if (malformedLinks === 'throw') throw error;
        errors.push(`${label}: invalid local link ${target}`);
      }
    }
  }
  return { errors, markdownFileCount: files.length, localLinkCount };
}

function withoutFencedCode(source) {
  let fence = null;
  return source.split(/\r?\n/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      return '';
    }
    if (marker) { fence = marker[1]; return ''; }
    return line;
  }).join('\n');
}

function headingAnchors(source) {
  const anchors = new Set();
  for (const line of withoutFencedCode(source).split('\n')) {
    const heading = line.match(/^ {0,3}#{1,6}[ \t]+(.+?)\s*$/);
    if (!heading) continue;
    const slug = heading[1].replace(/[ \t]+#+$/, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/<[^>]+>/g, '')
      .toLowerCase().replace(/[^\p{L}\p{M}\p{N}\p{Pc}\s-]/gu, '').replace(/\s/g, '-');
    let anchor = slug;
    for (let suffix = 1; anchors.has(anchor); suffix++) anchor = `${slug}-${suffix}`;
    anchors.add(anchor);
  }
  return anchors;
}
