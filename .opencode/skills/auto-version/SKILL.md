# Skill: Auto-Version

## REGRA PRINCIPAL

Sempre que modifying code (any file), automatically bump the patch version.

## Quando executar

- Após QUALQUER modificação de código (edição, criação, exclusão de arquivo)
- Após correção de bug
- Após adição de feature
- Após alteração de configuração que afeta o build
- NÃO executar para: alterações em HISTORICO_CONVERSAS.md, SKILL.md, ou documentação pura

## O que fazer

### 1. Ler versão atual do `package.json`
```bash
node -p "require('./package.json').version"
```

### 2. Incrementar versão (patch)
Exemplo: `1.0.0` → `1.0.1`

### 3. Atualizar todos os arquivos de versão

| Arquivo | Campo | Formato |
|---------|-------|---------|
| `package.json` | `version` | `"1.0.1"` |
| `frontend/src/environments/environment.ts` | `version` | `'1.0.1'` |
| `frontend/src/environments/environment.production.ts` | `version` | `'1.0.1'` |

### 4. NÃO fazer push automaticamente

**PROIBIDO** fazer `git push` sem autorização explícita do usuário.

Sempre que terminar as modificações:
- Informar ao usuário que a versão foi atualizada
- Listar os arquivos modificados
- Perguntar: "Deseja fazer push para o Git?"

## Comando rápido

```bash
node scripts/bump-version.cjs patch
```

## Exemplo de fluxo

```
Usuário: "Corrija o bug do login"
IA: [corrigi o bug]
IA: [roda bump-version] → Versão 1.0.3 → 1.0.4
IA: "Versão atualizada para 1.0.4. Arquivos: package.json, environment.ts, environment.production.ts
     Deseja fazer push para o Git?"
Usuário: "Sim"
IA: git add -A && git commit -m "chore: bump version to 1.0.4" && git push
```

## Arquivos afetados

- `package.json` (campo version)
- `frontend/src/environments/environment.ts` (campo version)
- `frontend/src/environments/environment.production.ts` (campo version)

## Observações

- Versão segue padrão semântico: MAJOR.MINOR.PATCH
- PATCH incrementa automaticamente a cada modificação
- MINOR e MAJOR devem ser solicitados explicitamente pelo usuário
- O build do GitHub Actions NÃO deve incrementar versão (já tratado por --skip-gradle)
- Esta skill não substitui o histórico de conversas, complementa
