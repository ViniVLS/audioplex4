# WORKFLOW DE ERROS - AudioPlex4

> Relatório completo de erros e problemas encontrados na análise do projeto.
> Gerado em: 2026-09-04 21:10
> Total: **79 erros** (5 CRITICAL, 17 HIGH, 30 MEDIUM, 27 LOW)

---

## RESUMO EXECUTIVO

| Severidade | Frontend | Backend | Total |
|------------|----------|---------|-------|
| CRITICAL | 2 | 3 | **5** |
| HIGH | 11 | 6 | **17** |
| MEDIUM | 14 | 16 | **30** |
| LOW | 10 | 12 | **27** |
| **TOTAL** | **37** | **42** | **79** |

### Erros que impedem funcionamento básico:
1. **Seek não funciona** - porcentagem enviada como segundos + áudio nunca pulou
2. **Reorder quebrado no dev local** - PUT vs PATCH mismatch
3. **Playlist完全 quebrada** - usa `ytdl-core` obsoleto com API inexistente
4. **Path traversal vulnerability** - acesso a qualquer arquivo do sistema

---

## CRITICAL SEVERITY (5 erros)

### C1. Seek está COMPLETAMENTE QUEBRADO (2 bugs compostos)
- **Arquivos:** `now-playing.component.ts:50-53`, `player.service.ts:309-312`, `app.ts:39-65`
- **Problema:**
  - **Bug A:** O slider de seek envia porcentagem (0-100) mas `player.seek()` espera segundos. Para uma música de 300s, arrastar para 50% envia `seek(50)` em vez de `seek(150)`
  - **Bug B:** `PlayerService.seek()` só atualiza o signal `_currentTime`. NÃO chama `AudioEngineService.seek()`. O `onTimeUpdate` do áudio imediatamente sobrescreve `_currentTime` com a posição real, desfazendo o seek instantaneamente
- **Impacto:** Seeking é completamente não-funcional

### C2. HTTP PUT vs PATCH mismatch - Reorder quebrado no dev local
- **Arquivos:** `player.service.ts:223`, `supabase/functions/queue-reorder/index.ts:19`
- **Problema:** `reorderQueue()` envia `method: 'PUT'` mas a Edge Function só aceita `PATCH` → retorna 405
- **Impacto:** Drag-and-drop de reordenação falha silenciosamente

### C3. Path traversal vulnerability no download
- **Arquivo:** `audioController.js:124-125`
- **Problema:** `req.params.fileName` é decodificado e unido com `DOWNLOADS_DIR` sem validação. Um atacante pode usar `../` para acessar qualquer arquivo do sistema
- **Impacto:** Acesso não autorizado a arquivos do servidor

### C4. Playlist controller usa `ytdl-core` obsoleto
- **Arquivo:** `playlist-controller.js:1`
- **Problema:** Importa `ytdl-core` em vez de usar yt-dlp como o resto do projeto. `ytdl-core@4.11.5` é muito antigo e provavelmente quebrado
- **Impacto:** Feature de playlist完全 inutilizável

### C5. `ytdl.getPlaylist()` não existe
- **Arquivo:** `playlist-controller.js:20`
- **Problema:** A função `getPlaylist` não existe na lib `ytdl-core`. Vai dar `TypeError: ytdl.getPlaylist is not a function`
- **Impacto:** Crash imediato ao tentar extrair playlist

---

## HIGH SEVERITY (17 erros)

### H1. `extractAndSave()` sem `.catch()` - loading state preso
- **Arquivo:** `home.component.ts:193-209`
- **Problema:** Se o promise rejeita, `isExtracting` fica `true` para sempre. Usuário vê "Processando..." sem poder recuperar

### H2. Extract ignora seleção de qualidade/formato do usuário
- **Arquivo:** `now-playing.component.ts:73-99`
- **Problema:** `extractCurrent()` envia apenas `{ url, trackId }`. As escolhas de qualidade e formato são completamente ignoradas

### H3. Template permite formatos inválidos (WAV/FLAC)
- **Arquivo:** `now-playing.component.ts:35`, template:148-149
- **Problema:** `extractingFormat` é tipado como `'mp3' | 'aac'` mas o template tem radio buttons para `wav` e `flac`

### H4. Efeito no AppComponent com `isPlaying` stale
- **Arquivo:** `app.ts:51-59`
- **Problema:** `isPlaying` é capturado antes do `load()` async. Se o usuário pausa durante o loading, a música começa a tocar quando o load termina

### H5. Datas do histórico mostram "Invalid Date"
- **Arquivo:** `home.component.ts:100-103, 112`, template:153
- **Problema:** `JSON.parse()` restaura `date` como string, não como Date. O pipe `date` do Angular mostra "Invalid Date"

