# Memory Lane design and UX review

Reviewed and updated 8 November 2026. Scope: the web app in `web/`, its installable Home Screen experience, and the generated portable preview. The empty native Xcode directories are not an iOS build.

## Design decisions

Keep the warm green palette, personal photography, and editorial serif headings. Refine the hierarchy through more compact spacing, paper-colored cards, restrained borders, consistent controls, and a quieter prompt card. Desktop keeps a two-column composition; tablet and phone use a single column and bottom navigation. Landscape layouts, 320px screens, long titles, and safe areas receive explicit handling.

## Improvements

- Capture supports an immediate “Start with words instead” shortcut. Optional voice controls sit behind a disclosure, keeping the title and story together.
- Writing prompts carry through to the editor without replacing an existing draft.
- Memories supports search across titles, stories, people, dates, and locations, with a result count and a clearable empty state. Saving clears the filter so the newly saved memory is visible.
- Page changes focus the heading. Re-rendered hint and gallery controls preserve keyboard focus. The style panel closes with Escape and returns focus to its trigger.
- Decorative navigation icons no longer enter accessible button names. Form steps and alternate-theme muted text have stronger contrast.
- Photo inputs, thumbnail controls, and mobile navigation have comfortable touch targets. Long titles wrap within the viewport.
- Installation guidance explains iPhone Home Screen setup, supported desktop installation, offline readiness, and storage boundaries.
- A manifest, app icons, safe-area rules, and a versioned service worker support standalone web app use. Fonts and public app assets are served locally and cached for offline use. Private memories remain in browser storage.

## Verification

See `TEST-REPORT.md` for automated results and limitations. Review screenshots are in `artifacts/ux-review/`: desktop, iPhone-width Today, capture, writing, and installation guidance. Screenshots were inspected after the final layout changes.

## Core outcome correction: story maker

User testing clarified that the expected result is an automatically composed story/video from selected photos, video clips, and an audio description. The manual journal did not fulfill that expectation.

Today now leads to the dedicated story maker. Its three stages are Choose media → Describe it → Story & film. The existing journal remains available, with a link to copy its current draft into the story maker. Video clips, audio descriptions, generated narration, and final films use IndexedDB instead of localStorage. Final stories can be saved into Memories and reopened with their film.

The output is an editable, AI-written factual story and a locally composed montage using the actual selected media. Captions summarize scenes; video source audio is muted under the chosen narrator. Voice options include AI narration and the person’s own recorded description. The app states when media previews/audio leave the device and when generation is unavailable. Live AI generation still needs the server API key; test fixtures are confined to the test code.
