# Memory Lane story-maker validation

8 November 2026. The story maker extends the responsive web app with actual photo/video input, audio-description input, an AI integration, and local narrated-video export. **The live AI service is not configured or tested: no server API key is present.**

## Current coverage

- **33/33 state/server tests passed:** the previous 24 persistence checks plus 9 generation/backend checks. Provider tests use explicit mock transports, not live API calls.
- **90/90 Playwright cases passed:** the previous 60 app/PWA cases plus 6 story-maker scenarios in five configurations (desktop, tablet, 390px phone, 320px phone, and WebKit iPhone emulation).
- Story-maker fixture tests send actual uploaded images and an actual short MP4 through the import and frame-extraction code. They verify selection order, draft recovery, audio-description payloads, editable output, narrator choice, downloads, saving, and reopening from Memories.
- The video-export journey encodes a real downloadable file, verifies its video dimensions, and decodes its audio to check that an audible track is present. Speech/AI responses in this test are deliberately mocked; the audio is a synthetic test tone.
- Automated Axe checks cover the story maker’s media, description, and result screens, in addition to the original app checks. No automated WCAG A/AA violations in audited states does not constitute full accessibility certification.
- Server tests cover validated image/frame input, transcription before story generation, output-to-media matching, missing credentials, provider errors, PCM-to-WAV narration assembly, connection failure, origin checks, content types, and private-file access prevention.

## Findings fixed during validation

- Decorative action glyphs were entering accessible names.
- WebKit could not persist the initial Blob-backed media writes in this environment. Media persistence now serializes bytes and MIME type; photo/video recovery and archived film reopening pass in WebKit.
- Narrow WebKit layouts needed explicit minimum-width handling for cards, fieldsets, and file inputs.
- Story edits invalidate old narration and video so the user cannot export a stale voice track.
- Mock-provider browser tests block service workers to ensure fixtures are consistently intercepted. Original PWA/offline tests continue to run with service workers enabled.

## Boundaries and remaining checks

Live Responses, transcription, and Realtime narration have not been exercised against an OpenAI account. Their request/response handling is covered with test fixtures. A configured key and a real generation run are required to verify model availability, story grounding, transcription quality, voice quality, and latency.

Actual iPhone installation, Photos/Files providers, HEIC decoding, real microphone recording, keyboard/permission behavior, and long video exports still need a device check. WebKit emulation does not prove those OS integrations. Firefox remains optional and unvalidated because its downloaded binary fails to find its profile directory here.

Narrated montage export uses supported browser codecs and runs in real time. Current Chrome and WebKit produce a video with audio in tests; the output is MP4 or WebM according to browser support. Source clips are muted and may loop/trim. The renderer stops if the tab is hidden rather than silently exporting frozen frames.

Memories and films remain local to a browser/app context. There is no cross-device sync or film backup restore. Download films separately; the legacy JSON backup contains story text and cover images, not source-video/film bytes stored in IndexedDB.

## Reproduce

```sh
npm install
npx playwright install chromium webkit
npm run test:all
```

`npm run preview` starts the Node app/server. It reads `.env` when present. The existing HTTPS Tailscale proxy continues pointing to port 4173. No API key is needed for automated fixture tests.
