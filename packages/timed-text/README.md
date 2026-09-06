# `@dustwave/timed-text`

Bounded English/Spanish timed-text contracts for consumer transcript adapters.
Provider calls, model inference, storage, review, speaker identity, benchmark
approval, rendering, and publication remain consumer-owned.

## Transcription and chunking

The transcription contract accepts only bounded monotonic provider segments,
normalizes generated text as untrusted plain text, and never manufactures word
timing or speaker identity. Its large-source extension deterministically chooses
safe silence boundaries (or duration fallbacks), binds processor manifests to
immutable source/output evidence, and merges source-relative segment timing with
conservative overlap removal. It still never manufactures word timing or
speaker identity.

## Alignment evidence

The alignment extension deterministically projects reviewed
cues to stable lexical word IDs and verifies exact runner identity, canonical
result digests, explained omissions, cue/source timing, provenance, and
resource evidence. It validates candidate evidence but cannot declare an
adapter launch-ready; Podcast retains the bilingual human benchmark gate.

## Recognition confidence

The [confidence entry](src/confidence.d.ts) compiles local recognition-token
scores into cue evidence using the minimum assigned spoken-token score.
Punctuation-only tokens are excluded; tokens crossing a cue boundary are
assigned to the cue with greatest overlap. Cues without assigned spoken-token
evidence receive `unavailable` and a null score. Token text is not retained in
the result. Compilation validates bounded cue/token shapes, timing, scores,
and threshold policy and throws `TypeError` for invalid input. It performs no
model inference, network request, storage operation, or editorial approval.

## Editorial grouping, dialogue, and lineage

The editorial extensions normalize English display text, regroup timed words,
and reflow adjacent same-speaker dialogue under bounded readability policies.
They validate immutable review lineage and never rewrite dialogue, infer a
speaker, cross an acoustic speaker boundary, call a model, or access a network.

## Presentation and chapters

The presentation planner derives measured one- or two-line visual cues from
aligned words while preserving source IDs, timings, cue lineage, and speaker
boundaries. The chapter planner divides reviewed cues into bounded topic or
question context windows, then validates caller-supplied titles against exact
cue/word anchors before formatting YouTube or Markdown chapter lists. It does
not generate titles, infer boundaries, access storage, or call a model.

## Reference

See the [public exports](package.json), [source contracts](src/), and
[behavior tests](test/). Follow the shared
[consumer adoption guide](../../docs/consumer-adoption.md) when updating a pin.
