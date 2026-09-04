---
name: historico-conversas
description: Use ALWAYS at the start of every conversation and after every code modification. Logs all actions, decisions, prompts, and code changes to HISTORICO_CONVERSAS.md. Automatically reads this file before any decision.
---

# Historico Conversas - Audit Trail Skill

## MANDATORY RULES (Always Execute)

### 1. READ FIRST - Before Any Action
Before answering ANY prompt or making ANY decision:
- **ALWAYS** read `HISTORICO_CONVERSAS.md` first
- Understand the full context of previous interactions
- Reference previous decisions and changes when relevant
- If the file doesn't exist, create it with a header

### 2. LOG EVERYTHING - After Every Action
After completing ANY task, code change, or decision:
- **ALWAYS** append to `HISTORICO_CONVERSAS.md`
- Include timestamp, action type, description, files affected, and outcome
- Be verbose - capture intent, not just results

### 3. LOG FORMAT
Use this exact format for each entry:

```markdown
## [YYYY-MM-DD HH:MM:SS] - [ACTION_TYPE]

**Intenção:** [What was the user's intent]
**Ação realizada:** [What was actually done]
**Arquivos afetados:** [List of files modified/created/deleted]
**Resultado:** [Success/Partial/Failed + details]
**Observações:** [Any important notes, issues encountered, or follow-up needed]
```

### 4. ACTION TYPES
- `PROMPT` - User input/question received
- `CODE_CHANGE` - Code was modified
- `FILE_CREATE` - New file was created
- `FILE_DELETE` - File was removed
- `COMMAND_EXEC` - Shell command was executed
- `DECISION` - Important decision was made
- `ERROR` - Error occurred
- `FIX` - Bug was fixed
- `FEATURE` - New feature was implemented
- `CONFIG` - Configuration was changed
- `DEPLOY` - Deployment action
- `TEST` - Testing was performed
- `REVIEW` - Code review was done
- `QUESTION` - User asked a question
- `ANSWER` - Response was provided

### 5. WHAT TO LOG
Always capture:
- **User prompts** (exact or summarized)
- **Code modifications** (before/after if possible)
- **File operations** (create, read, update, delete)
- **Shell commands** and their output
- **Decisions made** and reasoning
- **Errors encountered** and how they were resolved
- **Dependencies installed/updated**
- **Configuration changes**
- **Git operations** (commits, pushes, pulls)
- **API calls** and responses
- **Secrets/configurations checked**
- **Build/test results**

### 6. FILE STRUCTURE
The `HISTORICO_CONVERSAS.md` file should have:

```markdown
# Historico de Conversas - AudioPlex4

> Este arquivo é gerado automaticamente pela skill historico-conversas.
> Todas as interações, mudanças de código e decisões são registradas aqui.

---

## Índice
[Auto-generated index of entries]

---

[Entries in reverse chronological order (newest first)]
```

### 7. AUTOMATIC BEHAVIOR
- On session start: Read the file, summarize recent activity if relevant
- On code change: Log the change with full context
- On error: Log the error and resolution steps
- On decision: Log the decision and alternatives considered
- On completion: Summarize what was accomplished

### 8. SEARCH AND REFERENCE
When answering questions:
- Search the history for similar past situations
- Reference previous solutions when applicable
- Learn from past mistakes logged in the history
- Use the history to maintain consistency

### 9. PRIVACY AND SECURITY
- **NEVER** log actual secrets, tokens, or passwords
- Log that secrets were checked/configured, not their values
- Sanitize any sensitive data before logging

### 10. FILE SIZE MANAGEMENT
- If file exceeds 1000 entries, create a new file `HISTORICO_CONVERSAS_YYYY_MM.md`
- Keep a summary index at the top of each file
- Reference older files when needed

## EXAMPLE ENTRY

```markdown
## [2026-09-03 21:30:00] - CODE_CHANGE

**Intenção:** Corrigir permissões do AndroidManifest.xml que foram inseridas em posição incorreta
**Ação realizada:** Editado AndroidManifest.xml para mover permissões de fora da tag <manifest> para dentro dela, e removida permissão duplicada de INTERNET
**Arquivos afetados:** 
- `android/app/src/main/AndroidManifest.xml` (corrigido)
**Resultado:** Sucesso - Manifest agora está válido XML com todas as 6 permissões na posição correta
**Observações:** O script prepare-android.cjs inseriu as permissões antes da tag <manifest>, precisou de correção manual
```

## QUICK REFERENCE

When you see these triggers, use this skill:
- User says "log", "historico", "registro", "history"
- Any code modification is made
- Any error occurs and is fixed
- Any decision is made
- Session starts (read file first)
- User asks about past actions
