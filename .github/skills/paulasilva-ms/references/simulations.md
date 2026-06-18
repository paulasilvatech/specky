# Simulations Reference

Visual mockups of dev tools (browser windows, terminals, VS Code, GitHub Copilot Chat) for use in slides, landing pages, playbooks, and site chapters. Pure HTML/CSS, no real interactivity required for static use, but can be progressively enhanced with JS.

## Why simulations and not screenshots

| Use simulations when | Use screenshots when |
|---|---|
| The content needs to render crisp at any zoom level (PDF, retina) | You're showing a real, time-stamped product state for documentation accuracy |
| Content needs to be searchable / selectable | The UI surface is too complex to mock cleanly |
| You'll iterate on the content during draft | Content is locked / archival |
| The point is the conversation/code, not the chrome | The chrome itself is the point |

Screenshots get blurry, can't be edited, leak personal data (URLs, profile photos), and bloat file size. Simulations are scalable and inspectable.

## Browser window simulation

A faux Chrome/Safari window with traffic-light buttons, address bar, and content area.

```html
<div class="sim-browser">
  <div class="sim-browser__chrome">
    <div class="sim-browser__dots">
      <span class="sim-browser__dot" style="background:#FF5F57"></span>
      <span class="sim-browser__dot" style="background:#FEBC2E"></span>
      <span class="sim-browser__dot" style="background:#28C840"></span>
    </div>
    <div class="sim-browser__url">
      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span>agenticdevopsplatform.com</span>
    </div>
  </div>
  <div class="sim-browser__content">
    <!-- mockup content here -->
  </div>
</div>
```

CSS:

```css
.sim-browser {
  border: 1px solid var(--rule);
  border-radius: 10px;
  overflow: hidden;
  background: var(--paper);
  box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  font-family: var(--font-sans);
}
.sim-browser__chrome {
  background: var(--bg-alt);
  border-bottom: 1px solid var(--rule);
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.sim-browser__dots { display: flex; gap: 6px; }
.sim-browser__dot { width: 11px; height: 11px; border-radius: 50%; }
.sim-browser__url {
  flex: 1;
  background: var(--paper);
  border: 1px solid var(--rule-2);
  border-radius: 6px;
  padding: 4px 12px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-3);
  display: flex;
  align-items: center;
  gap: 8px;
}
.sim-browser__content { padding: 0; min-height: 200px; }
```

For a "tab bar" variant, add an extra row above the address bar with `<div class="sim-browser__tabs">`.

## Terminal simulation

A faux macOS / Linux terminal with prompt and command output. Supports multi-line, ANSI colors via spans, and a typing animation.

```html
<div class="sim-terminal">
  <div class="sim-terminal__chrome">
    <div class="sim-terminal__dots">
      <span class="sim-terminal__dot" style="background:#FF5F57"></span>
      <span class="sim-terminal__dot" style="background:#FEBC2E"></span>
      <span class="sim-terminal__dot" style="background:#28C840"></span>
    </div>
    <span class="sim-terminal__title">paula@laptop · ~/projects/serpro-hackathon</span>
  </div>
  <div class="sim-terminal__body">
    <div class="sim-terminal__line">
      <span class="sim-terminal__prompt">$</span>
      <span class="sim-terminal__cmd">git clone https://github.com/contoso/hackathon-datacorp</span>
    </div>
    <div class="sim-terminal__line sim-terminal__output">Cloning into 'hackathon-datacorp'...</div>
    <div class="sim-terminal__line sim-terminal__output">remote: Enumerating objects: 247, done.</div>
    <div class="sim-terminal__line sim-terminal__output sim-terminal__output--success">✓ Clone complete</div>
    <div class="sim-terminal__line">
      <span class="sim-terminal__prompt">$</span>
      <span class="sim-terminal__cursor">_</span>
    </div>
  </div>
</div>
```

CSS:

```css
.sim-terminal {
  background: #1A1A1A;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0,0,0,0.25);
  font-family: var(--font-mono);
  font-size: 13px;
}
.sim-terminal__chrome {
  background: #2C2C2C;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid #1A1A1A;
}
.sim-terminal__dots { display: flex; gap: 6px; }
.sim-terminal__dot { width: 11px; height: 11px; border-radius: 50%; }
.sim-terminal__title {
  color: #A8A8A4;
  font-size: 11px;
  letter-spacing: 0.04em;
}
.sim-terminal__body {
  padding: 18px 22px;
  color: #E5E5E0;
  line-height: 1.55;
}
.sim-terminal__line { white-space: pre-wrap; }
.sim-terminal__prompt { color: #7FBA00; margin-right: 8px; }
.sim-terminal__cmd { color: #F0F0F0; }
.sim-terminal__output { color: #A8A8A4; padding-left: 18px; }
.sim-terminal__output--success { color: #7FBA00; }
.sim-terminal__output--error   { color: #F25022; }
.sim-terminal__output--warn    { color: #FFB900; }
.sim-terminal__cursor {
  display: inline-block;
  background: #F0F0F0;
  width: 8px;
  height: 14px;
  vertical-align: middle;
  animation: blink 1s steps(2) infinite;
}
@keyframes blink { 50% { opacity: 0; } }
```

