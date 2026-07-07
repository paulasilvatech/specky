# Specky — Melhorias para target `cursor` (APM install)

**Versão auditada:** Specky 3.8.0  
**Projeto de referência:** `cinema-app-agent-v2`  
**Data:** 2026-07-07  
**Última revisão:** 2026-07-07 (Apêndices A–G — spec **completo para implementação**)  

**Escopo de completude:** Este documento inclui decisões travadas, arquitetura, conteúdo de primitivos, **build script hooks**, **6 companion skills**, **patches TypeScript** e **testes de regressão** (Apêndice G). Implementador não deve precisar de decisões extras além de merge/review.

## Contexto

Auditoria da saída de `specky install` com `targets: ["cursor"]` contra as convenções atuais do Cursor (subagents, rules, commands, skills, MCP).

---

## Decisão explícita (NÃO mudar)

### Manter skills em `.agents/skills/`

**Manter** `.agents/skills/{skill-name}/SKILL.md` como destino no target Cursor.

Motivos:

- O Cursor descobre skills de projeto nesse path (confirmado em runtime).
- Separação clara: `.cursor/agents/` = persona; `.agents/skills/` = playbook.
- Documentar isso no INSTALL.md e no manifest do target Cursor.

**Sugestão para manifest / config do target:**

```yaml
cursor:
  skills_install_path: ".agents/skills"
  skills_source_path: ".apm/skills"   # já existe como skills_dir no config.yml
```

**Ação APM:** atualizar docs oficiais do Specky para declarar `.agents/skills/` como path Cursor oficial. **Não** migrar para `.cursor/skills/`.

---

## Resumo executivo

| Prioridade | Item | Esforço |
|------------|------|---------|
| P0 | Rule: formato Cursor + nomenclatura | Baixo |
| P0 | Unificar definição EARS | Médio |
| P0 | Honestidade sobre hooks no Cursor | Médio |
| P0 | Rule slim (token budget) — ver Apêndice C | Baixo |
| P1 | Companion skills faltantes (6 agents) — conteúdo em **Apêndice G.3** | Médio |
| P1 | Permissões / first-run Cursor — ver Apêndice B | Médio |
| P1 | Corrigir bugs de conteúdo nos agents | Baixo |
| P1 | Referências MCP/path desatualizadas | Baixo |
| P1 | `specky doctor` checks Cursor — ver Apêndice E | Baixo |
| P2 | Documentar gitignore + onboarding do time | Baixo |
| P2 | Renomear rule template | Baixo |
| P2 | Primitivos canônicos APM — ver Apêndice D | Médio |
| P2 | `config.yml` — comentário hooks incluir Cursor | Baixo |

**Status da documentação:** Apêndices A–G ✅ — **pronto para implementação no repo Specky**

---

## P0 — Correções obrigatórias no template Cursor

### 1. Rule: migrar de formato Copilot para formato Cursor

**Arquivo atual gerado:** `.cursor/rules/copilot-instructions.mdc`

**Problemas:**

- Frontmatter usa `applyTo: '**'` (Copilot), não o padrão Cursor.
- Falta campo `description`.
- Título e corpo falam em "Copilot Instructions".
- Seção "Available Prompts" referencia `@workspace /prompt-name` (Copilot).
- MCP aponta para `.vscode/mcp.json`; no Cursor o arquivo gerado é `.cursor/mcp.json`.

**Template corrigido sugerido:**

```markdown
---
description: Specky SDD pipeline rules — EARS, branching, agents, MCP, and quality gates
alwaysApply: true
---

# Specky SDD — Cursor Instructions

This project uses Spec-Driven Development (SDD) via the Specky pipeline.

(... resto do conteúdo, com substituições abaixo ...)
```

**Substituições de conteúdo:**

| Antes | Depois |
|-------|--------|
| `# Specky SDD — Copilot Instructions` | `# Specky SDD — Cursor Instructions` |
| `Use in Copilot Chat with @workspace /prompt-name:` | `Use slash commands in Cursor Chat:` |
| `configured in .vscode/mcp.json` | `configured in .cursor/mcp.json` |
| Rule #4 / Hook section (hooks nativos) | Ver item 2 abaixo |

**Ação APM:**

- Renomear template de `.apm/.../copilot-instructions.mdc` → `cursor-instructions.mdc` (ou `specky-sdd.mdc`).
- Instalar em `.cursor/rules/specky-sdd.mdc`.
- Manter `copilot-instructions.mdc` apenas no target Copilot (`.github/instructions/`).

---

### 2. Hooks: não prometer execução nativa no Cursor

**Problema:** A rule afirma que hooks disparam automaticamente, mas o install Cursor **não instala** `.cursor/hooks/`. Em `config.yml`:

```yaml
# instalado em .claude/hooks/ ou .github/hooks/specky/ — Cursor não listado
```

**Opções para APM (escolher uma):**

**Opção A — Documentar limitação (mínimo, recomendado agora):**

Reescrever seção "Hook Enforcement" na rule Cursor:

```markdown
## Quality Gates (Cursor)

On Cursor, enforcement is primarily via:
1. MCP tools (specky-sdd server) — artifact validation, phase gates, release gates
2. Agent workflows — orchestrator routing and LGTM pauses
3. Project rule — branch and artifact conventions

Native hook scripts (`.claude/hooks/`, `.github/hooks/specky/`) are NOT installed
for Cursor. Do not claim automatic PreToolUse/PostToolUse hook execution in Cursor.
```

**Opção B — Implementar hooks Cursor (recomendado como v3.9+):**

Ver seção completa **[Apêndice A — Implementação de Hooks no target Cursor](#apêndice-a--implementação-de-hooks-no-target-cursor)** abaixo.

**Recomendação:** Opção A imediata (docs honestas); Opção B no próximo minor do Specky.

---

### 3. Unificar definição EARS (conflito entre artefatos)

**Problema:** Dois modelos incompatíveis coexistem:

| Artefato | Modelo EARS |
|----------|-------------|
| Rule + agents (clarify, spec) | 6 padrões: Ubiquitous, Event-driven, State-driven, Optional, Unwanted, Complex |
| `specky-sdd-pipeline/SKILL.md` | Shall, Should, May, If-Then, When-Then, Complex |

**Ação APM:**

- Adotar **um** modelo canônico em todo o pacote (recomendado: 6 padrões EARS da rule, alinhados ao `sdd_validate_ears`).
- Reescrever seção "EARS Notation" em `.apm/skills/specky-sdd-pipeline/SKILL.md`.
- Se Should/May forem necessários, documentar como **níveis de obrigatoriedade dentro** de padrões, não como padrões separados.

**Referência canônica sugerida:**

| Pattern | Format |
|---------|--------|
| Ubiquitous | The system shall... |
| Event-driven | When [event], the system shall... |
| State-driven | While [state], the system shall... |
| Optional | Where [condition], the system shall... |
| Unwanted | If [condition], then the system shall... |
| Complex | While [state], when [event], the system shall... |

---

## P1 — Melhorias estruturais e de conteúdo

### 4. Companion skills — cobrir os 13 agents

**Estado atual:** 8 skills instaladas; 13 agents.

| Agent | Skill atual | Ação |
|-------|-------------|------|
| specky-orchestrator | ✅ dedicada | — |
| specky-onboarding | ✅ dedicada | — |
| specky-implementer | ✅ dedicada | — |
| specky-research-analyst | ✅ dedicada | — |
| specky-test-verifier | ✅ dedicada | — |
| specky-release-engineer | ✅ dedicada | — |
| specky-requirements-engineer | ✅ `specky-sdd-markdown-standard` | OK |
| specky-sdd-init | ⚠️ `specky-sdd-pipeline` (genérica) | Criar `specky-sdd-init/SKILL.md` |
| specky-spec-engineer | ⚠️ genérica | Criar `specky-spec-engineer/SKILL.md` |
| specky-sdd-clarify | ⚠️ genérica | Criar `specky-sdd-clarify/SKILL.md` |
| specky-design-architect | ⚠️ genérica | Criar `specky-design-architect/SKILL.md` |
| specky-task-planner | ⚠️ genérica | Criar `specky-task-planner/SKILL.md` |
| specky-quality-reviewer | ⚠️ genérica | Criar `specky-quality-reviewer/SKILL.md` |

**Manter** `specky-sdd-pipeline` como skill transversal (overview das 10 fases). Cada phase agent deve apontar para skill **dedicada** + pipeline quando relevante.

**Atualizar Rule #7:**

```markdown
7. **Load companion SKILL.md first.** Each agent reads its dedicated skill
   (`.agents/skills/{agent-name}/SKILL.md`). Shared pipeline context lives in
   `specky-sdd-pipeline/SKILL.md`.
```

**Mapeamento agent → skill path:**

```yaml
specky-orchestrator: .agents/skills/specky-orchestrator/SKILL.md
specky-onboarding: .agents/skills/specky-onboarding/SKILL.md
specky-sdd-init: .agents/skills/specky-sdd-init/SKILL.md
specky-requirements-engineer: .agents/skills/specky-sdd-markdown-standard/SKILL.md
specky-research-analyst: .agents/skills/specky-research-analyst/SKILL.md
specky-spec-engineer: .agents/skills/specky-spec-engineer/SKILL.md
specky-sdd-clarify: .agents/skills/specky-sdd-clarify/SKILL.md
specky-design-architect: .agents/skills/specky-design-architect/SKILL.md
specky-task-planner: .agents/skills/specky-task-planner/SKILL.md
specky-quality-reviewer: .agents/skills/specky-quality-reviewer/SKILL.md
specky-implementer: .agents/skills/specky-implementer/SKILL.md
specky-test-verifier: .agents/skills/specky-test-verifier/SKILL.md
specky-release-engineer: .agents/skills/specky-release-engineer/SKILL.md
```

---

### 5. Bugs de conteúdo nos agent templates

Corrigir em `.apm/agents/` (fonte) antes do install:

#### 5.1 Numeração duplicada nos workflows

| Arquivo | Problema |
|---------|----------|
| `specky-requirements-engineer.md` | Dois passos `2.` |
| `specky-research-analyst.md` | Dois passos `2.` |
| `specky-sdd-clarify.md` | Dois passos `2.` |
| `specky-implementer.md` | Dois passos `2.` |
| `specky-release-engineer.md` | Dois passos `2.` |

#### 5.2 Exemplo incorreto — quality-reviewer

**Atual:** "Context: Verification phase has passed"  
**Correto:** Phase 6 (Analyze) roda **após Tasks**, **antes** de Implement/Verify.

```markdown
<example>
Context: Tasks and checklist are complete, ready for analysis
user: "Run the quality review for feature 001"
assistant: "I'll audit completeness, check alignment, and run compliance validation."
<commentary>
Post-tasks analysis is Phase 6, before implementation and verification.
</commentary>
</example>
```

#### 5.3 quality-reviewer — workflow inconsistente com "First step"

O agent tem `**First step:** Read specky-sdd-pipeline SKILL.md` fora da lista numerada, mas o passo 1 da lista é "Read all artifacts". Alinhar:

```markdown
**First step:** Read `.agents/skills/specky-quality-reviewer/SKILL.md`.

**Workflow:**
1. Read all artifacts: SPECIFICATION.md, DESIGN.md, TASKS.md, CHECKLIST.md
   (VERIFICATION.md only if re-running after Phase 8)
2. Call sdd_run_analysis — completeness audit
...
```

#### 5.4 design-architect — falta "First step" explícito

Adicionar (como nos outros agents):

```markdown
**First step:** Read `.agents/skills/specky-design-architect/SKILL.md`.
```

#### 5.5 spec-engineer — referência de skill

**Atual:** `Read the specky-sdd-pipeline SKILL.md`  
**Correto (após criar skill dedicada):** `Read the specky-spec-engineer SKILL.md`

---

### 6. Commands — pequenos ajustes

Os commands em `.cursor/commands/` estão **corretos** no formato. Melhorias opcionais:

**Padronizar frontmatter** em todos os 22 commands:

```markdown
---
description: <ação clara>
argument-hint: <placeholder>
---
```

Commands sem `argument-hint` hoje: `specky-onboarding`, `specky-pipeline-status` — adicionar hints.

**Não migrar** commands para `.cursor/skills/` — manter slash commands + skills em `.agents/skills/` (modelo híbrido válido).

---

### 7. MCP — alinhar documentação e install

**Gerado (correto):** `.cursor/mcp.json`

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd@3.8.0", "serve"]
    }
  }
}
```

**Ações APM:**

- Rule e docs Cursor referenciarem **somente** `.cursor/mcp.json`.
- `.gitignore` template: **não** gitignore `.cursor/mcp.json` (já correto neste projeto).
- Considerar sincronizar versão MCP com `config.yml` version field automaticamente no install.

---

## P2 — Documentação e DX

### 8. Gitignore — documentar expectativa para times

**Estado atual (intencional):** agents, commands, rules, skills são regeneráveis.

**Ação APM — adicionar ao INSTALL.md (seção Cursor):**

```markdown
## After clone (Cursor)

