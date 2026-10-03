# Mobile Prototype Agent Guide

## Prototype Instructions

In ChatGPT Work Mode, run `sites-preview start "$PWD"`, open `http://terminal.local:4173/` in the cloud browser, and verify the rendered app and its primary interactions. Keep that preview open and tell the user to inspect it in the cloud browser; do not present the local URL as a user-facing chat link. In Codex Desktop, run the local server yourself, open the preview in the in-app browser, and provide the clickable local URL. Do not deploy to Sites unless the user explicitly asks to share, publish, or deploy. Do not give the user server-start instructions when you can run it.

Before planning or implementing any mobile-app change, read this `AGENTS.md` in full. It is the source of truth for the template's runtime and component guidance.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Editing Boundary

- Build app-specific UI in `src/Prototype.tsx` and `src/prototype.css`.
- Treat `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, and `scripts/prepare-sites-build.mjs` as protected runtime files. Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself. For an explicit runtime change, update the affected lock hashes only after verifying the new runtime behavior.
- Run `npm run check:runtime` before preview or handoff. If it fails, restore the protected runtime instead of weakening or bypassing the check.
- `npm run build` preserves the mobile runtime and prepares the static Cloudflare Worker output required by Sites. Before a Sites handoff, confirm `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`, and source `.openai/hosting.json` exist, then run `npm run test:sites`. Do not replace this project with a Vinext starter.

## Runtime Contract

- Preserve the mobile device runtime unless the user's task explicitly asks otherwise. Do not replace it with a standalone page. Visual fidelity applies to app-owned content inside the device screen, not to template-owned device chrome.
- Keep `App` composed around `PhoneFrame` -> `KeyboardProvider`, with `StatusBar`, app content, `HomeIndicator`, and `KeyboardDock` mounted inside the phone frame. `StatusBar` and the iOS home indicator are overlaid device chrome. When the Android keyboard is closed, the app viewport reserves the protected navigation-bar region instead of painting behind it. When the Android keyboard is open, preserve the current full-screen keyboard layout: its asset includes the IME navigation strip and the separate black navigation bar is hidden. iOS screens continue to paint behind the home-indicator area and own their safe-area content padding.
- Preserve the `iPhone` / `Pixel 10` device picker and both calibrated device presets. The Pixel screen is `427 x 952`; its `32 x 32` camera circle and `public/assets/android/navigation-bar.svg` bottom navigation bar are protected device chrome, not app content.
- Preserve the device picker's intentionally lightweight Codex styling in the top-right corner: its trigger wrapper is borderless and transparent, its trigger sizes to content, and its right-aligned menu uses the compact 3px inset plus the specified hairline and elevation shadow layers. Keep the prototype root and default app screen white.
- Preserve `StatusBar` as live device chrome, including its platform-specific typography, source status-icon assets, and spacing. Pixel 10 uses Roboto, Android indicators, and 32px top, left, and right padding. iPhone uses its iOS indicators, system typography, and calibrated spacing. Do not hardcode screenshot times like `9:41` into the status bar, replace its real-time clock, or move status bar content into app markup unless the user explicitly asks for a fixed/mock device time.
- `PhoneFrame` owns the calibrated device frame, screen portal, device picker, camera cutout, and custom cursor. Keep device assets in `public/assets/iphone/` and `public/assets/android/`; if an asset fails to load, repair the asset path or restore the asset instead of removing the frame, keyboard, or image render.
- Use `MobileScroll` directly for simple single-screen prototypes. Use `FlowStack` for conventional multi-screen flows whose routes can own their fixed header and footer; when using it, define each route as a `FlowScreen`: `{ id, header?, headerHeight?, footer?, footerHeight?, render }`, and use `flow.push(screen)`, `flow.pop()`, and `flow.replace(screen)` from `FlowStack` render callbacks or `useFlow()` instead of introducing another router.
- Use `Carousel` for a carousel, horizontal rail, swipeable cards, image or media strip, horizontally scrollable cards, chip rail, or other horizontal collection.
- For a layered app shell—such as a persistent composer, independently presented sheet, pushed/peek sidebar, or app-wide transition—compose directly in `Prototype.tsx` rather than forcing it through `FlowStack`. Keep app-owned fixed chrome as sibling layers outside `MobileScroll`.
- When using `FlowScreen`, put route-owned fixed headers or footers in `FlowScreen.header` or `FlowScreen.footer`. Set `headerHeight` to the visible app-toolbar height; `FlowStack` adds the device's top safe-area/status-bar inset automatically. Do not include `StatusBar` or its height in the header. Set `footerHeight` to the full app-footer height. `FlowScreen.footer` is an overlay, not reserved layout space; screens using it must add their own bottom content padding such as `padding-bottom: calc(var(--flow-footer-height) + var(--mobile-safe-area-height) + 24px)` so final content can scroll above the footer while still painting behind it.
- Render only scrollable content inside `MobileScroll`; it is for content that should move with scroll and rubber-band overscroll. Keep app-owned headers, nav bars, tabs, composers, and overlays outside it. This keeps scroll physics, safe areas, keyboard insets, scrollbars, and drag click suppression active without letting content paint under fixed chrome.
- Buttons, links, cards, and images inside `MobileScroll` should still allow drag scrolling when the pointer moves beyond tap slop. Use `data-scroll-drag="ignore"` only for rare controls that must own the drag gesture themselves.
- Do not add `var(--keyboard-height)` to ordinary screen/content padding inside `MobileScroll`; the scroll viewport already shrinks above the simulated keyboard. For custom fixed composers, search bars, or toast chrome, use `useKeyboardInsets().bottomInset`. It is relative to the app viewport: Android returns `0` while the closed-keyboard viewport already reserves navigation, then returns the keyboard height while open; iOS continues to clear the home indicator while closed and ride directly above the keyboard while open. Do not pin custom bottom chrome to `bottom: 0` or only `keyboardHeight`.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for every text-entry control. A raw `input` or `textarea` disconnects focus, keyboard animation, safe-area insets, and attached surfaces.
- Use `BottomSheet` for phone-scoped sheets. Its props are `open`, `onOpenChange`, `title`, optional `description`, optional `snap`, and `children`; it renders through the phone screen portal and dismisses the keyboard before opening.

## Horizontal Carousels

- Use `Carousel` for horizontally draggable cards, images, media, chips, or other horizontal collections. Do not recreate these with `overflow-x`, custom pointer handlers, or a generic div.
- `Carousel` can be nested directly inside `MobileScroll`. It owns horizontal gestures and automatically yields vertical gestures to the parent.
- Never put `data-scroll-drag="ignore"` on or around a `Carousel`; doing so prevents vertical parent scrolling when a gesture begins inside it.
- Do not add CSS scroll snapping to `Carousel`; its runtime owns momentum and release motion.
- Use `data-scroll-drag="ignore"` only when a control must prevent parent scrolling in every drag direction.

See `src/mobile/COMPONENTS.md` for the full component and gesture contract.

## Keyboard Rule

The simulated keyboard is a separate top-layer component. Before presenting anything that behaves like iOS navigation or modal UI, dismiss it first.

Call `keyboard.hide()` before:

- pushing, popping, or replacing FlowStack routes
- opening bottom sheets, action sheets, dialogs, menus, or navigation sheets
- starting transitions where the destination should not inherit text-input focus

`FlowStack` already hides the keyboard for `push`, `pop`, and `replace`. `BottomSheet` already hides it before opening. If you add new modal/sheet/navigation primitives, follow the same rule.

When a composer, search surface, or other keyboard-attached component closes, call `keyboard.hide()` in the same event before changing that component's open state. Position attached surfaces from `useKeyboardInsets()` rather than a separate timer or visibility flag so both dismiss together.

When any text-entry control loses focus, dismiss the simulated keyboard. If the control is custom or does not use the runtime's keyboard-aware fields, handle its blur event and call `keyboard.hide()` explicitly. Keep the keyboard open only when focus is moving directly to another text-entry control that should share the same keyboard session.

## Interaction Rules

- Do not trigger buttons or inputs after a pointer has become a drag. Preserve the drag suppression behavior in `MobileScroll`.
- Do not allow native browser image/file dragging inside the phone frame. Preserve the phone-level `dragstart` suppression and non-draggable image styles so scroll drags that begin on images still scroll the prototype.
- Use `KeyboardInput`, `KeyboardTextarea`, or `MobileTextField` for text entry so the simulated keyboard and safe-area insets stay connected.
- Fixed phone chrome should not animate with pushed screens. Screen content can animate; the status bar, camera cutout, and preview chrome should stay put.
- Keep the keyboard below the home indicator/safe area layer in z-index, and above ordinary app UI while visible.
- Keep the home indicator as the topmost safe-area layer in the z-index above everything else in the prototype.

## Current product decision (2026-10-02)

“心屿”岛屿视觉与独立页面收敛为“我的印迹册”。印迹册严格采用参考图的纸页与日期卡结构：月份视图先按日期展示 3 列纸卡，进入日期后查看单日活页纸；每 10 分钟真实投入对应一枚有来源的时间印章，日期、数量、来源文字和投入分布由代码渲染。印章不再提供 DIY 或更换入口，而是按任务来源固定颜色与图样（来源文字样式作为无特殊图样的默认兼容样式）。顶部使用透明背景的猫咪与绿色印迹册插图作为品牌陪伴视觉。今日路线支持通过左侧手柄拖动任务排序，并允许删除不再需要的任务；删除时清理该任务的计时、成果和便签引用，至少保留一个任务。

## UI direction (2026-10-03)
Use the supplied original jixiang reference boards: ivory paper, harmonious gentle colors, generous spacing, botanical puppy mascot and ink stamps. Keep product UI a single journey: plan -> focus -> reflection -> imprint. Fixed navigation uses 今日 / 足迹 / 回响 / 我的. Calendar date cards contain stamp pictures only; explanations open on hover/tap. The separate 我的印章册 tab reads unified metadata and derives acquisition from real evidence, never from legacy aggregate time alone. Preserve FocusLog, migrations and protected device runtime. Original reference boards remain intact in artwork/reference as design sources only; never display them through CSS crops.

## Stamp artwork preference (2026-10-03)
Use individual colorful generated illustrations for every stamp, retaining the warm paper and botanical collection style. Unearned stamps stay gently lighter in color, never grayscale; clearly retain the 未获得 label. Resolve artwork centrally from stamp metadata so the calendar, catalog, monthly view and detail sheets show the same image. Illustrations must not change saved style assignments, acquisition rules or evidence.

## Richer UI and companion direction (2026-10-03)
The user rejected monotonous cream/green surfaces and cropped sections of reference boards. Use independent transparent artwork matching the cream floppy-eared sprout puppy, with distinct welcome, reading, resting, thinking, journaling and encouraging poses. Use books/tea and landscape illustrations in relevant quiet sections. Page accents follow plan/apricot, focus/dusty blue, reflection/lavender, collection/botanical green, with clear dark body text and prominent actions. Keep navigation and data flows consistent. Collection acquisition filters never affect earned evidence. Diary next-step navigation must use the diary's own date, including historical dates.

## Activity colors and entrance (2026-10-03)
Time distribution uses an activity-colored donut with matching labeled legend, durations and percentages. Aggregate matching subjects across dates without changing original recorded milliseconds. Resolve activity colors centrally in activityColors.ts so task dots, daily, weekly and monthly charts agree; unknown subjects use a deterministic color. Do not derive chart colors from user-customized legacy stamp styles. Keep all existing calendar counts and FocusLog evidence intact.

Entrance is a short, skippable welcome inside the app layer only, shown once per tab session with replay in settings. Keep device status chrome still, preserve running timers, bypass entrance for running sessions and both saved/OS reduced-motion preferences. Replays must wait for the existing settings sheet to unmount before creating the welcome layer; restore focus after removing inert. UI details should clarify actual state: small route progress, date tickets, current navigation and accordion indicators, never invented achievements.

## AI flow and collection integration (2026-10-03)
Follow the user's supplied flow: local facts -> explicit per-request consent -> grounded daily/weekly drafts -> optional authorized collection adaptation -> user confirmation -> separately selected future experiments. Model output must never change focus evidence or deterministic stamp counts. Keep credentials on the local Node service and out of client storage, exports and deliverable archives. Zhihu/Xiaohongshu currently use explicitly labeled link/excerpt or JSON import; do not claim account sync or web search without a verified integration. Daily AI art is a separate dated commemorative illustration with a previewable drawing brief, not a replacement for earned evidence. Configuration existence is not proof of a successful provider call.


## Companion refactor (2026-10-03)
The current user request supersedes earlier four-tab and per-request consent decisions: use 今日 / 足迹 / 我的, automatic background organization after one-time opt-in, private server-side task memory, no raw memory viewer, and independent local attachment storage. Pause must not open a form. Preserve historical migrations and deterministic focus stamp counts. The user explicitly authorizes native phone runtime changes: no simulated keyboard or status chrome on actual mobile-sized screens.

## Calendar and focus completion (2026-10-03)
The calendar month view is a single day card in a horizontal Carousel. The card lists that day's task titles in a handwriting style and uses ✓ for user-confirmed done, ○ for continuing/not yet decided, and × for explicitly put down. At focus target end, play a short local alarm and ask the user once; never treat elapsed time as completion. Allow done, continue, put down, or add ten minutes. Calendar shows only first-acquired stamp types for that date; later repeats remain counted in the collection, never duplicated on the card.

## Works and reading (2026-10-03)
The works tab contains uploaded works only, never chat-only entries. Export works and chats as a readable, offline HTML booklet with embedded attachments; preserve authorship labels. Read TXT/DOCX/text PDFs locally, optionally share extracted text and reduced photos after the attachment-reading opt-in. Use an Ark image-understanding model, never embedding or Seedream, to describe photos. Time overview must aggregate saved FocusLogs by subject and selected period without counting planned time or duplicating cumulative ledgers.

## Companion reliability (2026-10-03)
Do not impose an app-level daily message or photo-reading quota on Xiaoya. Process the newest chat message first so older pending work cannot hold up a live conversation. Keep source/event deduplication, one commemorative drawing per date, and capped retry delays to avoid duplicate billing or tight failure loops. The local desktop preview can run through `npm run dev:stable`, which restarts its server after an unexpected exit; check both the page and `/api/ai/status` before handing the preview back to the user.

Chat, reading and drawing must use independent provider jobs; disk locks are only for short updates. The client has one persistent sync loop and merges replies into the latest local state, including when another message is sent during a request. Use incremental event uploads and explicit deletion so large histories do not block live chat or disable memory. Persist vision configuration when saving other model settings. Text and image replies share Xiaoya's conversational voice with natural occasional 汪. Blank or quota-like model replies do not count as successful responses. Retry temporary network/provider failures with backoff, and wake on reconnection or returning to the app. `npm run dev` now uses the supervised preview with an API health check; `dev:watch` is reserved for server development.

## Product name and task menu (2026-10-03)
The product is now called 知途. Use this name in the app, onboarding, exports, model instructions and current product materials. Preserve existing jixiang storage keys, IndexedDB names, request headers, environment variables and source asset paths so saved data and service integrations remain compatible. Today task menus no longer include 编辑任务; remove the unused prompt-based editor and do not restore it.

## Final tutorial and task density (2026-10-03)
Keep Today task rows concise: no companion memory or progress prose in the row. Keep that context in chatting and date details. The first-use guide covers the current three-tab journey in eight short steps, is skippable and replayable from 我的, and never writes fabricated tasks or focus logs. Prepare an iPhone home-screen web app and a real-data recording walkthrough.

Use the exact brand subtitle: ——一款陪伴和记录你成长的教育产品. Allow it to wrap naturally on phones without squeezing the calendar or profile controls.

## iPhone keyboard and LAN chat (2026-10-03)
On native phone layouts track both visualViewport height and offsetTop on resize and scroll. Pin the app to the visible viewport; let chat history scroll separately from the composer. Never bring back the simulated keyboard. Preserve the incoming Host through the local Vite API proxy so same-origin LAN requests pass API validation; do not disable origin or cross-site protections.

## Interactive walkthrough (2026-10-03)
Replace the card-based first-use guide with a translucent, blurred spotlight walkthrough over real controls. Allow the highlighted control to work and advance after the actual action. Cover task creation, focus/pause/resume/end, completion, chat and memory consent, works, calendar details, time statistics, stamp collection and settings/export. It can be exited or replayed; never auto-grant consent, fabricate logs or upload works. Retain native keyboard viewport compensation during the guide.

## Public cloud deployment (2026-10-03)
The user authorizes a public HTTPS experience. Preserve local histories and storage keys. Cloud APIs share the companion logic with a D1/R2 private storage adapter, isolate visitors by a random bearer token, deny configuration changes from public clients, and accept only the actual site origin. Keep model keys exclusively in Sites secrets. The public origin has its own device-local tasks and works; do not claim cross-device sync or automatically publish desktop records. The deployment runtime changes to worker/index.js and prepare-sites-build.mjs are authorized for this request and must pass worker and companion tests before updating their lock hashes.

## Always available Xiaoya (2026-10-03)
The header puppy opens chatting on every page, even with zero tasks. General conversations use a reserved companion thread and must never create a fake task or FocusLog. Keep the puppy visible inside the chat after first-use consent. Capture checkbox values synchronously before queued journal writes so reading and proactive switches can be changed and survive reload. Production now uses Tencent Cloud Docker/Node with private server environment keys, while Sites build support remains available.

## Live footprints and keyboard restoration (2026-10-03)
Started tasks appear immediately in both the calendar card and its date detail, including while the timer is running. Share task membership and status rules between those views; ○ stays until the user marks completion. Derive daily time from dated FocusLogs plus a temporary live session view, never from the lifetime task ledger. Do not save that temporary view or award duplicate stamps. Keep one image per first-earned stamp type. Page changes reset the actual scrolling container and its momentum. Keep a short scroll tail with no repeated safe-area spacer. On native phones the page behind chat stays at its full height and top position; only the conversation sheet follows the keyboard's visible viewport. Every chat dismissal blurs native input and hides the simulated keyboard.

Open a date detail from any area of its own calendar card, including task text and blank paper. Always capture that card's date, not the selected day. Keep carousel drag suppression and support Enter/Space when the card is focused. The `?tutorial=1` link replays the guide once without clearing saved records or automatically granting memory consent.
