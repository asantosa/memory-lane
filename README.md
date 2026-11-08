# Memory Lane

An installable, responsive web app for iPhone, mobile browsers, tablets, and desktop/laptop browsers.

An iPhone-first web prototype for collecting photo memories, telling their stories, and revisiting them gently. This is a design and usability prototype, not a native iOS app or a medical treatment.

## Run and test

Use Node.js 22.9+ and Python 3 (for the portable-preview build). For automated browser and accessibility tests, install the development dependencies and browsers:

```sh
npm install
npx playwright install chromium webkit
npm run preview
# In another terminal:
npm run test:all
npm run build:preview
```

Local preview: http://127.0.0.1:4173. Add `?demo=1` to start the guided walkthrough directly. `prototypes/memory-lane-preview.html` is the generated single-file preview; the HTTP preview is recommended for device testing and storage behavior.

## Create a story or narrated video

Open **Create a memory story** on Today, or `/studio.html`. The story maker accepts up to 12 photos/video clips (100 MB total; clips up to 60 seconds each), with reorder/removal controls. Record or upload an audio description, type context, or do both. Generate an editable story and scene captions; review the facts, then choose AI narration or your recorded voice and create a downloadable video montage. Portrait and landscape exports are supported. Source clip audio is muted; clips loop/trim to fit the narration. Video export runs in real time in the visible browser window.

The media pipeline and video encoder run in the browser. Draft media, voice tracks, and saved films use IndexedDB; saved story text and a cover also appear in the existing Memories collection. **Save story to Memories** archives the current story and film for reopening. Download story text, narration, and video separately. The old JSON backup includes the story/cover but does not embed the IndexedDB source videos or film: download those video files separately.

### Enable live AI generation

The app now has a Node backend for story generation, recorded-description transcription, and AI narration. There is **no API key configured in this workspace**, so live generation is not enabled yet. Browser integration tests use explicit response/audio fixtures; they do not prove live model quality or account access.

1. Create a root `.env` from `.env.example` and set `OPENAI_API_KEY` there. Keep it server-side; never paste a secret into the UI or place it in `web/`.
2. Restart `npm run preview` to load the environment. The server binds only to `127.0.0.1:4173`; the existing Tailscale proxy can continue serving it over HTTPS.
3. Open `/studio.html`, select your media, add a description, and choose **Generate story**. Live requests use the account’s API usage/billing.

Optional server model overrides are documented in `.env.example`. The current integration uses Responses with image inputs and structured output, file transcription, and Realtime audio narration. No API secrets are sent to the browser. The OpenAI Developers plugin can help set up the server API connection.

**AI processing:** Generate story sends resized photo previews, three sampled frames per video clip, typed context, and any recorded description to OpenAI. Original video files stay in the browser. Create AI narration sends the reviewed story text for speech generation. The film is composed locally. This differs from the manual journal flow below, which keeps its own recordings local unless you explicitly copy them into the story maker and generate.

**Offline:** media selection, draft editing, existing story/narration playback, and local video export can work offline after caching. AI story writing, transcription, and AI narration require internet access and a configured API key. A first visit must be online. Actual iPhone Home Screen behavior, device codecs, microphone permission prompts, and long exports still need on-device testing.

## Manual journal experience

- Three personalities: Storykeeper, Quiet Mind, Explorer.
- Guided demo: choose a source, select sample photos, edit the fictional story/date/place, then revisit with hints and story reveal. It does not write to saved memories.
- Three-step capture: photos → story → review. Up to 12 photos per memory; choose a cover and remove photos before saving.
- Import from Photos, multiple files, drag/drop, or folders in supported desktop browsers. iPhone users use their own Photos or Files picker. Google Drive can appear through the Files provider; Google Photos pictures must be downloaded/exported first. No direct Google account integration exists.
- Optional people, date/year, and location. Freeform dates allow uncertainty.
- Browser speech dictation for story/date/place where supported; otherwise keyboard dictation or typing remains available. Dictation may use the browser's remote speech service.
- Optional local voice notes, up to 60 seconds, with playback and removal. No application-server upload occurs.
- Local draft recovery, memory editing, multi-photo revisit, and JSON backup export (including photos, voice notes, date, and location).

## Storage and privacy

In the manual journal, photos are resized and JPEG-encoded locally; original files are unchanged. Memories and drafts use localStorage, with a small browser-managed quota. Failed saves retain the draft where storage allows. Export regularly; browser data clearing removes local memories. There is no sync or backup-restore UI. Localhost, a Tailscale URL, and each device have separate storage. Existing legacy storage keys are retained for compatibility.

The two sample photos were generated with the built-in image generation tool. Their story and people are fictional. See `web/assets/DEMO.md` for prompts and provenance.

## iPhone through Tailscale

The user configured private Serve on HTTPS port 8443:

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --bg --https=8443 http://127.0.0.1:4173
```

Replace the example address with the exact HTTPS URL printed by Tailscale in iPhone Safari with Tailscale connected. Keep the Mac awake and the local server running. Microphone features require a secure context such as that HTTPS address. Tailnet access follows the existing Tailscale policy.

Stop this specific proxy with:

```sh
/Applications/Tailscale.app/Contents/MacOS/Tailscale serve --https=8443 off
```

## Use in a browser or as an app

The layout adapts automatically: wider screens show desktop navigation and a two-column Today view; smaller screens use touch-friendly bottom navigation. iPhone landscape and device safe areas are supported.

- **Desktop/laptop:** open http://127.0.0.1:4173 on your computer, or the HTTPS address below from a connected device. Installation is optional.
- **iPhone/iPad app:** open https://your-device.your-tailnet.ts.net:8443 in Safari with Tailscale connected, tap Share → Add to Home Screen, enable Open as Web App if shown, then Add. Launch the Memory Lane icon for a standalone app window. This is a Home Screen web app, not an App Store/native iOS build.
- **Other supported browsers:** use their install menu/address-bar option when offered. The “Use as an app” footer opens installation guidance and shows offline readiness.
- **Offline:** after the app reports it is ready, its shell, bundled fonts, sample photos, saved memories, and drafts work offline. Speech dictation can still require a connection. Initial installation and microphone access require HTTPS or localhost.

Memories remain local to the browser/app that created them. There is no automatic sync between devices, browsers, or installed app contexts. Download a backup before switching; backup restore is not yet implemented.

The service worker caches only public app assets. Increment the cache version in `web/sw.js` whenever changing the app shell; an updated worker activates after existing app tabs/windows close. Serve the entire `web/` directory from one HTTPS origin. The portable single-file preview does not install a service worker.

Install instructions follow [Apple’s Home Screen web app guidance](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios). Web app installation varies by browser; see [MDN’s installability guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Review status

See `UX-REVIEW.md` and `TEST-REPORT.md` for the current design review, automated coverage, and remaining on-device checks. Firefox is an optional project (`TEST_FIREFOX=1 npx playwright test --project=desktop-firefox`); the downloaded Firefox binary currently fails to create its profile in this environment.
