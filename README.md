# AudioPlex4

Extraia e ouça áudios de vídeos do YouTube em alta qualidade (MP3 320/256kbps), com player integrado estilo Amazon Music e autenticação via Supabase.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Angular 21 + Material + Signals + RxJS |
| Player | HTMLAudioElement + MediaSession API (+ Capacitor Media para nativo) |
| Auth | Supabase Auth (email + Google + GitHub) |
| Banco | Supabase Postgres (RLS + Realtime) |
| Backend | Supabase Edge Functions (Deno) + Express (dev/proxy) |
| Mobile | Capacitor 8 (Android) |

## Estrutura

```
PLMP3/
├── frontend/            # Angular app
├── server/              # Express (proxy dev + ffmpeg/yt-dlp)
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
# Backend (Express + yt-dlp) — porta 3000
npm run dev:server

# Frontend Angular — porta 4200 (com proxy /api)
cd frontend && npm start
```

> ⚠️ **Dependência externa:** o backend usa `bin/yt-dlp.exe` (não versionado).
> Baixe em https://github.com/yt-dlp/yt-dlp/releases e coloque em `bin/yt-dlp.exe`.

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

```bash
# Aplicar migrações localmente (Supabase CLI)
supabase start
supabase db reset

# Deploy das Edge Functions
supabase functions deploy auth-session
supabase functions deploy video-info
# ... (uma para cada função em supabase/functions/)
```

As migrations em `supabase/migrations/` criam o schema completo com RLS + Realtime.

---