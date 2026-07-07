---
title: "Uso do APM pelo Specky"
description: "Explica como o Specky usa conceitos de APM para governar primitives, gerar assets por harness e integrar o CLI ao runtime MCP npm/container."
author: "Paula Silva"
date: "2026-07-07"
version: "1.0.0"
status: "approved"
tags: ["apm", "mcp", "github-copilot", "claude-code", "enterprise"]
---

<!-- markdownlint-disable MD025 -->

# Uso do APM pelo Specky

> O Specky usa APM como camada de manifesto, governanca e reproducibilidade dos primitives. Ele nao usa APM como proxy de runtime e nao exige que usuarios instalem o Microsoft APM CLI para usar o Specky.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-07 | Paula Silva | Initial version |

## Table of Contents

- [1. Resumo Executivo](#1-resumo-executivo)
- [2. O Que APM Significa No Specky](#2-o-que-apm-significa-no-specky)
- [3. O Que APM Nao Faz No Specky](#3-o-que-apm-nao-faz-no-specky)
- [4. Arquitetura De Camadas](#4-arquitetura-de-camadas)
- [5. Fonte Canonica Dos Primitives](#5-fonte-canonica-dos-primitives)
- [6. Compilacao Por Harness](#6-compilacao-por-harness)
- [7. Integracao Com CLI](#7-integracao-com-cli)
- [8. Integracao Com MCP npm](#8-integracao-com-mcp-npm)
- [9. Integracao Com Container MCP Enterprise](#9-integracao-com-container-mcp-enterprise)
- [10. Governanca APM](#10-governanca-apm)
- [11. Fluxo Para Mantenedores](#11-fluxo-para-mantenedores)
- [12. Fluxo Para Usuarios](#12-fluxo-para-usuarios)
- [13. Limites Atuais](#13-limites-atuais)
- [References](#references)

## 1. Resumo Executivo

O Specky distribui uma camada de contexto agentico: agents, prompts, skills, hooks, instructions e um servidor MCP com ferramentas `sdd_*`. Esses primitives ficam no pacote npm `specky-sdd` e sao instalados por projeto usando o CLI `specky`.

A parte APM do Specky organiza e governa esse pacote. Ela declara o que existe (`apm.yml`), fixa hashes do que deve ser distribuido (`apm.lock.yaml`), aplica regras de governanca (`apm-policy.yml`) e oferece comandos de validacao (`specky apm ...`).

O ponto importante: **APM nao e proxy** no Specky. Em runtime, o harness conversa diretamente com o servidor MCP do Specky, por `npx specky-sdd serve` em stdio ou por HTTP no container. APM valida e governa o pacote antes da instalacao ou no CI.

## 2. O Que APM Significa No Specky

No Specky, APM significa **Agent Package Manager** como modelo de empacotamento e governanca de primitives. Ele cobre:

- Manifesto do pacote: `apm.yml`.
- Lockfile de integridade: `apm.lock.yaml`.
- Politica enterprise: `apm-policy.yml`.
- Fonte canonica dos primitives: `.apm/`.
- Comandos de governanca: `specky apm validate`, `lock`, `verify-lock`, `policy`, `audit`, `sbom`.

Isso torna o pacote verificavel antes de publicar, instalar ou rodar em CI.

## 3. O Que APM Nao Faz No Specky

APM nao fica no caminho de execucao das chamadas de ferramenta. Ele nao intercepta prompts, nao faz proxy de LLM, nao roteia tool calls e nao encaminha requisicoes MCP.

O fluxo de runtime e direto:

```text
GitHub Copilot / Claude Code / outro harness
  -> MCP client do harness
  -> servidor MCP Specky
  -> ferramentas sdd_*
```

O servidor MCP Specky pode rodar de duas formas:

- **stdio via npm:** `npx -y specky-sdd@<versao> serve`.
- **HTTP via container:** `node dist/cli/index.js serve --http` dentro da imagem GHCR.

APM entra antes ou ao redor disso, como validacao de pacote, nao como componente inline de runtime.

## 4. Arquitetura De Camadas

A arquitetura atual pode ser lida em quatro camadas:

```text
Camada 1: Fonte canonica
  .apm/agents
  .apm/prompts
  .apm/skills
  .apm/hooks
  .apm/instructions

Camada 2: Governanca APM
  apm.yml
  apm.lock.yaml
  apm-policy.yml
  specky apm validate|lock|verify-lock|policy|audit|sbom

Camada 3: Compilacao por harness
  GitHub Copilot -> .github/*
  Claude Code    -> .claude/*

Camada 4: Runtime MCP
  npm stdio      -> npx -y specky-sdd@<versao> serve
  container HTTP -> ghcr.io/paulasilvatech/specky:<versao>
```

Cada camada tem uma responsabilidade separada. Isso evita misturar formato de prompt, permissao de harness, politica enterprise e runtime MCP em um unico arquivo.

## 5. Fonte Canonica Dos Primitives

A fonte canonica do Specky fica em `.apm/`:

| Pasta | Conteudo | Papel |
| --- | --- | --- |
| `.apm/agents/` | Custom agents | Personas e workflows do pipeline SDD |
| `.apm/prompts/` | Prompt files | Slash prompts por fase e entrada rapida |
| `.apm/skills/` | Agent Skills | Conhecimento reutilizavel e referencias |
| `.apm/hooks/` | Hook manifest e scripts | Guardrails antes/depois de ferramentas |
| `.apm/instructions/` | Instructions | Regras globais do pipeline Specky |

Essa fonte nao deve ser editada por harness. O Specky compila essa fonte para cada ambiente.

## 6. Compilacao Por Harness

O Specky usa compiladores por harness para gerar assets nativos.

### GitHub Copilot

`specky install --ide=copilot` gera:

```text
.github/agents/*.agent.md
.github/prompts/*.prompt.md
.github/skills/*/SKILL.md
.github/hooks/specky/*
.github/instructions/*.instructions.md
.vscode/mcp.json
.vscode/settings.json
```

Os agents usam nomes de ferramentas nativos do GitHub Copilot:

```yaml
tools: ["search", "agent", "specky/sdd_get_status"]
```

Os prompts usam:

```yaml
agent: agent
```

### Claude Code

`specky install --ide=claude` gera:

```text
.claude/agents/*.md
.claude/commands/*.md
.claude/skills/*/SKILL.md
.claude/hooks/*
.claude/rules/*.md
.claude/settings.json
.mcp.json
```

Os agents usam nomes de ferramentas nativos do Claude Code:

```yaml
tools: Read, Glob, Grep, Task, mcp__specky__sdd_get_status
```

Os commands nao recebem `agent: agent`, porque isso e metadata do GitHub Copilot.

## 7. Integracao Com CLI

O CLI `specky` e o ponto de entrada principal para usuarios. Nao e necessario instalar o Microsoft APM CLI para usar o Specky.

Comandos principais:

```bash
specky install --ide=copilot
specky install --ide=claude
specky doctor
specky status
specky upgrade
specky serve
```

Comandos APM embutidos no Specky:

```bash
specky apm validate
specky apm lock
specky apm verify-lock
specky apm policy
specky apm audit
specky apm sbom
```

Esses comandos operam sobre o pacote Specky. Eles nao chamam o Microsoft APM CLI externo.

## 8. Integracao Com MCP npm

Quando o usuario instala Specky por npm, o CLI escreve a configuracao MCP do harness.

Para GitHub Copilot, o arquivo fica em `.vscode/mcp.json` e aponta para o pacote npm:

```json
{
  "servers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd@<versao>", "serve"]
    }
  }
}
```

Para Claude Code, o arquivo `.mcp.json` usa o formato esperado pelo Claude:

```json
{
  "mcpServers": {
    "specky": {
      "command": "npx",
      "args": ["-y", "specky-sdd@<versao>", "serve"]
    }
  }
}
```

O MCP server e o runtime. Os commands APM nao sao runtime proxy; eles validam pacote, lock e policy.

## 9. Integracao Com Container MCP Enterprise

Para hospedagem enterprise, o Specky pode rodar como servidor MCP HTTP em container.

Fluxo:

```text
Harness MCP HTTP client
  -> https://<host>/mcp
  -> container ghcr.io/paulasilvatech/specky:<versao>
  -> specky serve --http
  -> ferramentas sdd_*
```

Exemplo local:

```bash
docker run --rm -p 127.0.0.1:3200:3200 \
  -e SPECKY_PROFILE=enterprise \
  -e SDD_HTTP_TOKENS_FILE=/run/secrets/tokens.yml \
  -e SDD_AUDIT_HMAC_KEY_FILE=/run/secrets/audit.key \
  -v "$PWD/workspace:/workspace" \
  -v /etc/specky:/run/secrets:ro \
  ghcr.io/paulasilvatech/specky:<versao>
```

O container nao substitui os primitives do harness. Ele fornece o servidor MCP. Os agents/prompts/skills continuam sendo instalados ou gerenciados no harness/repo do usuario.

## 10. Governanca APM

A governanca APM do Specky tem tres arquivos principais.

### apm.yml

Declara nome, versao, primitives, targets e MCP runtime.

### apm.lock.yaml

Registra hash SHA256 dos primitives e arquivos de governanca empacotados. Isso permite detectar drift:

```bash
specky apm verify-lock
```

### apm-policy.yml

Define regras enterprise:

- servidores MCP permitidos
- eventos de hook permitidos
- isolamento de nomes de tools por harness
- negacao de tool names de outro harness no output compilado

Exemplo de validacao:

```bash
specky apm validate
specky apm policy
specky apm verify-lock
```

## 11. Fluxo Para Mantenedores

Antes de publicar uma nova versao:

```bash
npm run build
npm test
specky apm validate
specky apm policy
specky apm verify-lock
specky apm sbom > /tmp/specky-sbom.json
npm pack --dry-run
```

Se primitives mudarem, atualize o lock:

```bash
specky apm lock
```

## 12. Fluxo Para Usuarios

Usuarios nao precisam instalar APM externo.

Instalacao individual:

```bash
npm install -g specky-sdd@latest
cd your-project
specky install --ide=copilot
```

Instalacao versionada por projeto:

```bash
npm install --save-dev specky-sdd@latest
npx specky install --ide=copilot
```

Depois:

```bash
specky doctor
specky status
```

## 13. Limites Atuais

O Specky ja tem governanca APM propria, mas ainda nao e um substituto completo do Microsoft APM CLI.

Ainda nao implementa, como instalador primario:

- resolucao transitiva completa de pacotes APM externos
- `apm install` como caminho principal
- marketplaces APM
- policy inheritance enterprise -> org -> repo
- targets alem de GitHub Copilot e Claude Code

Esses pontos podem ser adicionados em fases futuras sem mudar o runtime MCP.

## References

- [Microsoft APM documentation](https://microsoft.github.io/apm/)
- [microsoft/apm GitHub repository](https://github.com/microsoft/apm)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [GitHub Copilot customization in VS Code](https://code.visualstudio.com/docs/copilot/copilot-customization)
- [Specky CLI reference](CLI.md)
- [Specky enterprise deployment guide](ENTERPRISE-DEPLOYMENT.md)
