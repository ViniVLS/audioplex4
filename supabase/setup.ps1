# =====================================================================
# AudioPlex4 - Setup Completo do Supabase
# =====================================================================
# Execute este script no PowerShell:
#   .\supabase\setup.ps1
#
# Ele vai:
#   1. Gerar o SQL consolidado (pronto para colar no SQL Editor)
#   2. Listar as Edge Functions que precisam ser deployadas
#   3. Gerar os comandos de deploy (se tiver Supabase CLI)
#   4. Verificar se os secrets do GitHub estao configurados
# =====================================================================

$ErrorActionPreference = "Stop"

$SUPABASE_URL = "https://fgvcjxgwpwjohqumzziv.supabase.co"
$PROJECT_REF = "fgvcjxgwpwjohqumzziv"

Write-Host ""
Write-Host "=================================================="
Write-Host "  AudioPlex4 - Setup Supabase"
Write-Host "=================================================="
Write-Host ""

# =====================================================================
# 1. SQL consolidado
# =====================================================================
Write-Host "[1/4] SQL consolidado gerado em:"
Write-Host "      supabase\setup-complete.sql"
Write-Host ""
Write-Host "  Copie TODO o conteudo e cole no SQL Editor do Supabase:"
Write-Host "  $SUPABASE_URL/dashboard -> SQL Editor -> New Query -> Paste -> Run"
Write-Host ""

# =====================================================================
# 2. Edge Functions
# =====================================================================
Write-Host "[2/4] Edge Functions que precisam ser deployadas:"
Write-Host ""

$functions = @(
    @{ name = "auth-session";        desc = "Valida sessao do usuario";               needs_backend = $false },
    @{ name = "video-info";          desc = "Busca info do video (via Deno/ytdl-core)"; needs_backend = $false },
    @{ name = "stream";              desc = "Stream de audio (via Deno/ytdl-core)";   needs_backend = $false },
    @{ name = "extract-audio";       desc = "Extrai audio do YouTube (via Deno)";     needs_backend = $false },
    @{ name = "queue-add";           desc = "Adiciona faixa a fila";                   needs_backend = $false },
    @{ name = "queue-list";          desc = "Lista fila do usuario";                   needs_backend = $false },
    @{ name = "queue-reorder";       desc = "Reordena fila";                           needs_backend = $false },
    @{ name = "queue-clear";         desc = "Limpa fila";                              needs_backend = $false },
    @{ name = "tracks-list";         desc = "Lista faixas salvas";                     needs_backend = $false },
    @{ name = "tracks-upsert";       desc = "Salva/atualiza faixa";                    needs_backend = $false },
    @{ name = "tracks-delete";       desc = "Deleta faixa";                            needs_backend = $false },
    @{ name = "preferences-get";     desc = "Busca preferencias do player";            needs_backend = $false },
    @{ name = "preferences-update";  desc = "Atualiza preferencias do player";         needs_backend = $false }
)

foreach ($fn in $functions) {
    Write-Host "  - $($fn.name)"
    Write-Host "    $($fn.desc)"
}
Write-Host ""

# =====================================================================
# 3. Comandos de deploy
# =====================================================================
Write-Host "[3/4] Comandos de deploy:"
Write-Host ""

$hasCLI = $false
try {
    $null = supabase --version 2>$null
    $hasCLI = $true
} catch {}

if ($hasCLI) {
    Write-Host "  Supabase CLI detectado! Executando deploy..."
    Write-Host ""

    foreach ($fn in $functions) {
        $name = $fn.name
        Write-Host "  Deployando $name..."
        & supabase functions deploy $name --project-ref $PROJECT_REF 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  [ERRO] Falha ao deployar $name"
        } else {
            Write-Host "  [OK] $name deployado"
        }
    }
    Write-Host ""
} else {
    Write-Host "  Supabase CLI NAO instalado."
    Write-Host "  Para instalar: npm i -g supabase"
    Write-Host ""
    Write-Host "  Alternativa: deploy manual via Dashboard"
    Write-Host "  1. Acesse: $SUPABASE_URL/dashboard"
    Write-Host "  2. Menu lateral -> Edge Functions"
    Write-Host "  3. Para CADA funcao:"
    Write-Host "     - Clique 'Create a new function'"
    Write-Host "     - Nome: exatamente como listado acima"
    Write-Host "     - Cole o conteudo de: supabase\functions\<nome>\index.ts"
    Write-Host "     - Adicione os imports de _shared (copie os arquivos da pasta)"
    Write-Host "     - Salve"
    Write-Host ""
}

# =====================================================================
# 4. Secrets das Edge Functions
# =====================================================================
Write-Host "[4/4] Secrets que precisam ser configurados:"
Write-Host ""

Write-Host "  No Dashboard -> Edge Functions -> Settings -> Secrets:"
Write-Host ""

$secrets = @(
    @{ name = "SUPABASE_URL";               value = $SUPABASE_URL; desc = "URL do projeto" },
    @{ name = "SUPABASE_ANON_KEY";           value = "(configurado automaticamente)"; desc = "Chave publica" },
    @{ name = "SUPABASE_SERVICE_ROLE_KEY";   value = "(pegue no Dashboard -> Settings -> API -> service_role)"; desc = "Chave admin (NUNCA expor ao frontend)" }
)

foreach ($s in $secrets) {
    Write-Host "  $($s.name)"
    Write-Host "    Valor: $($s.value)"
    Write-Host "    Uso:   $($s.desc)"
    Write-Host ""
}

# =====================================================================
# Resumo
# =====================================================================
Write-Host "=================================================="
Write-Host "  RESUMO - O que falta fazer:"
Write-Host "=================================================="
Write-Host ""
Write-Host "  1. Abrir o SQL Editor e rodar setup-complete.sql"
Write-Host "  2. Deployar as 13 Edge Functions (via CLI ou Dashboard)"
Write-Host "  3. Configurar os 2 secrets no GitHub:"
Write-Host "     - SUPABASE_URL = $SUPABASE_URL"
Write-Host "     - SUPABASE_ANON_KEY = (a que voce ja tem)"
Write-Host "  4. Habilitar Auth providers (Google/GitHub) no Dashboard -> Auth -> Providers"
Write-Host ""
Write-Host "=================================================="
Write-Host "  Projeto: $SUPABASE_URL/dashboard"
Write-Host "=================================================="
Write-Host ""