### Terminal typing animation

For decks/landing pages where you want commands to type themselves:

```javascript
function typeCommand(el, text, speed = 40) {
  return new Promise(resolve => {
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        resolve();
      }
    }, speed);
  });
}
```

Use with IntersectionObserver to start typing when the terminal scrolls into view.

## VS Code simulation

A faux VS Code window with sidebar, tabs, code area, and optional bottom panel. The most complex simulation.

```html
<div class="sim-vscode">
  <div class="sim-vscode__titlebar">
    <div class="sim-vscode__dots">
      <span style="background:#FF5F57"></span>
      <span style="background:#FEBC2E"></span>
      <span style="background:#28C840"></span>
    </div>
    <span class="sim-vscode__title">hackathon-datacorp · Visual Studio Code</span>
  </div>
  <div class="sim-vscode__body">
    <aside class="sim-vscode__sidebar">
      <div class="sim-vscode__file sim-vscode__file--folder">📁 src</div>
      <div class="sim-vscode__file sim-vscode__file--nested">📁 modules</div>
      <div class="sim-vscode__file sim-vscode__file--nested-2 sim-vscode__file--active">SifapController.java</div>
      <div class="sim-vscode__file sim-vscode__file--nested-2">SifapService.java</div>
      <div class="sim-vscode__file sim-vscode__file--nested">📁 tests</div>
      <div class="sim-vscode__file">README.md</div>
      <div class="sim-vscode__file">pom.xml</div>
    </aside>
    <main class="sim-vscode__main">
      <div class="sim-vscode__tabs">
        <div class="sim-vscode__tab sim-vscode__tab--active">SifapController.java <span class="sim-vscode__close">×</span></div>
        <div class="sim-vscode__tab">SifapService.java <span class="sim-vscode__close">×</span></div>
      </div>
      <div class="sim-vscode__editor">
        <pre><span class="sim-vscode__line-num">1</span><span class="vs-keyword">package</span> <span class="vs-namespace">com.serpro.sifap</span>;
<span class="sim-vscode__line-num">2</span>
<span class="sim-vscode__line-num">3</span><span class="vs-keyword">import</span> org.springframework.web.bind.annotation.*;
<span class="sim-vscode__line-num">4</span>
<span class="sim-vscode__line-num">5</span><span class="vs-decorator">@RestController</span>
<span class="sim-vscode__line-num">6</span><span class="vs-decorator">@RequestMapping</span>(<span class="vs-string">"/api/producao"</span>)
<span class="sim-vscode__line-num">7</span><span class="vs-keyword">public class</span> <span class="vs-class">SifapController</span> {
<span class="sim-vscode__line-num">8</span>  <span class="vs-comment">// generated by GitHub Copilot</span>
<span class="sim-vscode__line-num">9</span>}</pre>
      </div>
    </main>
  </div>
</div>
```

CSS (essentials):

```css
.sim-vscode {
  background: #1E1E1E;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0,0,0,0.25);
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: #D4D4D4;
}
.sim-vscode__titlebar {
  background: #3C3C3C;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid #1E1E1E;
}
.sim-vscode__dots { display: flex; gap: 6px; }
.sim-vscode__dots span { width: 11px; height: 11px; border-radius: 50%; }
.sim-vscode__title { color: #CCCCCC; font-size: 11px; }
.sim-vscode__body { display: grid; grid-template-columns: 220px 1fr; min-height: 320px; }
.sim-vscode__sidebar {
  background: #252526;
  padding: 10px 0;
  border-right: 1px solid #1E1E1E;
}
.sim-vscode__file {
  padding: 4px 18px;
  cursor: pointer;
  font-size: 12px;
  color: #CCCCCC;
}
.sim-vscode__file--nested   { padding-left: 30px; }
.sim-vscode__file--nested-2 { padding-left: 42px; }
.sim-vscode__file--active   { background: #094771; color: #FFFFFF; }
.sim-vscode__main { display: flex; flex-direction: column; }
.sim-vscode__tabs {
  background: #2D2D2D;
  display: flex;
  border-bottom: 1px solid #1E1E1E;
}
.sim-vscode__tab {
  padding: 8px 14px;
  background: #2D2D2D;
  color: #969696;
  font-size: 12px;
  border-right: 1px solid #1E1E1E;
  display: flex;
  align-items: center;
  gap: 8px;
}
.sim-vscode__tab--active { background: #1E1E1E; color: #FFFFFF; }
.sim-vscode__close { color: #969696; cursor: pointer; }
.sim-vscode__editor { padding: 16px 0; flex: 1; overflow: auto; }
.sim-vscode__editor pre { margin: 0; padding: 0 18px; line-height: 1.55; }
.sim-vscode__line-num {
  color: #5A5A5A;
  display: inline-block;
  width: 32px;
  text-align: right;
  margin-right: 14px;
  user-select: none;
}

/* Java/JS syntax tokens (one Default Dark+ approximation) */
.vs-keyword   { color: #569CD6; }
.vs-namespace { color: #4EC9B0; }
.vs-string    { color: #CE9178; }
.vs-decorator { color: #DCDCAA; }
.vs-class     { color: #4EC9B0; }
.vs-comment   { color: #6A9955; font-style: italic; }
```