### H6. `toPromise()` deprecated no RxJS 7+
- **Arquivo:** `now-playing.component.ts:85`
- **Problema:** `toPromise()` será removido no RxJS 8. Usar `firstValueFrom()` ou `lastValueFrom()`

### H7. Sem feedback visual quando extração falha
- **Arquivo:** `now-playing.component.ts:94-96`
- **Problema:** Catch só faz `console.error`. Usuário não vê nenhuma notificação de erro

### H8. OAuth deep link listener nunca é removido (memory leak)
- **Arquivo:** `auth.service.ts:75`
- **Problema:** `App.addListener('appUrlOpen', ...)` retorna handle que nunca é armazenado ou removido

### H9. `teardown()` não reseta todos os signals
- **Arquivo:** `player.service.ts:519-526`
- **Problema:** Não reseta `_currentTime`, `_duration`, `_volume`, `_muted`, `_repeat`, `_shuffle`, `_expanded`, `_drawerOpen`, `_isBuffering`

### H10. Timer de debounce compartilhado entre prefs e posição
- **Arquivo:** `player.service.ts:421-462`
- **Problema:** `persistPreferences()` e `persistCurrentPosition()` usam o mesmo timer. Chamar uma cancela a pendente da outra

### H11. Catch-all route engole rotas API não definidas
- **Arquivo:** `server.js:45-58`
- **Problema:** Requisições GET para rotas `/api/...` não definidas ficam pendentes para sempre (nenhuma resposta enviada)

### H12. `uncaughtException` handler continua em estado indefinido
- **Arquivo:** `server.js:80-82`
- **Problema:** Após `uncaughtException`, o processo Node.js pode ter estado corrompido. Deveria exit

### H13. HTTP proxy não segue redirects
- **Arquivo:** `streamController.js:137-173`
- **Problema:** `http.get` não segue redirects automaticamente. CDN do YouTube usa 302s

### H14. `SIGKILL` não funciona no Windows
- **Arquivo:** `streamController.js:67, 241`
- **Problema:** Windows não tem sinais Unix. `proc.kill('SIGKILL')` pode não matar o processo yt-dlp

### H15. Playlist fetch sequencial O(n) sem limite
- **Arquivo:** `playlist-controller.js:22-30`
- **Problema:** Cada vídeo é buscado sequencialmente. Playlist com 100+ vídeos demora minutos

### H16. Playlist sem null check no `url`
- **Arquivo:** `playlist-controller.js:8-10`
- **Problema:** Se `req.body.url` é undefined, `url.includes('playlist')` lança TypeError

### H17. `downloadAndConvertAudio` sem timeout
- **Arquivo:** `youtube.js:122-185`
- **Problema:** yt-dlp pode hangar indefinidamente (vídeo privado, etc). Segura file handle e recursos para sempre

---

## MEDIUM SEVERITY (30 erros)

### M1. `JSON.parse` no header `X-Audio-Info` sem try-catch
- **Arquivo:** `home.component.ts:169, 241`
- **Problema:** Se o header JSON é malformado (caracteres especiais no título), lança exceção não tratada

### M2. `parseInt` sem NaN guard no duration
- **Arquivo:** `home.component.ts:179, 289`
- **Problema:** `parseInt(duration)` retorna NaN se duration não for numérico. NaN propaga para o signal `duration`

### M3. Auth guard polling leak na navegação
- **Arquivo:** `auth.guard.ts:9-21`
- **Problema:** `setInterval` e `setTimeout` continuam rodando se a guarda é abandonada

### M4. `AudioEngineService.load()` falha silenciosamente sem áudio element
- **Arquivo:** `audio-engine.service.ts:101`
- **Problema:** `if (!this.audio) return` - sem log, sem warning. Player mostra música mas nada toca

### M5. Event listeners leak em `attach()` repetido
- **Arquivo:** `audio-engine.service.ts:60-69`
- **Problema:** Chamar `attach()` múltiplas vezes sem `detach()` cria listeners órfãos

### M6. `SupabaseService.client` acessa `window.localStorage` sem SSR guard
- **Arquivo:** `supabase.service.ts:20`
- **Problema:** Em SSR/Worker/testes, `window` é undefined → ReferenceError

### M7. `OfflineLibraryService` não funciona na web
- **Arquivo:** `offline-library.service.ts:1-37`
- **Problema:** Depende de plugins nativos (FfmpegConverter, MediaSaver) que lançam erro `unavailable` na web

