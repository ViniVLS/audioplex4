// scripts/sync-android-native.cjs
// -----------------------------------------------------------------------------
// Garante que a camada nativa Android (plugins FFmpeg + MediaSaver) seja
// replicável no CI / em builds limpos.
//
// O diretório android/ NÃO é versionado (gerado por `npx cap add android`).
// Este script copia os fontes Java de android-reference/plugins/ para dentro
// do projeto gerado e injeta a dependência do FFmpegKit no build.gradle.
//
// Uso (após `npx cap add android` e `npx cap sync android`):
//   node scripts/sync-android-native.cjs
//
// Também é chamado automaticamente por scripts/prepare-android.cjs.
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const ANDROID_APP = path.join(ROOT, 'android', 'app');
const REF_DIR    = path.join(ROOT, 'android-reference', 'plugins');
const JAVA_DIR   = path.join(ANDROID_APP, 'src', 'main', 'java', 'com', 'audioplex4');

const PLUGIN_FILES = ['FfmpegConverterPlugin.java', 'MediaSaverPlugin.java', 'BackgroundAudioPlugin.java', 'MediaPlaybackService.java'];
const MAIN_ACTIVITY_FILE = 'MainActivity.java';

// ffmpeg-kit (arthenica) foi retirado do Maven Central em abr/2025.
// Usamos o fork mantido pela comunidade (mesma API com.arthenica.ffmpegkit).
// ffmpeg-kit-audio inclui libmp3lame (mp3) + aac — suficiente para conversão de áudio.
const FFMPEG_DEP_LINE = "    implementation 'dev.ffmpegkit-maintained:ffmpeg-kit-audio:8.1.7'";

// Media3 (ExoPlayer + MediaSession) para reprodução de áudio em background.
const MEDIA3_DEPS = [
  "    implementation 'androidx.media3:media3-exoplayer:1.5.1'",
  "    implementation 'androidx.media3:media3-session:1.5.1'",
];

function log(msg) {
  console.log(`[sync-android-native] ${msg}`);
}

