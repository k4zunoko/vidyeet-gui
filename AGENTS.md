# Coding Agent Instructions

**Windows desktop application wrapping Mux API via CLI (`bin/vidyeet-cli.exe`)**

## Project Overview

| Item | Details |
|------|---------|
| **Purpose** | GUI for safe, convenient video uploading & management to Mux |
| **Stack** | Vue 3 + Vite + Electron + TypeScript |
| **Target** | Windows only (no cross-platform) |
| **CLI Integration** | `bin/vidyeet-cli.exe` handles Mux API + authentication |

## Quick Start

```bash
npm run dev          # Development
npm run build:win    # Build (Windows installer)
npm run build:dir    # Build (unpacked, for testing)
npx vue-tsc --noEmit # Type check
```

**No test framework configured.** No lint/format commands.

## Architecture

```
Renderer (Vue) → Preload (contextBridge) → Main (Electron) → CLI (vidyeet-cli.exe)
```

- **Renderer**: UI only. No direct OS/CLI access
- **Preload**: Exposes `window.vidyeet`, `window.windowControl`, `window.clipboard`
- **Main**: IPC handlers, spawns CLI, parses JSON output
- **CLI**: Manages Mux API + credentials. GUI only receives success/failure

## Directory Structure

```
src/components/   # Shared UI components
src/composables/  # Vue composables (useXxx pattern)
src/features/     # Feature modules (auth/, library/, player/)
src/types/        # App-level TypeScript types
electron/         # Main process, preload, services, IPC types
docs/             # CLI_CONTRACT.md, UX_PSYCHOLOGY.md
bin/              # vidyeet-cli.exe (dev mode)
```

## Code Style

### TypeScript
- **Strict mode** (`strict: true`), no unused variables/params
- **Explicit return types** on exported functions
- **Type guards** for runtime checking: `isIpcError(value)`

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Variables/Functions | camelCase | `selectedVideo`, `handleUpload` |
| Types/Interfaces | PascalCase | `VideoItem`, `UploadProgress` |
| Components | PascalCase | `TitleBar.vue`, `VideoPlayer.vue` |
| Composables | useXxx | `useUploadQueue` |
| IPC Channels | namespace:action | `vidyeet:upload` |
| CSS Variables | --color-* | `--color-bg`, `--color-primary` |

### Vue Components

```vue
<script setup lang="ts">
/** Component description in Japanese */
import { ref } from "vue";
import type { VideoItem } from "../types/app";

defineProps<{ video?: VideoItem }>();
const emit = defineEmits<{ select: [video: VideoItem] }>();
</script>

<template>
  <Component @some-event="handler" />
</template>

<style scoped>
.class { color: var(--color-text); }
</style>
```

### Error Handling

```typescript
const result = await window.vidyeet.upload(request);
if (isIpcError(result)) {
  showToast("error", result.message);
  return;
}
// result is typed as success response
```

### CLI Response Conversion
CLI uses snake_case → convert to camelCase in adapters (`playback_ids` → `playbackId`)

## Constraints

**NEVER:**
- Access Node.js APIs directly from Renderer
- Store credentials in GUI (CLI handles auth)
- Skip error checking on IPC calls
- Use `any` type (use `unknown` with type guards)

## Reference Documents (read in order)
1. `docs/README.md` - Navigation
2. `docs/REQUIREMENTS.md` - Features
3. `docs/CLI_CONTRACT.md` - CLI commands & JSON schemas
4. `docs/UX_PSYCHOLOGY.md` - UI principles

## Common Tasks

### Adding a New IPC Channel
1. Add to `IpcChannels` in `electron/types/ipc.ts`
2. Define request/response types
3. Add handler in `electron/main.ts`
4. Expose in `electron/preload.ts`

### Adding a New Composable
1. Create `src/composables/useXxx.ts`
2. Use `ref`/`computed` for reactive state
3. Return object with state and methods

### Adding a New Feature View
1. Create folder `src/features/xxx/`
2. Main view: `XxxView.vue`
3. Import in `App.vue`