### M8. `loadLibrary()` fire-and-forget cria timing window
- **Arquivo:** `offline-library.service.ts:36`
- **Problema:** `_tracks` começa vazio. Código que verifica `isOffline()` imediatamente após construção obtém resultado incorreto

### M9. `removeOffline` deleta arquivo antes de atualizar biblioteca
- **Arquivo:** `offline-library.service.ts:127-141`
- **Problema:** Se `saveLibrary()` falha, arquivo some mas referência permanece

### M10. Code duplication nos métodos de extração
- **Arquivo:** `home.component.ts:151-221, 223-263`
- **Problema:** `extractAndSave()` e `extractAudio()` compartilham lógica HTTP quase idêntica

### M11. `AppComponent` effect sem `.catch()` no promise
- **Arquivo:** `app.ts:55`
- **Problema:** `void this.engine.load(track).then(...)` sem catch. Rejeição não tratada

### M12. `bootstrap()` promise rejection não tratada
- **Arquivo:** `player.service.ts:104`
- **Problema:** `void this.bootstrap()` sem error handling. Se `Promise.all` rejeita, `bootstrapped` já é true

### M13. `handleQueueChange` com setTimeout não cancelável
- **Arquivo:** `player.service.ts:480`
- **Problema:** Timeout pode disparar após `teardown()`, repovoando a fila

### M14. Local dev fetch sem check de HTTP status
- **Arquivo:** `player.service.ts:150-155`
- **Problema:** Fetch não verifica `response.ok`. Erro 500 retorna HTML que `res.json()` falha ao parsear

### M15. Duplicate route extract-playlist
- **Arquivo:** `server.js:39`
- **Problema:** Rota montada duas vezes (em server.js e api.js). A de api.js é dead code

### M16. `unhandledRejection` suprime crashes
- **Arquivo:** `server.js:84-86`
- **Problema:** Handler impede crash mas servidor pode continuar em estado quebrado

### M17. Sem rate limiting middleware
- **Arquivo:** `server.js` (global)
- **Problema:** Atacante pode esgotar recursos com muitas requisições simultâneas

### M18. Race condition entre `pathExists` e `stat`
- **Arquivo:** `audioController.js:85-88`
- **Problema:** Arquivo pode ser deletado entre as duas chamadas

### M19. `setTimeout` de cleanup previne graceful shutdown
- **Arquivo:** `audioController.js:139-148`
- **Problema:** Timers acumulam e mantêm event loop vivo

### M20. Sem limite de downloads concorrentes
- **Arquivo:** `audioController.js:40-117`
- **Problema:** Burst de requests pode spawn dezenas de processos yt-dlp

### M21. Duas caches duplicadas para stream URLs
- **Arquivo:** `streamController.js:16, 188`
- **Problema:** `resolveCache` e `streamUrlCache` armazenam os mesmos dados separadamente

### M22. Playlist URL validation fraca
- **Arquivo:** `playlist-controller.js:10`
- **Problema:** `url.includes('playlist')` é muito amplo. Deveria usar `isPlaylistUrl` do youtube.js

### M23. Extração de playlistId frágil
- **Arquivo:** `playlist-controller.js:17`
- **Problema:** `url.split('list=')[1]` inclui parâmetros extras (`&si=...`)

### M24. Estado in-memory perdido no restart
- **Arquivo:** `player-controller.js:6-14`
- **Problema:** Fila e preferências somem a cada reinício do servidor

### M25. Sem validação de posições no reorder
- **Arquivo:** `player-controller.js:68-79`
- **Problema:** Posições negativas, duplicadas ou inválidas causam sort indefinido

### M26. Regex de YouTube rejeita URLs válidas
- **Arquivo:** `youtube.js:31`
- **Problema:** Não aceita `youtube.com/live/` nem URLs com encoding `%3F`

### M27. `cleanYoutubeUrl` incompleto
- **Arquivo:** `youtube.js:46-59`
- **Problema:** Não normaliza live streams, formato legado, ou parâmetros de playlist

### M28. Sem cleanup de arquivos parcialmente escritos
- **Arquivo:** `youtube.js:170-177`
- **Problema:** Se yt-dlp falha no meio, arquivos temp ficam no disco

### M29. `ffmpegStatic` sem null-check
- **Arquivo:** `youtube.js:139`
- **Problema:** Se `ffmpegStatic` é null, passa null como path → yt-dlp falha com erro confuso

### M30. `sanitizeFilename` não trata nomes reservados Windows
- **Arquivo:** `formatters.js:5-13`
- **Problema:** `CON.mp3`, `NUL.mp3` etc passam validação mas falham no Windows

---

## LOW SEVERITY (27 erros)

### L1. `processOAuthRedirect` falha para schemes não-HTTP
- **Arquivo:** `auth.service.ts:115`

