# AudioPlex4

Extraia e ouça áudios de vídeos do YouTube em alta qualidade, com player integrado estilo Amazon Music e autenticação via Supabase.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 21 + Material + Signals + RxJS |
| Player | HTMLAudioElement + MediaSession API |
| Auth | Supabase Auth (email + Google + GitHub) |
| Banco | Supabase Postgres (RLS + Realtime) |
| Backend | Supabase Edge Functions (Deno) — sem servidor Express |
| Conversão | FFmpegKit no dispositivo Android (mp3 320k / aac 256k) |
| Mobile | Capacitor 8 (Android) |

## Arquitetura

```
YouTube (Opus 160k / m4a 128k)
   ↓
Edge Function (Deno, resolves URL via @distube/ytdl-core)
   ↓
App Android (Capacitor)
   ├── Tocar Agora → stream via Edge Function → <audio>
   └── Extrair → baixa áudio bruto → FFmpegKit converte → salva offline
```

**Fluxo de extração:**
1. Edge Function `extract-audio` resolve a URL de áudio de maior qualidade (Opus 160k preferido)
2. Baixa os bytes e retorna diretamente para o app
3. App Android converte com FFmpegKit (mp3 320k ou aac 256k)
4. Salva na pasta Downloads pública + biblioteca interna (offline)

## Estrutura

```
PLMP3/
├── frontend/            # Angular app
├── supabase/            # Edge Functions + migrations SQL
├── scripts/             # Helpers de build (CI)
│   ├── write-env.cjs           # gera environment.production.ts
│   └── prepare-android.cjs     # patcheia signing + permissões Android
├── android-reference/   # templates de referência (manifest/strings)
├── capacitor.config.ts
└── .github/workflows/android-build.yml
```

---

## Desenvolvimento local

```bash
# Frontend Angular — porta 4200
cd frontend && npm start
```

> As Edge Functions rodam no Supabase Cloud (não precisa de backend local).

---

## Build Android (APK/AAB)

### 1. Configurar ambiente

Preencha as variáveis do Supabase em `scripts/write-env.cjs` (ou via env):

```bash
export NG_APP_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
export NG_APP_SUPABASE_ANON_KEY="SEU_ANON_KEY"
```

### 2. Build local (com Android SDK + JDK 17 instalados)

```bash
# Gerar environment
node scripts/write-env.cjs

# Build Angular
cd frontend && npx ng build --configuration production && cd ..

# Gerar projeto Android + sincronizar
npx cap add android
npx cap sync android

# Patch signing + permissões
node scripts/prepare-android.cjs

# Build
cd android
./gradlew assembleDebug        # APK de debug
./gradlew bundleRelease        # AAB assinado (com keystore configurado)
```

### 3. CI/CD via GitHub Actions

O workflow `.github/workflows/android-build.yml` faz tudo automaticamente.

**Secrets necessários:**

| Secret | Descrição |
|---|---|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Anon key (público, seguro no bundle) |
| `ANDROID_KEYSTORE_BASE64` | Keystore `.keystore` em base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Senha do keystore |
| `ANDROID_KEY_ALIAS` | Alias da chave |
| `ANDROID_KEY_PASSWORD` | Senha da chave |

**Fluxo:**
- **PR** → gera `AudioPlex4-debug.apk` (sem assinatura)
- **Push em `main`** → gera `AudioPlex4-release.app` + `.aab` assinados
- **Tag `v*`** → cria GitHub Release com os binários anexados

### 4. Gerar o keystore (uma vez, local)

```bash
keytool -genkey -v -keystore release.keystore -alias audioPlex4 \
        -keyalg RSA -keysize 2048 -validity 10000
```

Codificar para o secret:

```bash
base64 -w 0 release.keystore > release.keystore.b64
# Copiar o conteúdo para o secret ANDROID_KEYSTORE_BASE64
```

> ⚠️ **NUNCA** commitar o `.keystore` (já está no `.gitignore`).

---

## Supabase

### Migrations (SQL)

Rode o SQL consolidado no Dashboard → SQL Editor:

```
supabase/setup-complete.sql
```

Ou via CLI:
```bash
supabase db reset
```

### Deploy das Edge Functions

```bash
supabase login
supabase link --project-ref fgvcjxgwpwjohqumzziv
supabase functions deploy --project-ref fgvcjxgwpwjohqumzziv
```

### Configurar secrets (opcional)

`BACKEND_INTERNAL_URL` **não é mais necessário** (Express removido).

---

## Plugins nativos Android

| Plugin | Função |
|---|---|
| `FfmpegConverterPlugin` | Converte áudio no device (FFmpegKit full-gpl) |
| `MediaSaverPlugin` | Salva arquivos na pasta Downloads pública (MediaStore) |

Os fontes Java ficam versionados em `android-reference/plugins/` e são copiados
para o projeto gerado (`android/`) pelo script `scripts/sync-android-native.cjs`,
que também injeta a dependência do FFmpegKit no `build.gradle`. Esse script é
chamado automaticamente por `scripts/prepare-android.cjs` (CI incluído).

> ⚠️ Reprodução de áudio **em background** exige um foreground service nativo
> (MediaSession + ExoPlayer/Media3), ainda não implementado. O player atual
> (`HTMLAudioElement`) toca normalmente com o app aberto.