Every developer must run:

  npx specky-sdd@<version> install --target=cursor

This regenerates:
  .cursor/agents/
  .cursor/commands/
  .cursor/rules/
  .agents/skills/

Committed in git:
  .specky/config.yml
  .cursor/mcp.json
  .specs/
```

---

### 9. `config.yml` — comentário hooks

**Atual:**

```yaml
# instalado em .claude/hooks/ ou .github/hooks/specky/
```

**Sugerido:**

```yaml
# Installed per IDE:
#   claude  → .claude/hooks/scripts
#   copilot → .github/hooks/specky/scripts
#   cursor  → MCP-enforced gates (no native hooks in v3.8.0)
#   opencode → TBD
```

---

### 10. Skills — metadados opcionais

Skills Specky **não** precisam de `disable-model-invocation: true` (desejável que sejam descobertas por contexto). Documentar no APM:

```yaml
# Specky skills: omit disable-model-invocation (default auto-discovery)
# User slash-command skills: set disable-model-invocation: true
```

---

## Layout alvo Cursor (referência)

```
projeto/
├── .cursor/
│   ├── agents/          # 13 subagents (*.md)
│   ├── commands/        # 22 slash commands (*.md)
│   ├── rules/
│   │   └── specky-sdd.mdc   # alwaysApply (NÃO copilot-instructions)
│   └── mcp.json         # specky-sdd MCP (versionado)
├── .agents/
│   └── skills/          # MANTER — 8 existentes + 6 novas = 14 skills
│       ├── specky-sdd-pipeline/
│       ├── specky-orchestrator/
│       ├── specky-sdd-init/          # NOVO
│       ├── specky-spec-engineer/     # NOVO
│       ├── specky-sdd-clarify/       # NOVO
│       ├── specky-design-architect/  # NOVO
│       ├── specky-task-planner/     # NOVO
│       ├── specky-quality-reviewer/  # NOVO
│       └── ...
└── .specky/
    └── config.yml       # versionado