### L2. `refreshSession` sem error handling
- **Arquivo:** `auth.service.ts:184-186`

### L3. Sem validação de environment config
- **Arquivo:** `supabase.service.ts:14-15`

### L4. Auth callback polling sem timeout
- **Arquivo:** `auth-callback.component.ts:29-36`

### L5. Teste é um no-op (`expect(true).toBeTruthy()`)
- **Arquivo:** `app.spec.ts:14-18`

### L6. Dead code: `onSeek` no mini-player nunca chamado
- **Arquivo:** `mini-player.component.ts:31-34`

### L7. CORS wildcard em produção
- **Arquivo:** `cors.ts:4`

### L8. `removeOffline` engole erros de delete silenciosamente
- **Arquivo:** `offline-library.service.ts:131-139`

### L9. `getOfflineTracks()` async desnecessário
- **Arquivo:** `offline-library.service.ts:155-158`

### L10. Export antes do function body (confuso)
- **Arquivo:** `streamController.js:105`

### L11. DRY violation: lógica yt-dlp duplicada
- **Arquivo:** `streamController.js:44-70, 210-244`

### L12. Cache cleanup só dispara em >200 entries
- **Arquivo:** `streamController.js:89-93`

### L13. Error message genérico esconde info útil
- **Arquivo:** `playlist-controller.js:40-46`

### L14. Sem validação de preference values
- **Arquivo:** `player-controller.js:87-96`

### L15. Dados stale retornados para duplicatas
- **Arquivo:** `player-controller.js:29`

### L16. DELETE retorna success mesmo sem encontrar item
- **Arquivo:** `player-controller.js:53-59`

### L17. `execFile` buffera stdout inteiro
- **Arquivo:** `youtube.js:79`

### L18. `formatDuration` trunca fração de segundos
- **Arquivo:** `formatters.js:16`

### L19. `formatViews` sem guard para negativos
- **Arquivo:** `formatters.js:32-42`

### L20. Import duplicado/unused de playlistController
- **Arquivo:** `server.js:11`

### L21. GET para operações com side effects
- **Arquivo:** `api.js:18, 21`

### L22. Body size limit não explícito
- **Arquivo:** `server.js:28`

### L23. Rota dead code em api.js
- **Arquivo:** `api.js:33`

### L24. Sem limite de tamanho de playlist
- **Arquivo:** `playlist-controller.js` (global)

### L25. Shuffle interação com repeat=off
- **Arquivo:** `player.service.ts:268-275`

### L26. `unhandledRejection` handler não exit
- **Arquivo:** `server.js:84-86`

### L27. yt-dlp binary path hardcoded sem startup check
- **Arquivo:** `youtube.js:12`

---

## WORKFLOW DE CORREÇÃO RECOMENDADO

### Fase 1: CRITICAL (Imediato - Impede funcionamento)
1. ~~Corrigir player.service.ts: roteamento local dev~~ ✅ FEITO
2. Corrigir seek (C1) - converter porcentagem para segundos + chamar engine.seek()
3. Corrigir reorder HTTP method (C2) - PUT → PATCH
4. Corrigir path traversal (C3) - validar path com `path.resolve` + startsWith
5. Corrigir playlist controller (C4+C5) - migrar para yt-dlp

### Fase 2: HIGH (1-2 dias - Funcionalidade degradada)
1. Adicionar .catch() em extractAndSave
2. Corrigir Invalid Date no histórico
3. Corrigir isPlaying stale no effect
4. Corrigir timer de debounce compartilhado
5. Corrigir catch-all route para API
6. Adicionar timeout em downloadAndConvertAudio
7. Corrigir SIGKILL no Windows

### Fase 3: MEDIUM (1 semana - Qualidade)
1. Adicionar try-catch em JSON.parse
2. Adicionar NaN guards
3. Corrigir auth guard polling leak
4. Adicionar error handling em fetch calls
5. Corrigir duplicate caches
6. Adicionar rate limiting

### Fase 4: LOW (Backlog - Manutenção)
- Limpar dead code
- Corrigir DRY violations
- Adicionar validações defensivas
- Melhorar error messages

---

## BUILD STATUS

```
✅ Angular build: SUCCESS (2 warnings)
   - Sass @import deprecation (ngx-toastr)
   - file-saver is CommonJS (optimization bailout)

✅ TypeScript: NO ERRORS (corrigido apiUrl type)
✅ Backend server: RUNNING (localhost:3000)
✅ API endpoints: 24/24 PASS
```

---

> **Próximo passo:** Corrigir os 5 erros CRITICAL, depois os 17 HIGH.
