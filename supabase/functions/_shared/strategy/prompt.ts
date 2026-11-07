// Composes the coach system prompt. The prompt TEXT lives in ai-advisor/modes.ts (file convention); this only joins parts.
import { renderStrategyContext, type Hints, type StrategyState } from "./context.ts";

export const buildCoachSystem = (basePrompt: string, state: StrategyState, hints: Hints = {}): string =>
  basePrompt + renderStrategyContext(state, hints);