```

---

## Checklist de aceite (QA do install Cursor)

Após `specky install --target=cursor`, validar:

- [ ] `.cursor/rules/specky-sdd.mdc` com `alwaysApply: true` + `description`
- [ ] Zero referências a "Copilot" ou `.vscode/mcp.json` nos artefatos Cursor
- [ ] Seção hooks honesta sobre limitações Cursor (ou hooks instalados)
- [ ] EARS idêntico em rule, agents e `specky-sdd-pipeline/SKILL.md`
- [ ] 13 agents com companion skill dedicada em `.agents/skills/`
- [ ] Workflows sem numeração duplicada
- [ ] `quality-reviewer` example descreve Phase 6 corretamente
- [ ] `.agents/skills/` permanece destino (documentado)
- [ ] `install.lock` lista todos os paths acima
- [ ] INSTALL.md documenta `specky install` pós-clone

---

## Arquivos fonte APM a alterar (estimativa)

| Path no pacote Specky | Alteração |
|------------------------|-----------|
| `.apm/targets/cursor/` (ou equivalente) | Rule template, paths, naming |
| `.apm/rules/copilot-instructions.mdc` | Fork → `cursor-instructions.mdc` |
| `.apm/agents/*.md` | Bugs de conteúdo |
| `.apm/skills/specky-sdd-pipeline/SKILL.md` | EARS canônico |
| `.apm/skills/specky-*` (6 novas) | Companion skills dedicadas |
| `.apm/install/cursor.manifest` | Paths + install.lock |
| `docs/INSTALL.md` | Seção Cursor + `.agents/skills/` |
| `.specky/config.yml` template | Comentário hooks + cursor.skills path |

---

## Nota para implementação local (este repo)

As correções acima devem ser feitas **no pacote Specky (APM)**, não manualmente no projeto — senão `specky install` sobrescreve. Exceções versionadas neste repo:

- `.specky/config.yml`
- `.specs/`
- `.cursor/mcp.json`
- Este documento (`docs/SPECKY-CURSOR-INSTALL-IMPROVEMENTS.md`)

Para testar após release APM:

```bash
npx specky-sdd@next install --target=cursor
```

---

## Apêndice A — Implementação de Hooks no target Cursor

O Specky **já tem** os 16 hooks implementados em `.apm/hooks/scripts/` e manifests em:

| Arquivo | Uso atual |
|---------|-----------|
| `.apm/hooks/sdd-hooks.json` | Fonte canônica (matchers `sdd_*`, paths `${CLAUDE_PLUGIN_ROOT}`) |
| `dist/claude-hooks.json` | Claude Code — matchers `mcp__specky__sdd_*` |
| `dist/copilot-hooks.json` | Copilot — matchers `sdd_*`, paths `.github/hooks/specky/scripts/` |

O target Cursor **já prevê** `.cursor/hooks.json` em `dist/cli/lib/paths.js`, mas `copyToCursor()` **não copia** scripts nem manifest (só agents, commands, skills, rules). A implementação é majoritariamente **plumbing de install + adaptador de I/O**.

### A.1 Mapeamento de eventos (Specky → Cursor)

| Evento Specky (`sdd-hooks.json`) | Evento Cursor (`hooks.json`) | Notas |
|----------------------------------|------------------------------|-------|
| `SessionStart` | `sessionStart` | `specky-session-banner.sh` |
| `UserPromptSubmit` | `beforeSubmitPrompt` | `specky-pipeline-guard.sh` — **advisory por padrão** |
| `PreToolUse` (MCP) | `beforeMCPExecution` | Validators + branch + security/release |
| `PreToolUse` (Write/Edit) | `preToolUse` | Branch validator, spec-sync |
| `PostToolUse` (MCP) | `afterMCPExecution` | Phase gate, LGTM, EARS, drift, etc. |
| `PostToolUse` (Write/Edit) | `postToolUse` | spec-sync, auto-checkpoint |
| `Stop` | `stop` | security-scan |

**Base recomendada:** gerar `dist/cursor-hooks.json` a partir de `dist/claude-hooks.json` (já usa `mcp__specky__*`), não a partir de `copilot-hooks.json`.

### A.2 Layout de install Cursor (novo)

```
.cursor/
├── hooks.json              # manifest Cursor (schema version 1)
└── hooks/
    ├── specky-run.sh       # adaptador stdin Cursor → SDD_TOOL_NAME
    └── scripts/            # cópia de .apm/hooks/scripts/*.sh (mesmos 16 scripts)
```

**Gitignore template:** adicionar `.cursor/hooks/` (regenerável), **não** gitignore `.cursor/hooks.json` se quiser versionar o manifest — ou gitignore ambos como hoje (regenerar no install).

### A.3 Adaptador de I/O (peça crítica)

Os scripts Specky esperam:

- `SDD_TOOL_NAME` — ex.: `sdd_write_spec` (sem prefixo MCP)
- `exit 2` — bloqueio (blocking hooks)
- `exit 0` — ok ou advisory

O Cursor envia **JSON no stdin** com formato diferente por evento. Criar `.cursor/hooks/specky-run.sh`:

```bash
#!/bin/bash
# specky-run.sh — adaptador Cursor hooks → scripts Specky
# Uso: specky-run.sh <script-name> [--blocking]
set -euo pipefail

SCRIPT_NAME="$1"
BLOCKING="${2:-}"
HOOK_SCRIPT=".cursor/hooks/scripts/${SCRIPT_NAME}"
INPUT=$(cat)

# Extrair nome da tool MCP (ex.: mcp__specky__sdd_write_spec → sdd_write_spec)
if command -v jq >/dev/null 2>&1; then
  RAW=$(echo "$INPUT" | jq -r '
    .tool_name // .toolName // .mcp_tool // .name //
    .tool_input.tool // empty // ""
  ' 2>/dev/null || true)
  case "$RAW" in
    mcp__specky__*) export SDD_TOOL_NAME="${RAW#mcp__specky__}" ;;
    MCP:*specky*)   export SDD_TOOL_NAME="$(echo "$RAW" | sed 's/.*sdd_/sdd_/')" ;;
    Write|Edit|MultiEdit) export SDD_TOOL_NAME="$RAW" ;;
    *) export SDD_TOOL_NAME="${SDD_TOOL_NAME:-unknown}" ;;
  esac
  # Prompt para pipeline-guard (beforeSubmitPrompt)
  PROMPT=$(echo "$INPUT" | jq -r '.prompt // .user_prompt // .text // ""' 2>/dev/null || true)
  [ -n "$PROMPT" ] && export CLAUDE_USER_PROMPT="$PROMPT"
fi

bash "$HOOK_SCRIPT"
CODE=$?

# Cursor: exit 2 bloqueia; JSON permission para beforeMCPExecution
if [ "$BLOCKING" = "--blocking" ] && [ "$CODE" -eq 2 ]; then
  echo '{"permission":"deny","user_message":"Specky quality gate blocked this action. See Hooks output for details."}'
fi
exit "$CODE"
```

> **Nota APM:** validar campos JSON reais do Cursor por evento (`beforeMCPExecution`, `preToolUse`, `beforeSubmitPrompt`) e ajustar o `jq`. Testar no painel **Hooks** do Cursor.

### A.4 Exemplo `dist/cursor-hooks.json` (fragmento)

Converter o array aninhado do Claude para o **schema flat** do Cursor (`version: 1`):

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      { "command": ".cursor/hooks/specky-run.sh specky-session-banner.sh", "timeout": 5 }
    ],
    "beforeSubmitPrompt": [
      { "command": ".cursor/hooks/specky-run.sh specky-pipeline-guard.sh", "timeout": 5 }
    ],
    "beforeMCPExecution": [
      {
        "command": ".cursor/hooks/specky-run.sh specky-artifact-validator.sh --blocking",
        "matcher": "mcp__specky__sdd_discover|mcp__specky__sdd_research|mcp__specky__sdd_write_spec",
        "failClosed": true,
        "timeout": 10
      },
      {
        "command": ".cursor/hooks/specky-run.sh specky-branch-validator.sh",
        "matcher": "mcp__specky__sdd_",
        "timeout": 5
      }
    ],
    "afterMCPExecution": [
      {
        "command": ".cursor/hooks/specky-run.sh specky-phase-gate.sh --blocking",
        "matcher": "mcp__specky__sdd_write_spec|mcp__specky__sdd_turnkey_spec",
        "failClosed": true,
        "timeout": 10
      },
      {
        "command": ".cursor/hooks/specky-run.sh specky-lgtm-gate.sh",
        "matcher": "mcp__specky__sdd_write_spec|mcp__specky__sdd_write_design|mcp__specky__sdd_write_tasks",
        "timeout": 5
      }
    ],
    "stop": [
      { "command": ".cursor/hooks/specky-run.sh specky-security-scan.sh --blocking", "failClosed": true, "timeout": 30 }
    ]
  }
}
```

**Matchers:** Cursor usa regex JavaScript — espelhar exatamente `dist/claude-hooks.json`.

**Blocking hooks** (`artifact-validator`, `phase-gate`, `security-scan`, `release-gate`): usar `failClosed: true` + `--blocking` no adaptador.

### A.5 Alterações no código APM (checklist)

| Arquivo | Mudança |
|---------|---------|
| `dist/cli/lib/paths.js` | Adicionar `cursor.hooksScripts: .cursor/hooks/scripts` e `cursor.hooksRunner: .cursor/hooks/specky-run.sh` |
| `dist/cli/lib/asset-copier.js` | Em `copyToCursor()`: copiar scripts, adaptador, e `dist/cursor-hooks.json` → `.cursor/hooks.json` |
| `dist/cursor-hooks.json` | **Novo** — build step a partir de `claude-hooks.json` + transform para schema Cursor |
| `.apm/hooks/scripts/specky-run.template.sh` | Template do adaptador (ou gerado no build) |
| `dist/cli/commands/hooks.js` | Incluir `.cursor/hooks/scripts` nos candidates |
| `templates/.gitignore` | Adicionar `.cursor/hooks/` |
| `.specky/config.yml` template | Comentário: `cursor → .cursor/hooks.json + .cursor/hooks/scripts/` |
| `install.lock` | Hashes de hooks.json + scripts |
| `docs/INSTALL.md` | Seção "Cursor hooks" + requisito `jq` |

### A.6 Build step sugerido (`npm run build`)

```typescript
// Pseudocódigo: transform claude-hooks.json → cursor-hooks.json
// 1. Ler dist/claude-hooks.json
// 2. Mapear eventos: PreToolUse(MCP) → beforeMCPExecution, etc.
// 3. Substituir command paths:
//    bash .claude/hooks/scripts/X.sh
//    → .cursor/hooks/specky-run.sh X.sh [--blocking]
// 4. Adicionar failClosed:true nos 4 blocking hooks
// 5. Emitir { version: 1, hooks: { ... } }
```

Manter **uma fonte** (`.apm/hooks/sdd-hooks.json`) e **três manifests compilados** (claude, copilot, cursor).

### A.7 Armadilhas conhecidas (lições do Copilot rc.12–rc.14)

1. **`specky-pipeline-guard` no prompt:** manter **advisory** (exit 0) por padrão. Modo `SPECKY_GUARD=strict` opt-in. Bloquear prompts comuns ("create", "fix", "add") torna o IDE inutilizável.
2. **Matchers amplos demais:** `beforeMCPExecution` com matcher `mcp__specky__` pode ser ok; evitar matchers que peguem `Read`/`Grep` acidentalmente.
3. **`jq` obrigatório:** documentar dependência; fallback gracioso se ausente (exit 0 + warn).
4. **stdin hang:** scripts que fazem `cat` sem `[ -t 0 ]` guard causaram timeout no Copilot — reutilizar guards de `specky-pipeline-guard.sh`.
5. **Não misturar manifests:** nunca copiar `sdd-hooks.json` raw (tem `${CLAUDE_PLUGIN_ROOT}`) para Cursor.

### A.8 Matriz blocking vs advisory (referência)

| Hook | Tipo | Evento Cursor | failClosed |
|------|------|---------------|------------|
| specky-artifact-validator | BLOCKING | beforeMCPExecution | true |
| specky-phase-gate | BLOCKING | afterMCPExecution | true |
| specky-security-scan | BLOCKING | beforeMCPExecution (release) + stop | true |
| specky-release-gate | BLOCKING | beforeMCPExecution (release) | true |
| specky-branch-validator | advisory | beforeMCPExecution, preToolUse | false |
| specky-pipeline-guard | advisory | beforeSubmitPrompt | false |
| specky-lgtm-gate | advisory | afterMCPExecution | false |
| demais 9 hooks | advisory | afterMCPExecution / postToolUse | false |

### A.9 QA pós-implementação

```bash
# Após specky install --target=cursor
npx specky hooks list          # deve listar .cursor/hooks/scripts
npx specky hooks test          # scripts rodam sem crash
# No Cursor: Settings → Hooks → ver entradas carregadas
# Disparar sdd_write_spec sem SPECIFICATION prerequisites → deve bloquear
# Prompt "implement feature X" com pipeline ativo → warning advisory, não block
```

### A.10 Priorização sugerida (APM sprint)

1. **Sprint 1:** adaptador + copy scripts + manifest mínimo (4 blocking + branch-validator)
2. **Sprint 2:** todos os 16 hooks + postToolUse para Write/Edit
3. **Sprint 3:** `beforeSubmitPrompt` pipeline-guard + docs + `specky doctor` drift check

3. **Sprint 3:** `beforeSubmitPrompt` pipeline-guard + docs + `specky doctor` drift check

---

## Apêndice B — Permissões e first-run no Cursor

Hoje o Specky trata permissões de forma **desigual por IDE**:

| IDE | O que o install faz |
|-----|---------------------|
| Claude Code | Merge `.claude/settings.json` — hooks + `permissions.allow` (`SPECKY_REQUIRED_ALLOWS`) |
| Copilot | `.vscode/settings.json` — MCP discovery + agent mode |
| **Cursor** | **Só** `.cursor/mcp.json` — sem settings de permissão, sem hooks |

O próprio `init.js` confirma: `hooks: skipped (Cursor hook schema support is not enabled yet)`.

### B.1 O que o Cursor usa (não é igual ao Claude)

Cursor **não lê** `.claude/settings.json`. Permissões vêm de:

1. **`tools:` no frontmatter** de cada subagent (`.cursor/agents/*.md`) — escopo por agent
2. **Aprovação do usuário** na UI na primeira execução de MCP/shell
3. **Hooks** (`.cursor/hooks.json`) — quando implementados (Apêndice A)
4. **Rules** — contexto, não substituem allow-list

### B.2 Lista mínima de tools por agent (least-privilege)

Espelhar a filosofia de `SPECKY_REQUIRED_ALLOWS` em Claude, mas **por agent**, não global:

| Classe lógica | Cursor native | Agents que precisam |
|---------------|---------------|---------------------|
| `workspace.search` | Read, Glob, Grep | Todos |
| `workspace.edit` | Edit, Write | requirements-engineer, implementer (não orchestrator) |
| `workspace.command` | Shell | release-engineer, implementer (git/npm/npx only via instrução) |
| `web.fetch` | WebFetch, WebSearch | research-analyst apenas |
| `agent.delegate` | Task | orchestrator, onboarding apenas |
| `mcp.specky.*` | mcp__specky__* | Conforme fase — **nunca** listar 58 tools em todo agent |

**Anti-padrão atual:** copiar listas longas de MCP tools no orchestrator/onboarding está correto; **errado** seria dar `Edit/Write/Bash` ao orchestrator (ele só coordena).

**Ação APM:** validar cada `.apm/agents/*.agent.md` com matriz fase → tools mínimos; o harness `cursor` já transforma via `tool-map.js` (`specky/` → `mcp__specky__`).

### B.3 First-run checklist (documentar no INSTALL.md)

Após `specky install --target=cursor`, o dev deve:

```markdown
1. Abrir Cursor → Settings → MCP → confirmar server `specky` enabled
2. Iniciar chat Agent → aprovar tools MCP na primeira invocação (ou enable auto-run se policy do time permitir)
3. Rodar `/specky-onboarding` ou `@specky-onboarding`
4. Rodar `npx specky doctor` — deve passar checks Cursor (Apêndice E)
```

### B.4 Opcional: `.cursor/` settings team-shared

Se o Cursor passar a suportar workspace settings equivalentes, APM pode adicionar writer similar a `vscode-settings-writer.ts`:

```json
{
  "cursor.mcp.enabled": true,
  "cursor.agent.enabled": true
}
```

> **Nota:** confirmar chaves reais na doc Cursor antes de implementar — hoje o gap é **documentação + doctor**, não arquivo inventado.

### B.5 Política de segurança (alinhada ao Specky)

Manter no Cursor o mesmo posture de `settings-merger.js`:

- **Não** pré-autorizar shell arbitrário (`Bash` amplo) via rule
- **Não** pré-autorizar `WebFetch` em agents que não fazem research
- Hooks blocking para release (`security-scan`, `release-gate`) quando Apêndice A estiver ativo
- Documentar `SPECKY_GUARD=advisory` como default para pipeline-guard

---

## Apêndice C — Token performance & efficiency

Specky injeta contexto em **4 camadas** que competem pelo mesmo budget:

```
alwaysApply rule  →  subagent body  →  SKILL.md  →  references/
     (~80 linhas)       (~40–75)         (~86–293)      (on demand)
```

### C.1 Rule slim (P0 — maior ROI de tokens)

A rule gerada hoje repete catálogo de 13 agents + 22 commands + EARS + hooks — conteúdo **já presente** em skills e agents.

**Rule enxuta recomendada (~25–35 linhas, alwaysApply):**

```markdown
---
description: Specky SDD — core pipeline rules (branching, EARS, orchestrator entry)
alwaysApply: true
---

# Specky SDD

1. EARS mandatory — 6 patterns (see `.agents/skills/specky-sdd-pipeline/references/ears-notation.md`)
2. REQ-ID traceability on every requirement, task, and test
3. Artifacts in `.specs/NNN-feature/` on branch `spec/NNN-*` (Phases 0–7)
4. Active pipeline (`.sdd-state.json`) → route via `@specky-orchestrator`; else `@specky-onboarding`
5. Load companion SKILL.md before phase work (`.agents/skills/{agent}/SKILL.md`)
6. MCP: `.cursor/mcp.json` — specky-sdd server

For agents, commands, hooks, and phase detail → invoke `/specky-onboarding` or read skills (do not duplicate here).
```

**Mover para skills / commands (não always-on):**

- Catálogo completo de agents
- Lista de slash commands
- Tabela EARS completa
- Matriz de hooks
- Rule #8 parágrafo longo → 2 linhas na rule + detalhe em `specky-orchestrator` skill

**Economia estimada:** ~400–600 tokens por turno em sessões longas.

### C.2 Rules escopadas por glob (P2)

Adicionar rules **file-scoped** em vez de inflar a rule global:

| Rule file | `globs` | Conteúdo |
|-----------|---------|----------|
| `specky-sdd.mdc` | `alwaysApply: true` | 6 regras core (acima) |
| `specky-spec-artifacts.mdc` | `.specs/**/*.md` | EARS, REQ-ID, markdown standard |
| `specky-app-code.mdc` | `apps/**`, `src/**` | REQ traceability em código |

### C.3 Skills — progressive disclosure

Já parcialmente feito em `specky-sdd-pipeline/references/`. APM deve:

| Skill | Limite SKILL.md | Detalhe em |
|-------|-----------------|------------|
| Cada phase skill | ≤ 150 linhas | `references/*.md` |
| `specky-sdd-pipeline` | ≤ 120 linhas (overview only) | `references/ears-notation.md`, `model-routing.md` |
| `specky-sdd-markdown-standard` | ≤ 200 linhas | exemplos por artifact type |

**Remover de skills:** explicações genéricas de SDD que o model já sabe; manter só o **delta Specky**.

### C.4 Agents — trim examples

| Target | Recomendação |
|--------|--------------|
| Phase agents (0–9) | 1 `<example>` block (não 2) |
| onboarding, orchestrator | 2 examples OK (entry points) |
| Workflow lists | Máx 7 passos; detalhe na skill |

### C.5 Commands — manter ultra-curtos ✅

Commands atuais (6–23 linhas) são **modelo correto**. Delegam para `@agent` sem repetir workflow.

### C.6 Model routing na rule

Rule atual menciona model classes em todo turno. **Mover** tabela completa para skill `references/model-routing.md`; na rule: uma linha “follow phase model class from skill”.

### C.7 Auto-discovery de skills

**Manter** skills Specky **sem** `disable-model-invocation` — discovery por description é desejável.

**Evitar** duplicar a mesma description em rule + skill (duas injeções do mesmo trigger).

---

## Apêndice D — Primitivos canônicos APM (fonte única)

Specky já usa arquitetura correta: **fonte em `.apm/`**, **compiladores por harness**. Cursor install deve garantir completude e consistência.

### D.1 Mapa de primitivos

```
.apm/
├── agents/*.agent.md      → .cursor/agents/*.md       (persona + tools + workflow curto)
├── prompts/*.prompt.md    → .cursor/commands/*.md     (slash commands)
├── skills/*/SKILL.md      → .agents/skills/*/         (playbooks — MANTER path)
├── instructions/*.md      → .cursor/rules/*.mdc       (rules)
├── hooks/scripts/*.sh     → .cursor/hooks/scripts/    (via Apêndice A)
└── hooks/sdd-hooks.json   → dist/cursor-hooks.json    (build step)
```

### D.2 Schema obrigatório por primitivo

#### Agent (`.apm/agents/*.agent.md`)

```yaml
---
name: kebab-case
description: "Third person. WHAT + WHEN triggers. Max ~200 chars."
color: optional
tools: ["search", "agent", "specky/sdd_*"]  # logical ids — harness compila
---
```

Corpo:

1. 0–2 blocos `<example>`
2. `**First step:** Read {companion} SKILL.md`
3. `**Workflow:**` numerado sem duplicatas
4. `**Hard rules:**` bullets

#### Command (`.apm/prompts/*.prompt.md`)

```yaml
---
description: Imperative one line
argument-hint: <placeholder>
---
```

Corpo: 1 parágrafo + delegação `@agent` ou lista numerada curta.

#### Skill (`.apm/skills/*/SKILL.md`)

```yaml
---
name: kebab-case
description: "Third person. Trigger-rich. WHAT + WHEN."
---
```

Corpo: ≤ 500 linhas; links para `references/`; sem duplicar rule always-on.

#### Rule (gerar `specky-sdd.mdc` para Cursor)

```yaml
---
description: One line
alwaysApply: true   # ou globs para rules escopadas
---
```

### D.3 Validação APM (`apm-policy.yml` + CI)

Já existe isolamento Cursor em `apm-policy.yml`:

```yaml
cursor:
  forbidToolTokens:
    - "specky/"      # deve ser mcp__specky__*
    - '"search"'     # deve ser Read/Glob/Grep
    - '"agent"'      # deve ser Task
