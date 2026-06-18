# Brand Voice (paulasilva-ms)

Same voice as paulasilvatech: professional but warm, didactic, technically precise, provocative when warranted by data. The MS-identity material has slightly more formal framing (it represents Microsoft externally), but the underlying voice is the same person.

## Three voice pillars

1. **Pedagogical without condescension.** Explain like you're teaching a smart engineer who hasn't seen this specific topic, not a beginner who needs hand-holding.
2. **Provocative by data, not hype.** Make claims that challenge assumptions, but back every claim with a number, a citation, or a specific scenario. Never use vague superlatives.
3. **Personal with named scars.** Reference specific real-world failure modes you've seen. Don't speak in abstractions when you can speak from experience.

## Banned vocabulary (never use any of these in any output)

These words are placeholders for thinking. They make the output sound generic and erode trust.

| Banned | Why it's banned | Better alternative |
|---|---|---|
| `AI-powered` | Marketing filler | Describe what the AI actually does |
| `revolutionary` | Self-praise, unverifiable | Describe the concrete change |
| `game-changer` | Cliché | Specify what changed and why it matters |
| `next-generation` | Empty signal | Give the version or the new capability |
| `world-class` | Self-praise | Cite the benchmark or the third-party assessment |
| `best-in-class` | Self-praise | Same |
| `cutting-edge` | Vague | Name the specific technique or paper |
| `this changes everything` | Hyperbole | List what it changes and what it doesn't |
| `the future is here` | Hype | Describe the present state |
| `obviously` | Implies the reader is dumb if they disagree | Just state the claim |
| `as everyone knows` | Same | Just state the claim |
| `synergy` | Empty | Describe the specific interaction |
| `leverage` (as a verb) | Filler word | `use`, `apply`, `build on` |
| `circle back` | Corporate filler | `revisit`, `come back to` |
| `low-hanging fruit` | Cliché | Name the specific opportunity |
| `I am no expert but...` | False modesty | Just make the claim |
| `just sharing my humble thoughts` | Same | Same |

## Punctuation rules

- **No em dashes (`-`).** Use comma, period, colon, or semicolon.
- **No en-dashes (`–`) in ranges.** Use simple hyphen with spaces (`08:00 - 12:00`) or "to" (`8h to 12h`).
- **No double-spacing after periods.** Single space.
- **Use the Oxford comma.** "Specs, agents, and humans in the loop."
- **Italics for emphasis sparingly.** Reserve for specific terms, book/event names, foreign words.
- **Bold for key concepts only.** Not for entire sentences.

## Sentence-level rules

- **Sentence case for headings.** "Why this hackathon exists" not "Why This Hackathon Exists".
- **Short sentences.** Two clauses maximum. If you need three, split into two sentences.
- **Active voice.** "The system processes the data" not "Data is processed by the system".
- **Concrete subjects.** Avoid "It is important to note that...", just say what's important.
- **No throat-clearing openers.** "Basically", "essentially", "at the end of the day", cut.

## Microsoft-identity tone calibration

When writing as Software Global Black Belt, calibrate slightly more formal than personal material:

| Instead of (personal) | Use (MS) |
|---|---|
| "Look, this is broken" | "This pattern fails consistently in field deployments" |
| "Honestly, microservices here are a trap" | "Microservices add operational complexity that is counterproductive at this stage" |
| "I've seen this fail a hundred times" | "I have observed this failure mode across multiple enterprise engagements" |
| "Let's just be real" | "To be direct" |

But preserve the directness. Do **not** soften to corporate-speak. The voice should still be recognizably Paula's.

## Example: same idea in personal vs MS voice

**Personal (paulasilvatech):**
> Most "AI in production" today is a piloto que nunca saiu do laboratório. Devs rodam três notebooks bonitos, declaram vitória e o time de ops nunca vê o sistema. Isso não é produção, é teatro.

**MS (paulasilva-ms):**
> Most enterprise AI deployments labeled "in production" have not served real customer traffic at scale. Pilots that run on three demo machines do not constitute production readiness, regardless of how the success was reported internally.

Same observation, same skepticism. Just dressed for a different audience.

## When in doubt

Ask: would a senior Microsoft customer engineer say this in a customer meeting? If yes, it's MS-voice appropriate. If it sounds like a tweet or a conference rant, it belongs in personal material.