function sync() {
  if (!fs.existsSync(ANDROID_APP)) {
    log('⚠️  android/app não encontrado. Execute "npx cap add android" primeiro.');
    return false;
  }

  fs.mkdirSync(JAVA_DIR, { recursive: true });
  const pluginsDir = path.join(JAVA_DIR, 'plugins');
  fs.mkdirSync(pluginsDir, { recursive: true });

  // 1. Plugins nativos
  for (const file of PLUGIN_FILES) {
    const src  = path.join(REF_DIR, file);
    const dest = path.join(pluginsDir, file);
    if (!fs.existsSync(src)) {
      log(`⚠️  Referência ausente: ${src}`);
      continue;
    }
    const content = fs.readFileSync(src, 'utf8');
    if (fs.existsSync(dest) && fs.readFileSync(dest, 'utf8') === content) {
      log(`ℹ️  ${file} já sincronizado.`);
      continue;
    }
    fs.writeFileSync(dest, content, 'utf8');
    log(`✅ ${file} copiado para android/`);
  }

  // 2. MainActivity (registra os plugins)
  const mainSrc  = path.join(REF_DIR, MAIN_ACTIVITY_FILE);
  const mainDest = path.join(JAVA_DIR, MAIN_ACTIVITY_FILE);
  if (fs.existsSync(mainSrc)) {
    const content = fs.readFileSync(mainSrc, 'utf8');
    if (!fs.existsSync(mainDest) || fs.readFileSync(mainDest, 'utf8') !== content) {
      fs.writeFileSync(mainDest, content, 'utf8');
      log('✅ MainActivity atualizado (registro de plugins nativos).');
    } else {
      log('ℹ️  MainActivity já sincronizado.');
    }
  } else {
    log(`⚠️  Referência ausente: ${mainSrc}`);
  }

  // 3. build.gradle: injeta dependências do FFmpegKit (fork mantido) + Media3
  const gradlePath = path.join(ANDROID_APP, 'build.gradle');
  if (!fs.existsSync(gradlePath)) {
    log('⚠️  android/app/build.gradle não encontrado.');
    return true;
  }

  let gradle = fs.readFileSync(gradlePath, 'utf8');
  let modified = false;

  // 3a. Remove referências antigas ao ffmpeg-kit (arthenica, removido do Maven Central)
  const oldFfmpeg = gradle.match(/[ \t]*implementation\s+['"]com\.arthenica:ffmpeg-kit[^'"]*['"]\s*\n?/g);
  if (oldFfmpeg) {
    for (const line of oldFfmpeg) {
      gradle = gradle.replace(line, '');
    }
    modified = true;
    log('⚠️  Removida dependência antiga do ffmpeg-kit (com.arthenica).');
  }

  const depMatch = gradle.match(/(dependencies\s*\{)/);
  if (!depMatch) {
    log('⚠️  Bloco "dependencies {" não encontrado — dependências NÃO injetadas.');
    return true;
  }
  const openBrace = gradle.indexOf('{', depMatch.index);
  let insert = '';

  if (!gradle.includes('dev.ffmpegkit-maintained')) {
    insert += '\n' + FFMPEG_DEP_LINE;
  }
  if (!gradle.includes('media3-exoplayer')) {
    insert += '\n' + MEDIA3_DEPS[0];
  }
  if (!gradle.includes('media3-session')) {
    insert += '\n' + MEDIA3_DEPS[1];
  }

  if (insert) {
    gradle = gradle.slice(0, openBrace + 1) + insert + gradle.slice(openBrace + 1);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(gradlePath, gradle, 'utf8');
    log('✅ build.gradle atualizado (ffmpeg-kit mantido + Media3).');
  } else {
    log('ℹ️  Dependências já presentes em build.gradle.');
  }

  // 4. AndroidManifest.xml: serviço de mídia + deep link de OAuth
  patchManifest();
  return true;
}

// ---------------------------------------------------------------------------
// 4. Patch do AndroidManifest (serviço Media3 + deep link OAuth)
// ---------------------------------------------------------------------------
function patchManifest() {
  const manifestPath = path.join(ANDROID_APP, 'src', 'main', 'AndroidManifest.xml');
  if (!fs.existsSync(manifestPath)) {
    log('⚠️  AndroidManifest.xml não encontrado.');
    return;
  }

  let manifest = fs.readFileSync(manifestPath, 'utf8');
  let modified = false;

  // 4a. Foreground service (Media3)
  if (!manifest.includes('MediaPlaybackService')) {
    const serviceBlock =
      '\n\n        <!-- Reprodução de áudio em background (Media3) -->\n' +
      '        <service\n' +
      '            android:name=".plugins.MediaPlaybackService"\n' +
      '            android:exported="true"\n' +
      '            android:foregroundServiceType="mediaPlayback">\n' +
      '            <intent-filter>\n' +
      '                <action android:name="androidx.media3.session.MediaSessionService" />\n' +
      '            </intent-filter>\n' +
      '        </service>';

    if (manifest.includes('</application>')) {
      manifest = manifest.replace('</application>', serviceBlock + '\n    </application>');
      modified = true;
      log('✅ MediaPlaybackService registrado no AndroidManifest.xml.');
    } else {
      log('⚠️  Tag </application> não encontrada — serviço não injetado.');
    }
  }

  // 4b. Deep link para retorno do OAuth (com.audioplex4://auth/callback)
  if (!manifest.includes('android.intent.action.VIEW')) {
    const deepLink =
      '\n\n            <!-- Deep link: retorno do OAuth (com.audioplex4://auth/callback) -->\n' +
      '            <intent-filter>\n' +
      '                <action android:name="android.intent.action.VIEW" />\n' +
      '                <category android:name="android.intent.category.DEFAULT" />\n' +
      '                <category android:name="android.intent.category.BROWSABLE" />\n' +
      '                <data android:scheme="com.audioplex4" />\n' +
      '            </intent-filter>';

    const mainFilter = manifest.match(
      /<intent-filter>[\s\S]*?android\.intent\.action\.MAIN[\s\S]*?<\/intent-filter>/,
    );
    if (mainFilter) {
      manifest = manifest.replace(mainFilter[0], mainFilter[0] + deepLink);
      modified = true;
      log('✅ Deep link de OAuth adicionado ao AndroidManifest.xml.');
    } else {
      log('⚠️  Intent-filter MAIN não encontrado — deep link não injetado.');
    }
  }

  if (modified) {
    fs.writeFileSync(manifestPath, manifest, 'utf8');
    log('✅ AndroidManifest.xml atualizado.');
  } else {
    log('ℹ️  AndroidManifest.xml já atualizado.');
  }
}

module.exports = { sync };

if (require.main === module) {
  sync();
}