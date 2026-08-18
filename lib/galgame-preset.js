/**
 * dsh-galgame-generator — "Galgame 生成模式" agent-preset template, shipped as files.
 *
 * The mode is delivered as a DSH agent preset under `agent-preset/galgame/`:
 *   - `preset.yml`        → display name/description for DSH's native preset picker.
 *   - `agent.cordis.yml`  → composition whose `persona` row injects the "say 生成 and
 *                           it builds" guidance into the model (the prompt injection).
 *
 * Because this bundle installs from git (pnpm materializes the whole repo), the
 * installer in `lib/index.js` reads these files fresh from the package directory at
 * runtime, keeping a single source of truth — no embedded copies to drift.
 */
export const GALGAME_PRESET_ID = 'galgame'
export const GALGAME_PRESET_DIRNAME = 'agent-preset/galgame'
export const GALGAME_PRESET_FILES = ['preset.yml', 'agent.cordis.yml']