## GitHub Copilot Chat simulation

A faux GitHub Copilot Chat panel with user message, assistant response (with code), and the inline reaction strip.

```html
<div class="sim-copilot">
  <div class="sim-copilot__header">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <!-- GitHub Copilot logo simplified -->
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
    </svg>
    <span>GitHub Copilot</span>
    <span class="sim-copilot__model">github-copilot-default</span>
  </div>
  <div class="sim-copilot__messages">
    <div class="sim-copilot__msg sim-copilot__msg--user">
      <div class="sim-copilot__avatar">P</div>
      <div class="sim-copilot__bubble">
        Refactor SifapController to use constructor injection instead of @Autowired.
      </div>
    </div>
    <div class="sim-copilot__msg sim-copilot__msg--assistant">
      <div class="sim-copilot__avatar sim-copilot__avatar--copilot">
        <!-- GitHub Copilot icon -->
      </div>
      <div class="sim-copilot__bubble">
        <p>Here's the refactored controller:</p>
        <pre class="sim-copilot__code"><code>@RestController
@RequestMapping("/api/producao")
public class SifapController {
  private final SifapService service;

  public SifapController(SifapService service) {
    this.service = service;
  }
}</code></pre>
        <div class="sim-copilot__actions">
          <button>Insert</button>
          <button>Copy</button>
        </div>
      </div>
    </div>
  </div>
  <div class="sim-copilot__input">
    <textarea placeholder="Ask GitHub Copilot..."></textarea>
    <button class="sim-copilot__send">↑</button>
  </div>
</div>
```

CSS (essentials):

```css
.sim-copilot {
  background: #1E1E1E;
  border-radius: 10px;
  overflow: hidden;
  font-family: var(--font-sans);
  font-size: 13px;
  color: #CCCCCC;
  box-shadow: 0 12px 32px rgba(0,0,0,0.25);
  display: flex;
  flex-direction: column;
}
.sim-copilot__header {
  background: #252526;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #1E1E1E;
}
.sim-copilot__model {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  color: #5A5A5A;
}
.sim-copilot__messages { padding: 16px; display: flex; flex-direction: column; gap: 18px; }
.sim-copilot__msg { display: flex; gap: 12px; }
.sim-copilot__avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--c-blue-500); color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 600; font-size: 12px; flex-shrink: 0;
}
.sim-copilot__avatar--copilot {
  background: #1A1A1A; border: 1px solid var(--rule-2);
}
.sim-copilot__bubble {
  background: #2D2D2D;
  padding: 12px 14px;
  border-radius: 8px;
  flex: 1;
  line-height: 1.55;
}
.sim-copilot__msg--user .sim-copilot__bubble { background: #094771; }
.sim-copilot__code {
  background: #1A1A1A;
  border-radius: 6px;
  padding: 12px 14px;
  margin-top: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  overflow-x: auto;
}
.sim-copilot__actions {
  display: flex; gap: 6px; margin-top: 10px;
}
.sim-copilot__actions button {
  background: transparent;
  border: 1px solid var(--rule-2);
  color: #CCCCCC;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.sim-copilot__input {
  border-top: 1px solid #1E1E1E;
  padding: 12px 16px;
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.sim-copilot__input textarea {
  flex: 1;
  background: #2D2D2D;
  border: 1px solid var(--rule-2);
  border-radius: 6px;
  color: #CCCCCC;
  padding: 8px 12px;
  font-family: var(--font-sans);
  font-size: 13px;
  resize: none;
  min-height: 36px;
}
.sim-copilot__send {
  background: var(--c-blue-500);
  color: white;
  border: none;
  width: 36px; height: 36px;
  border-radius: 6px;
  cursor: pointer;
}
```

## Combinations

For a single slide / section, you can combine simulations:

| Pattern | Use case |
|---|---|
| Browser + URL | Showing what a deployed app looks like |
| Terminal + Browser side-by-side | "Run command, get URL" deploy flow |
| VS Code + GitHub Copilot Chat split | Demonstrating dev workflow with GitHub Copilot |
| Terminal stack (3 stacked) | Sequence of commands building on each other |

For the VS Code + GitHub Copilot Chat combo, use `display: grid; grid-template-columns: 1fr 380px; gap: 12px;`.

## Anti-patterns

- Don't try to simulate the entire VS Code surface (status bar, activity bar icons, breadcrumbs, etc.). Mock only what the slide is about.
- Don't use real screenshots disguised as simulations. They blur on resize.
- Don't fake API keys, tokens, or real customer data even in mockups. Use `<your-api-key>`, `customer@example.com`, fake company names.
- Don't show real PII (emails, phone numbers, SSNs) in mockups even as examples.
- Don't make the mock too realistic that someone would mistake it for the actual product. Add subtle "demo" markers if the use case is risky.
