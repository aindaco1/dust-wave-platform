# `@dustwave/media-core`

Runtime-neutral site-media catalog mechanics and audio processor contracts.
Content, transforms, processing placement, storage, approval, and publication
remain consumer-owned.

## Audio contracts

The source-audio QC contract contains deterministic structures shared by the
Podcast Worker and its owner-controlled FFmpeg processor: policy, processor
manifest, normalized measurements, findings, and report evidence.

The public entries also include [audio enhancement](src/audio-enhancement.d.ts),
[enhancement derivatives](src/audio-enhancement-derivative.d.ts),
[delivery audio and player peaks](src/delivery-audio.d.ts), and
[source-audio QC](src/audio-qc.d.ts). They validate manifests and result evidence;
consumers own the processing and publication workflow.

## Site catalog and paths

The media site-catalog entry owns only bounded repository-path normalization,
public paths, labels, media type and derivative detection, responsive-image and
video derivative planning, manifest normalization, and injected placement
budgets. Traversal, control characters, oversized paths, and excessive
known-path sets fail closed. Store and Pool inject product/campaign scope,
entity slugs, WebM-audio compatibility, broken-reference shape, budgets, and
fallback placement; they retain all content, filesystem access, transforms,
admin routes, publication, storage, credentials, and deployment.

The [image-dimensions entry](src/image-dimensions.js) supplies image-header
dimension detection without owning media transformation.

## Framehash evidence

The `frame-hash` entry exports `normalizeFrameHashAspectRatios(text)`. It reduces
FFmpeg `#sar` fractions such as `11811/11811` to `1/1` and preserves all other
framehash text. Missing or malformed aspect ratios and inputs over 8 MiB throw
`TypeError`. Consumers own the decoder, pixel format, cryptographic hash,
comparison, optimizer, and publication decision. Normalization never approves
a changed pixel, frame duration, dimension, or actual aspect ratio.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.

`readPngDimensions(file)` reads a 33-byte prefix from PNG Blobs and returns dimensions only for a PNG signature and a leading IHDR chunk of the expected length. Unsupported, truncated or unrecognized headers return null. I/O errors propagate. Use this for early size rejection. Files that pass still require the consumer's normal decode and validation.

The `image-dimensions` entry also exports `detectImageType(bytes)`. It inspects up to twelve bytes in a Uint8Array view and returns the JPEG, PNG or WebP MIME type, or null. Keep file-size limits, extension policy and full decoding in the caller.
