# Investor Persona Agents — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Inspiration:** Fincept Terminal (open-source Bloomberg alternative, 21k GitHub stars) — ships 37 named investor agents as LLM persona prompts with different system instructions.

---

## Problem

The AIAdvisor page has a single fixed voice (AJE default). Users who want to stress-test ideas through different investing lenses — value, deep value, GARP, mental models, distressed — have no way to switch context without leaving the page.

---

## Solution

Add a pill/tab persona selector above the AIAdvisor chat. Each persona is a different system prompt sent to the edge function. Switching persona resets the chat with a persona-specific welcome message.

---

## Scope

**2 files changed. No new files.**

- `supabase/functions/ai-advisor/index.ts` — add 5 persona system prompts, extend mode switch
- `src/pages/AIAdvisor.tsx` — add persona state, pill selector UI, pass `mode` in body

---

## Personas

| Mode string           | Label   | Philosophy                                                                      |
| --------------------- | ------- | ------------------------------------------------------------------------------- |
| `"aje"`               | AJE     | Existing default — hedge fund AI analyst, actionable trade recs                 |
| `"financial-advisor"` | CFP     | Existing — comprehensive financial planning, structured strategies              |
| `"buffett"`           | Buffett | Value investing, competitive moats, circle of competence, long-term conviction  |
| `"graham"`            | Graham  | Deep value, margin of safety, intrinsic value math, Mr. Market metaphor         |
| `"lynch"`             | Lynch   | Growth at reasonable price (GARP), invest in what you know, PEG ratio focus     |
| `"munger"`            | Munger  | Mental models, concentrated positions, quality over cheapness, inversion        |
| `"clarman"`           | Klarman | Distressed value, absolute return mindset, aggressive downside protection first |

The existing `"aje"` and `"financial-advisor"` modes are unchanged. The 5 new personas are additive.

---

## Edge Function Changes

**File:** `supabase/functions/ai-advisor/index.ts`

Add 5 new `const PERSONA_*_PROMPT` constants after the existing two prompt constants. Each prompt instructs the LLM to reason in the voice and framework of that investor — not to impersonate them, but to apply their published methodology to the user's actual portfolio data.

Extend the system message assignment (currently line 82):

```ts
// before
let systemMessage =
  mode === "financial-advisor" ? FINANCIAL_ADVISOR_PROMPT : SYSTEM_PROMPT;

// after
const PERSONA_MAP: Record<string, string> = {
  "financial-advisor": FINANCIAL_ADVISOR_PROMPT,
  buffett: PERSONA_BUFFETT_PROMPT,
  graham: PERSONA_GRAHAM_PROMPT,
  lynch: PERSONA_LYNCH_PROMPT,
  munger: PERSONA_MUNGER_PROMPT,
  clarman: PERSONA_CLARMAN_PROMPT,
};
let systemMessage = PERSONA_MAP[mode] ?? SYSTEM_PROMPT;
```

Portfolio context is appended to every persona unchanged — each advisor sees the same real data.

---

## Frontend Changes

**File:** `src/pages/AIAdvisor.tsx`

### Persona data constant (above component)

```ts
const PERSONAS = [
  {
    id: "aje",
    label: "AJE",
    intro:
      "Welcome to **AJE AI Advisor**. I have access to your portfolio, open positions, signal scores, and market regime.\n\nAsk me anything — or use the quick prompts below.",
  },
  {
    id: "buffett",
    label: "Buffett",
    intro:
      "Thinking like **Warren Buffett**. Ask about value, moats, or your current positions.",
  },
  {
    id: "graham",
    label: "Graham",
    intro:
      "**Benjamin Graham** lens. Show me what looks cheap — let's calculate margin of safety.",
  },
  {
    id: "lynch",
    label: "Lynch",
    intro: "**Peter Lynch** here. Tell me what you own and why you own it.",
  },
  {
    id: "munger",
    label: "Munger",
    intro:
      "**Charlie Munger** mode. Let's apply some mental models to your portfolio.",
  },
  {
    id: "clarman",
    label: "Klarman",
    intro:
      "**Seth Klarman** approach. First question: what's the downside on each position?",
  },
] as const;
```

### State

```ts
const [persona, setPersona] = useState<string>("aje");
```

### Persona switch handler

```ts
const switchPersona = (id: string) => {
  const p = PERSONAS.find((p) => p.id === id)!;
  setPersona(id);
  setMessages([{ role: "assistant", content: p.intro }]);
};
```

### Pill selector UI

Inserted between `<h2>` and the quick prompts div. Uses existing border/card tokens to match the page's neutral style:

```tsx
<div className="mb-3 flex flex-wrap gap-1.5">
  {PERSONAS.map((p) => (
    <button
      key={p.id}
      onClick={() => switchPersona(p.id)}
      className={`rounded-full border px-3 py-1 text-xs transition-fast ${
        persona === p.id
          ? "border-bullish bg-bullish/10 text-foreground"
          : "border-border text-muted-foreground hover:border-bullish/30 hover:text-foreground"
      }`}
    >
      {p.label}
    </button>
  ))}
</div>
```

### streamInvoke body

Add `mode: persona` to the existing `streamInvoke` call body:

```ts
await streamInvoke(
  "ai-advisor",
  { messages: newMessages, context: { ... }, mode: persona },
  { onDelta, onDone, onError }
);
```

---

## Data Flow

```
User clicks "Buffett" pill
  → switchPersona("buffett") called
  → persona state = "buffett"
  → messages reset to Buffett intro message
  → user sends a message
  → streamInvoke body includes mode: "buffett"
  → edge function: PERSONA_MAP["buffett"] → PERSONA_BUFFETT_PROMPT
  → portfolio context appended to Buffett prompt
  → LLM responds in Buffett framework with real portfolio data
```

---

## What This Is Not

Personas are **not** trained on the real investors. They are LLM system prompts that apply each investor's published methodology (value metrics, mental models, margin of safety math) to the user's portfolio. This is a research aid, not an oracle. No disclaimers are added to the UI — the user is a sophisticated investor.

---

## Out of Scope

- Demo mode persona support (demo path uses hardcoded mock response; personas won't affect it — acceptable)
- Persisting the selected persona across sessions
- Adding more than 5 new personas in this iteration
- Changing quick prompts per persona

---

## Test Criteria

1. Each pill highlights correctly when selected
2. Switching persona resets the chat to that persona's intro
3. A message sent after switching receives a response in the correct voice (manually verify tone differs)
4. The default AJE and financial-advisor modes are unaffected
5. No TypeScript errors (`npm run build` passes)