```

**Estender CI:**

- [ ] Todo agent tem `name`, `description`, `tools`
- [ ] Todo agent phase tem companion skill (Apêndice 4)
- [ ] Nenhum `.cursor/agents/*.md` > 80 linhas (token budget)
- [ ] Nenhum SKILL.md > 500 linhas
- [ ] Rule always-on ≤ 40 linhas
- [ ] Zero token Copilot (`specky/`, `applyTo`, `@workspace`) em output Cursor

### D.4 Templates `.specs/` (artefatos gerados pelo MCP)

Separados dos primitivos de install — vivem em `templates/`:

- `constitution.md`, `specification.md`, `design.md`, `tasks.md`, etc.
- Usados pelas tools `sdd_*`, não pelo `specky install`

**Ação APM:** garantir que templates sigam `specky-sdd-markdown-standard` (frontmatter YAML, REQ-IDs, headings H1–H4).

### D.5 Matriz de completude (13 agents)

| Agent | Agent md | Command(s) | Companion skill | Tools audit |
|-------|----------|------------|-----------------|-------------|
| specky-onboarding | ✅ | ✅ | ✅ | Task + read + MCP discover |
| specky-orchestrator | ✅ | ✅ | ✅ | Task + MCP status/routing |
| specky-sdd-init | ✅ | via greenfield | ⚠️ shared | MCP init/branch/scan |
| specky-requirements-engineer | ✅ | greenfield/brownfield | ✅ markdown-standard | Edit/Write + MCP import |
| specky-research-analyst | ✅ | research | ✅ | Web + MCP discover |
| specky-spec-engineer | ✅ | specify | ⚠️ criar | MCP write_spec/ears |
| specky-sdd-clarify | ✅ | clarify | ⚠️ criar | MCP clarify/ears |
| specky-design-architect | ✅ | design | ⚠️ criar | MCP design/diagrams |
| specky-task-planner | ✅ | tasks | ⚠️ criar | MCP tasks/checklist |
| specky-quality-reviewer | ✅ | — | ⚠️ criar | MCP analysis |
| specky-implementer | ✅ | implement | ✅ | Edit + MCP implement |
| specky-test-verifier | ✅ | verify | ✅ | MCP verify/sync |
| specky-release-engineer | ✅ | release | ✅ | MCP release/PR |

---

## Apêndice E — `specky doctor` & pipeline install Cursor

### E.1 Gap atual

`doctor.js` para Cursor só verifica:

```javascript
checkMcpRegistration(targets.cursor.mcp, ".cursor/mcp.json")
```

Claude recebe checks de permissions; Copilot de vscode settings; **Cursor quase nada**.

### E.2 Checks recomendados para target Cursor

| Check | Pass criteria |
|-------|---------------|
| MCP registration | `.cursor/mcp.json` exists, server `specky`, version pinned |
| Agents installed | 13 files in `.cursor/agents/specky-*.md` |
| Commands installed | 22 files in `.cursor/commands/specky-*.md` |
| Skills installed | ≥ 14 dirs in `.agents/skills/specky-*` |
| Rule format | `.cursor/rules/specky-sdd.mdc` has `alwaysApply` + `description` |
| Rule size | always-on rule ≤ 40 lines (warn if larger) |
| Hooks (post A) | `.cursor/hooks.json` + 16 scripts |
| No Copilot leakage | grep: zero `applyTo`, `@workspace`, `.vscode/mcp` in `.cursor/` |
| install.lock drift | hashes match for tracked files |
| Version drift | install.json version == CLI version |

### E.3 `installCursor()` — sequência alvo

```typescript
function installCursor(ctx) {
  copyToCursor(...)           // agents, commands, skills, rules
  writeMcpRegistration(...)   // .cursor/mcp.json ✅ já existe
  copyCursorHooks(...)        // Apêndice A — NOVO
  writeInstallLock(...)       // incluir hooks + mcp
  // opcional futuro:
  // writeCursorFirstRunDoc(...) → docs/SPECKY-CURSOR-SETUP.md
  console.log("  First run: enable MCP in Cursor Settings, then /specky-onboarding")
}
```

### E.4 Gitignore template (completo Cursor)

```gitignore
.cursor/agents/
.cursor/commands/
.cursor/rules/
.cursor/hooks/          # NOVO — scripts regeneráveis
# KEEP:
#   .cursor/mcp.json
#   .cursor/hooks.json  # opcional versionar se estável
.agents/skills/
```

3. **Sprint 3:** `beforeSubmitPrompt` pipeline-guard + docs + `specky doctor` drift check

---

## Apêndice F — Modelo APM + Specky (como deve funcionar no Cursor)

Esta seção alinha este documento com a arquitetura oficial descrita em:

- [paulasilvatech/specky](https://github.com/paulasilvatech/specky) — pacote npm `specky-sdd`, CLI `specky`, primitives em `.apm/`
- [paulasilvatech/apm](https://github.com/paulasilvatech/apm) — Agent Package Manager (fork/evolução do [microsoft/apm](https://github.com/microsoft/apm))
- [Specky docs/APM-USAGE.md](https://github.com/paulasilvatech/specky/blob/main/docs/APM-USAGE.md) — governança APM **embutida** no Specky

### F.1 Dois “APM” — não confundir

| Conceito | O que é | Quem usa |
|----------|---------|----------|
| **Microsoft/paulasilva APM CLI** | `apm install`, `apm.yml`, lockfile, policy inheritance, multi-client | Futuro/ecossistema; `.agents/skills/` é path padrão APM |
| **Specky APM (embutido)** | `apm.yml` + `apm.lock.yaml` + `apm-policy.yml` **dentro do pacote** `specky-sdd`; comandos `specky apm validate\|lock\|policy\|sbom` | Mantenedores Specky + CI; **usuário final NÃO precisa instalar APM CLI** |

> Specky usa APM como **manifesto + governança + reproducibilidade**, não como proxy de runtime MCP.

### F.2 As 4 camadas (fluxo correto)

```text
Camada 1 — Fonte canônica (NUNCA editar por harness)
  specky-sdd/.apm/agents/
  specky-sdd/.apm/prompts/
  specky-sdd/.apm/skills/
  specky-sdd/.apm/hooks/
  specky-sdd/.apm/instructions/

Camada 2 — Governança (mantenedor / CI)
  apm.yml          → declara primitives + targets + MCP
  apm.lock.yaml    → SHA256 dos primitives empacotados
  apm-policy.yml   → isolamento de tool names por harness
  specky apm validate | lock | verify-lock | policy

Camada 3 — Compilação harness (install no projeto)
  specky install --target=cursor
  harness compiler (src/cli/lib/harness/compilers/cursor.ts)
  tool-map.js: specky/sdd_* → mcp__specky__sdd_*

Camada 4 — Runtime MCP (execução)
  .cursor/mcp.json → npx -y specky-sdd@<versão> serve
  58 tools sdd_* (state machine, EARS, gates)
  Hooks nativos Cursor (quando Apêndice A implementado)
```

**Runtime direto:** `Cursor → MCP client → specky serve → sdd_*` (APM não intercepta tool calls).

### F.3 Layout oficial Cursor (INSTALL.md 3.8)

Conforme [docs/INSTALL.md](https://github.com/paulasilvatech/specky/blob/main/docs/INSTALL.md):

```text
projeto/
├── .cursor/
│   ├── agents/           # 13 subagents (tools: Read, mcp__specky__*)
│   ├── commands/         # 22 slash commands
│   ├── rules/            # rule(s) always-on / scoped
│   ├── mcp.json          # VERSIONADO — registrar specky MCP
│   └── hooks.json        # FALTANDO hoje — Apêndice A
│   └── hooks/scripts/    # FALTANDO hoje — cópia de .apm/hooks/scripts
├── .agents/skills/       # skills compiladas (path APM padrão + Cursor)
├── .specky/
│   ├── config.yml        # VERSIONADO — config pipeline projeto
│   └── install.json      # metadata do install
└── .specs/               # VERSIONADO — artefatos SDD gerados pelo MCP
```

**Comando canônico:**

```bash
npm install -g specky-sdd@latest   # ou devDependency + npx
cd seu-projeto
specky install --target=cursor     # NÃO usar --ide (deprecated)
specky doctor
```

### F.4 Mapeamento primitivo → Cursor (compilador)

| Primitive `.apm/` | Cursor output | Transformação harness |
|-------------------|---------------|------------------------|
| `agents/*.agent.md` | `.cursor/agents/*.md` | `tools: ["specky/sdd_*"]` → `mcp__specky__sdd_*`; remove `specky/`, `search`, `agent` |
| `prompts/*.prompt.md` | `.cursor/commands/*.md` | Remove `agent: agent` (Copilot-only) |
| `skills/*/SKILL.md` | `.agents/skills/*/SKILL.md` | Cópia direta (path APM) |
| `instructions/*.md` | `.cursor/rules/*.mdc` | `compileInstruction` → frontmatter Cursor |
| `hooks/scripts/*.sh` | `.cursor/hooks/scripts/` | Apêndice G.1–G.2 — build + `copyToCursor()` |
| `hooks/sdd-hooks.json` | `.cursor/hooks.json` | Build → `dist/cursor-hooks.json` — Apêndice G.1 |
| MCP em `apm.yml` | `.cursor/mcp.json` | `writeMcpRegistration` ✅ |

**Policy (`apm-policy.yml`)** já valida isolamento Cursor:

```yaml
cursor:
  forbidToolTokens: ["specky/", '"search"', '"agent"']
```

### F.5 O que “instalar tudo corretamente” significa

Para o Cursor ter **paridade funcional** com Claude/Copilot:

| Componente | Claude | Copilot | Cursor hoje | Cursor alvo |
|------------|--------|---------|-------------|-------------|
| Agents | ✅ | ✅ | ✅ | ✅ |
| Commands/prompts | ✅ | ✅ | ✅ | ✅ |
| Skills | `.claude/skills` | `.github/skills` | `.agents/skills` ✅ | **manter** |
| Rules/instructions | `.claude/rules` | `.github/instructions` | ⚠️ formato Copilot | `specky-sdd.mdc` slim |
| Hooks | ✅ settings+scripts | ✅ `.github/hooks` | ❌ skipped | Apêndice A |
| MCP config | `.mcp.json` | `.vscode/mcp.json` | `.cursor/mcp.json` ✅ | ✅ |
| Permissions pre-auth | `settings.json` allow | vscode settings | ❌ (UI Cursor) | Apêndice B + docs |
| Doctor checks | ✅ | ✅ | ⚠️ mcp only | Apêndice E |
| install.lock drift | ✅ | ✅ | parcial | incluir hooks+mcp |

**Experiência completa Specky** = agents + prompts + skills + hooks + MCP + rule slim — não só MCP.

### F.6 Integração futura com Microsoft/paulasilva APM CLI

Quando o ecossistema APM madurar, um projeto consumidor poderia:

```yaml
# apm.yml do projeto consumidor (futuro)
dependencies:
  apm:
    - paulasilvatech/specky#v3.8.0
targets:
  - cursor
```

Hoje o caminho suportado é **`specky install --target=cursor`** (Specky embute sua própria governança APM). O APM CLI externo e o compilador Specky devem **convergir no mesmo layout Cursor** acima — especialmente `.agents/skills/` (já alinhado com [paulasilvatech/apm](https://github.com/paulasilvatech/apm)).

**Ação APM (Microsoft fork + Specky):**

1. Documentar target `cursor` em APM-USAGE.md §6 (hoje só Copilot + Claude)
2. Adicionar `apm compile -t cursor` → `AGENTS.md` + assets (Specky já tem `specky compile --target=cursor`)
3. Alinhar `apm.lock.yaml` do consumidor com outputs Cursor
4. Atualizar APM-USAGE §13 “Limites atuais” — Cursor já existe em 3.8

### F.7 Fluxo mantenedor (checklist unificado)

```bash
# No repo specky, antes de publicar
npm run build                    # gera dist/claude-hooks.json, dist/copilot-hooks.json
                                 # ADICIONAR: dist/cursor-hooks.json
npm test
specky apm validate
specky apm policy                # valida forbidToolTokens cursor
specky apm verify-lock
# Teste install Cursor em sandbox
specky install --target=cursor --force
specky doctor                    # deve passar checks Apêndice E
```

### F.8 Fluxo usuário Cursor (checklist)

```bash
specky install --target=cursor
specky doctor
# Cursor Settings → MCP → enable specky
/specky-onboarding               # ou @specky-onboarding
@specky-orchestrator             # pipeline completo
```

Após hooks (Apêndice A): gates blocking passam a valer nativamente no Cursor, não só via instruções do agent.

---

## Apêndice G — Implementação completa (sem decisões pendentes)

Este apêndice fecha os 4 gaps que impediam implementação “copy-paste”: **build script**, **6 skills**, **patches TS**, **testes**.

### G.1 Build script — `dist/cursor-hooks.json` completo

**Decisão:** estender `scripts/build-claude-hooks.mjs` → renomear para `scripts/build-hook-manifests.mjs` (gera Claude + Copilot + Cursor).

**Arquivos:**

| Arquivo | Ação |
|---------|------|
| `scripts/build-hook-manifests.mjs` | Renomear + adicionar bloco Cursor abaixo |
| `.apm/hooks/specky-run.sh` | Novo — adaptador stdin Cursor (copiado para `.cursor/hooks/` no install) |
| `dist/cursor-hooks.json` | Gerado no build (não editar manualmente) |
| `package.json` | `"build": "... && node scripts/build-hook-manifests.mjs && ..."` |

**Constantes Cursor (adicionar ao script):**

```javascript
const CURSOR_OUTPUT = resolve(ROOT, "dist/cursor-hooks.json");
const CURSOR_SCRIPTS_PATH = ".cursor/hooks/scripts/";
const CURSOR_RUNNER = ".cursor/hooks/specky-run.sh";
const BLOCKING_SCRIPTS = new Set([
  "specky-artifact-validator.sh",
  "specky-phase-gate.sh",
  "specky-security-scan.sh",
  "specky-release-gate.sh",
]);

// Claude event → Cursor hooks.json key
const CURSOR_EVENT_MAP = {
  SessionStart: "sessionStart",
  UserPromptSubmit: "beforeSubmitPrompt",
  Stop: "stop",
};
// PreToolUse/PostToolUse split by matcher below
```

**Algoritmo `buildCursorHooks(claudeManifest)`:**

```javascript
function scriptNameFromCommand(cmd) {
  const m = cmd.match(/\/(specky-[^/\s]+\.sh)/);
  return m ? m[1] : null;
}

function cursorHookEntry(group, event) {
  const script = scriptNameFromCommand(group.hooks[0]?.command ?? "");
  if (!script) return null;
  const blocking = BLOCKING_SCRIPTS.has(script);
  const flags = blocking ? " --blocking" : "";
  const entry = {
    command: `${CURSOR_RUNNER} ${script}${flags}`,
    timeout: group.hooks[0]?.timeout ?? 10,
  };
  if (blocking) entry.failClosed = true;

  const matcher = group.matcher ?? "";
  const isNativeWrite = /^(Write|Edit|MultiEdit)(\|(Write|Edit|MultiEdit))*$/.test(matcher);

  if (event === "PreToolUse" || event === "PostToolUse") {
    if (isNativeWrite) {
      entry.matcher = "Write|Edit";
      return { bucket: event === "PreToolUse" ? "preToolUse" : "postToolUse", entry };
    }
    if (matcher.includes("mcp__specky__") || !NATIVE_TOOLS.has(matcher.split("|")[0])) {
      entry.matcher = matcher; // already mcp__specky__* from claude transform
      return { bucket: event === "PreToolUse" ? "beforeMCPExecution" : "afterMCPExecution", entry };
    }
  }

  const cursorEvent = CURSOR_EVENT_MAP[event];
  if (!cursorEvent) return null;
  if (matcher) entry.matcher = matcher;
  return { bucket: cursorEvent, entry };
}

function buildCursorManifest(claudeManifest) {
  const hooks = {};
  for (const [event, groups] of Object.entries(claudeManifest)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const mapped = cursorHookEntry(group, event);
      if (!mapped) continue;
      hooks[mapped.bucket] ??= [];
      hooks[mapped.bucket].push(mapped.entry);
    }
  }
  return { version: 1, hooks };
}
```

**No `main()`**, após escrever Copilot:

```javascript
const cursorManifest = buildCursorManifest(claudeHooks);
await writeManifest(CURSOR_OUTPUT, cursorManifest, "build-cursor-hooks");
```

**Saída esperada:** `dist/cursor-hooks.json` com ~40 entradas espelhando `dist/claude-hooks.json`, chaves:

- `sessionStart` (1)
- `beforeSubmitPrompt` (1)
- `beforeMCPExecution` (~10 grupos)
- `afterMCPExecution` (~10 grupos)
- `preToolUse` (1 — Write|Edit)
- `postToolUse` (1 — Write|Edit)
- `stop` (1)

**Validação build:**

```bash
node scripts/build-hook-manifests.mjs
test -f dist/cursor-hooks.json
node -e "const j=require('./dist/cursor-hooks.json'); if(j.version!==1||!j.hooks.beforeMCPExecution) process.exit(1)"
```

---

### G.2 Adaptador — `.apm/hooks/specky-run.sh` (copiar no install)

Criar em `.apm/hooks/specky-run.sh` e copiar para `.cursor/hooks/specky-run.sh` (chmod +x):

```bash
#!/usr/bin/env bash
# specky-run.sh — Cursor hook adapter → Specky .apm hook scripts
set -euo pipefail
SCRIPT="${1:?usage: specky-run.sh <script-name> [--blocking]}"
BLOCKING="${2:-}"
HOOK=".cursor/hooks/scripts/${SCRIPT}"
INPUT=$(cat || true)

if command -v jq >/dev/null 2>&1 && [ -n "$INPUT" ]; then
  RAW=$(echo "$INPUT" | jq -r '
    .tool_name // .toolName // .tool // .mcpTool // empty
  ' 2>/dev/null || true)
  case "$RAW" in
    mcp__specky__*) export SDD_TOOL_NAME="${RAW#mcp__specky__}" ;;
    MCP:*|*mcp__specky__*) export SDD_TOOL_NAME="$(echo "$RAW" | sed -n 's/.*sdd_/sdd_/p')" ;;
    Write|Edit|MultiEdit) export SDD_TOOL_NAME="$RAW" ;;
  esac
  PROMPT=$(echo "$INPUT" | jq -r '.prompt // .user_prompt // .text // empty' 2>/dev/null || true)
  [ -n "$PROMPT" ] && export CLAUDE_USER_PROMPT="$PROMPT"
fi

bash "$HOOK"
CODE=$?

if [ "$BLOCKING" = "--blocking" ] && [ "$CODE" -eq 2 ]; then
  echo '{"permission":"deny","user_message":"Specky quality gate blocked this action."}'
fi
exit "$CODE"
```

---

### G.3 Seis companion skills — conteúdo canônico

Criar em `.apm/skills/{name}/SKILL.md`. Cada skill: frontmatter + workflow + hard rules + link para `specky-sdd-pipeline/references/ears-notation.md` quando relevante.

#### G.3.1 `specky-sdd-init/SKILL.md`

```markdown
---
name: specky-sdd-init
description: "Use when initializing Phase 0 (Init): scaffold .specs/NNN-feature/, CONSTITUTION.md, .sdd-state.json, and spec branch from develop. Trigger on sdd_init, greenfield setup, or new feature bootstrap."
---

# Phase 0 — Init

## Prerequisites
- Feature name and project type (greenfield | brownfield | migration | API)
- Branch `develop` exists (or document exception)

## Workflow
1. Gather feature name, type, constraints
2. Read FRD/NFRD from `docs/requirements/` if present
3. Call `sdd_init` — creates `.specs/NNN-feature/` + CONSTITUTION.md + `.sdd-state.json`
4. Call `sdd_create_branch` — `spec/NNN-feature-name` from `develop`
5. Brownfield: call `sdd_scan_codebase`
6. Present CONSTITUTION.md; wait for developer confirmation
7. Hand off to `@specky-research-analyst`

## Outputs (only these)
- `CONSTITUTION.md`
- `.sdd-state.json`

## Hard rules
- Never assign NNN manually — `sdd_init` owns numbering
- Never write artifacts beyond Phase 0
- Branch: `spec/NNN-*` from `develop`, never from `main`/`stage`
```

#### G.3.2 `specky-spec-engineer/SKILL.md`

```markdown
---
name: specky-spec-engineer
description: "Use for Phase 2 (Specify): write SPECIFICATION.md with EARS, REQ-IDs, and acceptance criteria. Trigger on sdd_write_spec, sdd_turnkey_spec, sdd_validate_ears, or /specky-specify."
---

# Phase 2 — Specify

## Prerequisites
- `CONSTITUTION.md`, `RESEARCH.md` on `spec/NNN-*`

## Workflow
1. Read CONSTITUTION.md + RESEARCH.md
2. Call `sdd_write_spec` or `sdd_turnkey_spec`
3. Optional: `sdd_figma_to_spec`
4. Call `sdd_validate_ears` — fix all failures
5. Present SPECIFICATION.md for LGTM (Phase 2 gate)

## EARS (canonical 6 patterns)
See `../specky-sdd-pipeline/references/ears-notation.md`

## REQ-ID format
`REQ-{DOMAIN}-{NNN}` — unique, uppercase domain

## Hard rules
- Every requirement: EARS pattern + REQ-ID + measurable acceptance criteria
- Always run `sdd_validate_ears` before presenting
- Branch must be `spec/NNN-*`
```

#### G.3.3 `specky-sdd-clarify/SKILL.md`

```markdown
---
name: specky-sdd-clarify
description: "Use for Phase 3 (Clarify): resolve ambiguous requirements, validate EARS, produce CLARIFICATION-LOG.md. Trigger on sdd_clarify or /specky-clarify."
---

# Phase 3 — Clarify

## Prerequisites
- `SPECIFICATION.md` exists

## Workflow
1. Read SPECIFICATION.md
2. Call `sdd_clarify` — max 5 questions per round
3. Wait for developer answers
4. Call `sdd_validate_ears`
5. Rewrite non-compliant requirements
6. Loop until EARS passes
7. Write/update CLARIFICATION-LOG.md

## Hard rules
- Max 5 disambiguation questions per round
- Do not advance to Design until ambiguities resolved
```

#### G.3.4 `specky-design-architect/SKILL.md`

```markdown
---
name: specky-design-architect
description: "Use for Phase 4 (Design): produce DESIGN.md with architecture, API contracts, data model, Mermaid diagrams. Trigger on sdd_write_design, sdd_generate_all_diagrams, or /specky-design."
---

# Phase 4 — Design

## Prerequisites
- Approved SPECIFICATION.md (LGTM Phase 2)

## Workflow
1. Read SPECIFICATION.md + CONSTITUTION.md
2. Call `sdd_write_design` — C4, API contracts, data model, deployment
3. Call `sdd_generate_all_diagrams`
4. Trace every design decision to REQ-ID
5. Present DESIGN.md for LGTM (Phase 4 gate)

## Hard rules
- API contracts cover all functional REQ-IDs
- Diagrams: Mermaid only
- Branch: `spec/NNN-*`
```

#### G.3.5 `specky-task-planner/SKILL.md`

```markdown
---
name: specky-task-planner
description: "Use for Phase 5 (Tasks): produce TASKS.md + CHECKLIST.md with dependencies, REQ traceability, complexity. Trigger on sdd_write_tasks, sdd_checklist, or /specky-tasks."
---

# Phase 5 — Tasks

## Prerequisites
- Approved DESIGN.md (LGTM Phase 4)

## Workflow
1. Read DESIGN.md + SPECIFICATION.md
2. Call `sdd_write_tasks` — TASK-NNN, [P], S/M/L/XL, REQ links
3. Call `sdd_checklist` — security, testing, NFR domains
4. Present for LGTM (Phase 5 gate)

## Hard rules
- Every task traces to ≥1 REQ-ID
- Parallel tasks marked `[P]`
- Dependencies explicit
```

#### G.3.6 `specky-quality-reviewer/SKILL.md`

```markdown
---
name: specky-quality-reviewer
description: "Use for Phase 6 (Analyze): completeness audit, cross-analysis, compliance, ANALYSIS.md gate decision. Trigger on sdd_run_analysis, sdd_cross_analyze, sdd_compliance_check."
---

# Phase 6 — Analyze

## Prerequisites
- TASKS.md, CHECKLIST.md complete on `spec/NNN-*` (or post-merge on `develop` per project policy)

## Workflow
1. Read SPECIFICATION.md, DESIGN.md, TASKS.md, CHECKLIST.md
2. Call `sdd_run_analysis`
3. Call `sdd_cross_analyze`
4. Call `sdd_check_sync` if code exists
5. Optional: `sdd_compliance_check` (SOC2, HIPAA, GDPR, PCI-DSS, ISO 27001)
6. Write ANALYSIS.md — gate: APPROVE | CONDITIONAL | REJECT
7. Write COMPLIANCE.md if compliance ran
8. Call `sdd_metrics`

## Gate rules
- REJECT blocks pipeline
- CONDITIONAL lists required fixes
- Never APPROVE if pass rate < 90% or critical drift

## Hard rules
- Evidence-based findings only
- Phase 6 runs after Tasks, before Implement/Verify
```

**Atualizar agents** para apontar skill dedicada (ex.: `specky-sdd-init` → `specky-sdd-init/SKILL.md`, não só `specky-sdd-pipeline`).

---

### G.4 Patches TypeScript concretos

Paths relativos ao repo `paulasilvatech/specky` (`src/cli/`).

#### G.4.1 `src/cli/lib/paths.ts`

```typescript
// Em targetPaths().cursor, adicionar:
hooksScripts: resolve(cursor, "hooks/scripts"),
hooksRunner: resolve(cursor, "hooks/specky-run.sh"),
hooksManifest: resolve(cursor, "hooks.json"), // já existe

// Em sourcePaths(), adicionar:
cursorHooksManifest: resolve(pkgRoot, "dist/cursor-hooks.json"),
speckyRunScript: resolve(pkgRoot, ".apm/hooks/specky-run.sh"),
```

#### G.4.2 `src/cli/lib/asset-copier.ts` — `copyToCursor()`

```typescript
export function copyToCursor(pkgRoot, targets, opts) {
  const src = sourcePaths(pkgRoot);
  const result = { written: [], skipped: [] };
  const cursor = getCompiler("cursor");

  copyDir(src.agentsDir, targets.cursor.agents, opts, result, ...);
  copyDir(src.promptsDir, targets.cursor.commands, opts, result, ...);
  copyDir(src.skillsDir, targets.shared.agentSkills, opts, result);

  // NOVO: instruction Cursor-native
  const instructionSrc = resolve(src.instructionsDir, "cursor-instructions.instructions.md");
  const fallbackSrc = resolve(src.instructionsDir, "copilot-instructions.instructions.md");
  const ruleSrc = existsSync(instructionSrc) ? instructionSrc : fallbackSrc;
  copyFile(ruleSrc, resolve(targets.cursor.rules, "specky-sdd.mdc"), opts, result, cursor.compileInstruction);

  // NOVO: hooks
  copyDir(src.hookScriptsDir, targets.cursor.hooksScripts, opts, result);
  copyFile(src.speckyRunScript, targets.cursor.hooksRunner, opts, result);
  if (existsSync(src.cursorHooksManifest)) {
    copyFile(src.cursorHooksManifest, targets.cursor.hooksManifest, opts, result);
  }

  chmodHookScripts(targets.cursor.hooksScripts, opts);
  chmodHookScripts(dirname(targets.cursor.hooksRunner), opts); // specky-run.sh

  return result;
}
```

#### G.4.3 `src/cli/commands/init.ts` — `installCursor()`

```typescript
function installCursor(ctx) {
  console.log("[specky init] Installing to .cursor/ …");
  const r = copyToCursor(ctx.pkg, ctx.targets, ctx.copyOpts);
  console.log(summarizeCopy(".cursor", r));
  const mcp = writeMcpRegistration(ctx.targets.cursor.mcp, { ... });
  console.log(`  .cursor/mcp.json: ${mcp.action}`);
  console.log(`  .cursor/hooks.json: ${existsSync(ctx.targets.cursor.hooksManifest) ? "installed" : "skipped"}`);
  console.log("");
  return r;
}
```

#### G.4.4 `src/cli/commands/hooks.ts`

```typescript
const candidates = [
  t.cursor.hooksScripts,  // NOVO — first for cursor-only workspaces
  t.claude.hooksScripts,
  t.copilot.hooksScripts,
];
```

#### G.4.5 `src/cli/commands/doctor.ts`

```typescript
function checkCursorInstall(targets, workspace) {
  const checks = [];
  checks.push(checkMcpRegistration(targets.cursor.mcp, ".cursor/mcp.json"));
  checks.push(checkFileCount(targets.cursor.agents, 13, "Cursor agents"));
  checks.push(checkFileCount(resolve(targets.cursor.commands), 22, "Cursor commands"));
  checks.push(checkFileExists(targets.cursor.rules + "/specky-sdd.mdc", "Cursor rule"));
  checks.push(checkNoCopilotLeak(resolve(targets.cursor.root)));
  checks.push(checkFileExists(targets.cursor.hooksManifest, "Cursor hooks.json"));
  checks.push(checkFileCount(targets.cursor.hooksScripts, 16, "Cursor hook scripts"));
  return checks;
}
```

#### G.4.6 `src/cli/lib/gitignore-writer.ts`

Adicionar ao bloco Specky:

```
.cursor/hooks/
```

Manter `.cursor/mcp.json` na lista KEEP.

#### G.4.7 `src/cli/lib/harness/compilers/cursor.ts` — `compileInstruction`

Gerar frontmatter Cursor:

```typescript
compileInstruction(content) {
  const body = content.replace(/^---[\s\S]*?---\n/, "");
  return `---\ndescription: Specky SDD pipeline rules\nalwaysApply: true\n---\n${body}`;
}
```

#### G.4.8 Novo primitive — `.apm/instructions/cursor-instructions.instructions.md`

Usar texto **Apêndice C.1** (rule slim) + seção Quality Gates honesta (Apêndice A ou B se hooks ainda não instalados).

#### G.4.9 `apm-policy.yml` — adicionar eventos Cursor (se validar hooks.json)

```yaml
hooks:
  allowedEvents:
    # existentes...
    - sessionStart
    - beforeSubmitPrompt
    - beforeMCPExecution
    - afterMCPExecution
    - preToolUse
    - postToolUse
    - stop
```

---

### G.5 Testes de regressão (Vitest)

**Arquivo:** `tests/cli/cursor-target.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { packageRoot, sourcePaths, targetPaths } from "../../src/cli/lib/paths.js";
import { getCompiler } from "../../src/cli/lib/harness/index.js";

const ROOT = packageRoot();
const src = sourcePaths(ROOT);

describe("cursor hooks build", () => {
  it("dist/cursor-hooks.json exists after build", () => {
    expect(existsSync(src.cursorHooksManifest)).toBe(true);
  });

  it("cursor manifest has version 1 and MCP hooks", () => {
    const j = JSON.parse(readFileSync(src.cursorHooksManifest, "utf8"));
    expect(j.version).toBe(1);
    expect(j.hooks.beforeMCPExecution?.length).toBeGreaterThan(0);
    expect(j.hooks.afterMCPExecution?.length).toBeGreaterThan(0);
  });

  it("blocking hooks set failClosed", () => {
    const j = JSON.parse(readFileSync(src.cursorHooksManifest, "utf8"));
    const all = Object.values(j.hooks).flat();
    const blocking = all.filter((h) => h.command?.includes("--blocking"));
    expect(blocking.every((h) => h.failClosed === true)).toBe(true);
  });
});

describe("cursor compiler isolation", () => {
  const sample = `---
name: test
tools: ["search", "agent", "specky/sdd_init"]
---
body`;

  it("maps specky/ to mcp__specky__", () => {
    const out = getCompiler("cursor").compileAgent(sample);
    expect(out).toContain("mcp__specky__sdd_init");
    expect(out).not.toContain("specky/");
    expect(out).not.toContain('"search"');
    expect(out).toContain("Task");
  });
});

describe("copyToCursor integration", () => {
  it("installs hooks + rule + skills paths", async () => {
    // use temp dir fixture — run copyToCursor, assert:
    // .cursor/hooks.json, .cursor/hooks/scripts/*.sh (16),
    // .cursor/rules/specky-sdd.mdc, .agents/skills/specky-sdd-init/
  });
});
```

**Arquivo:** `tests/apm/policy-cursor.test.ts`

```typescript
it("rejects Copilot tool tokens in cursor agent output", () => {
  const bad = "tools: search, agent, specky/sdd_init";
  expect(() => assertCursorToolIsolation(bad)).toThrow();
});
```

**CI:** adicionar ao workflow existente:

```yaml
- run: npm run build
- run: npm test -- tests/cli/cursor-target.test.ts tests/apm/policy-cursor.test.ts
- run: node -e "require('./dist/cursor-hooks.json')"
```

---

### G.6 Ordem de PRs (implementação recomendada)

| PR | Conteúdo | Arquivos principais |
|----|----------|---------------------|
| **PR-1** | Rule slim + instruction fork + agent fixes + EARS | `.apm/instructions/`, `.apm/agents/`, `.apm/skills/specky-sdd-pipeline/` |
| **PR-2** | 6 companion skills | `.apm/skills/specky-{init,spec-engineer,...}/` |
| **PR-3** | Hooks build + install + specky-run.sh | `scripts/build-hook-manifests.mjs`, `asset-copier.ts`, `init.ts` |
| **PR-4** | Doctor + gitignore + tests | `doctor.ts`, `gitignore-writer.ts`, `tests/cli/cursor-target.test.ts` |
| **PR-5** | Docs | `docs/INSTALL.md`, `docs/APM-USAGE.md` §6 Cursor |

**Gate merge:** `npm run build && npm test && specky apm validate && specky apm policy`

---

## Issue template (copiar para GitHub)

**Título:** `[cursor target] Align install output with Cursor conventions (v3.8.0 audit)`

**Corpo:**

```markdown
## Summary

Post-install audit of Specky 3.8.0 Cursor target from project `cinema-app-agent-v2`.
Full spec: [link to SPECKY-CURSOR-INSTALL-IMPROVEMENTS.md]

## Must fix (P0)

- [ ] Replace `copilot-instructions.mdc` with Cursor-native `specky-sdd.mdc` (`alwaysApply`, `description`)
- [ ] Remove Copilot/.vscode references from Cursor artifacts
- [ ] Unify EARS definition across rule, agents, and `specky-sdd-pipeline` skill
- [ ] Document Cursor hook limitations (or implement `.cursor/hooks/` per Appendix A + **G**)

## Implementation spec (Appendix G)

- [ ] `build-hook-manifests.mjs` → `dist/cursor-hooks.json`
- [ ] `.apm/hooks/specky-run.sh` + install in `copyToCursor()`
- [ ] 6 companion skills (G.3) + agent skill refs
- [ ] TypeScript patches (G.4) + Vitest (G.5)

## Should fix (P1)

- [ ] Add 6 dedicated companion skills under `.agents/skills/` (keep this path)
- [ ] Fix agent workflow numbering bugs and quality-reviewer Phase 6 example
- [ ] Add `argument-hint` to all slash commands
- [ ] Slim always-on rule + file-scoped rules (Appendix C)
- [ ] Per-agent least-privilege tools audit (Appendix B)
- [ ] Extend `specky doctor` Cursor checks (Appendix E)

## Docs (P2)

- [ ] INSTALL.md: post-clone `specky install --target=cursor` + `.agents/skills/` path
- [ ] APM-USAGE.md §6: document Cursor target layout (Appendix F)
- [ ] INSTALL.md: Cursor first-run MCP enable checklist (Appendix B)
- [ ] config.yml template: Cursor hooks comment
- [ ] APM primitive schema + CI size limits (Appendix D)

## Decision locked

**Keep** `.agents/skills/` as the Cursor skills install path (do NOT migrate to `.cursor/skills/`).
```

---

*Documento gerado a partir da auditoria do install Specky 3.8.0 em `cinema-app-agent-v2`.*
