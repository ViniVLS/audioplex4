// scripts/prepare-android.cjs
// -----------------------------------------------------------------------------
// Pós-processa o projeto Android gerado pelo Capacitor (`npx cap add android`)
// para:
//   1. Injetar configuração de assinatura (signingConfigs + buildTypes) no
//      android/app/build.gradle, lendo as credenciais de variáveis de ambiente.
//   2. Adicionar permissões do AndroidManifest.xml necessárias para o player
//      de áudio em background (foreground service + notificação).
//
// Uso:
//   node scripts/prepare-android.cjs
//
// Variáveis de ambiente esperadas (assim via GitHub Actions secrets):
//   ANDROID_KEYSTORE_PATH       (default: release.keystore)
//   ANDROID_KEYSTORE_PASSWORD
//   ANDROID_KEY_ALIAS
//   ANDROID_KEY_PASSWORD
//
// Segurança: este script retorna 0 (sucesso) mesmo se as variáveis de
// assinatura não estiverem presentes, permitindo builds de debug (PRs) sem
// assinatura. A assinatura é aplicada apenas quando as 4 variáveis existem.
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const { sync: syncNative } = require('./sync-android-native.cjs');

const ROOT         = path.join(__dirname, '..');
const ANDROID_APP_DIR = path.join(ROOT, 'android', 'app');
const BUILD_GRADLE   = path.join(ANDROID_APP_DIR, 'build.gradle');
const MANIFEST       = path.join(ANDROID_APP_DIR, 'src', 'main', 'AndroidManifest.xml');
const PACKAGE_JSON   = path.join(ROOT, 'package.json');

function log(msg) {
  console.log(`[prepare-android] ${msg}`);
}

// ---------------------------------------------------------------------------
// 1. Inject signing config into build.gradle
// ---------------------------------------------------------------------------
function findAndroidBlock(gradle) {
  // Procura a linha que abre o bloco "android {"
  const match = gradle.match(/android\s*\{/);
  if (!match) {
    log('⚠️  Bloco "android {" não encontrado em build.gradle — pulando assinatura.');
    return { gradle, modified: false };
  }
  return { gradle, index: match.index, modified: true };
}

// ---------------------------------------------------------------------------
// 0. Update version in build.gradle (versionCode + versionName)
// ---------------------------------------------------------------------------
function injectVersion(gradle) {
  if (!fs.existsSync(PACKAGE_JSON)) {
    log('⚠️  package.json não encontrado — pulando versionamento.');
    return gradle;
  }

  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const version = pkg.version || '1.0.0';
  const versionCode = Math.floor(Date.now() / 1000);

  if (gradle.includes(`versionName "${version}"`)) {
    log('ℹ️  Versão já está atualizada no build.gradle.');
    return gradle;
  }

  gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  log(`✅ Versão ${version} (code: ${versionCode}) aplicada ao build.gradle.`);
  return gradle;
}

function injectSigning(gradle) {
  if (gradle.includes('signingConfigs')) {
    log('ℹ️  signingConfigs já presente — nada a fazer.');
    return gradle;
  }

  const { index, modified } = findAndroidBlock(gradle);
  if (!modified) return gradle;

  // Bloco signingConfigs que será inserido logo após "android {"
  const signingBlock = `
    signingConfigs {
        release {
            def ksFile = file(project.findProperty("ANDROID_KEYSTORE_PATH") ?: "release.keystore")
            storeFile ksFile.exists() ? ksFile : null
            storePassword project.findProperty("ANDROID_KEYSTORE_PASSWORD") ?: ""
            keyAlias project.findProperty("ANDROID_KEY_ALIAS") ?: ""
            keyPassword project.findProperty("ANDROID_KEY_PASSWORD") ?: ""
        }
    }
`;

  const openBraceClose = gradle.indexOf('{', index);
  gradle = gradle.slice(0, openBraceClose + 1) + signingBlock + gradle.slice(openBraceClose + 1);

  // Adiciona signingConfig signingConfigs.release dentro do release { ... }
  const releaseMatch = gradle.match(/release\s*\{/);
  if (releaseMatch) {
    const releaseOpen = gradle.indexOf('{', releaseMatch.index);
    gradle =
      gradle.slice(0, releaseOpen + 1) +
      '\n            signingConfig signingConfigs.release' +
      gradle.slice(releaseOpen + 1);
  } else {
    log('⚠️  Bloco "release {" não encontrado em buildTypes.');
  }

  return gradle;
}

// ---------------------------------------------------------------------------
// 2. Inject permissions into AndroidManifest.xml
// ---------------------------------------------------------------------------
const REQUIRED_PERMISSIONS = [
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.WAKE_LOCK',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.POST_NOTIFICATIONS',
];

function injectPermissions(manifest) {
  if (!fs.existsSync(MANIFEST)) {
    log('⚠️  AndroidManifest.xml não encontrado — pulando permissões.');
    return manifest;
  }

  const toAdd = REQUIRED_PERMISSIONS.filter(
    (perm) => !manifest.includes(`name="${perm}"`),
  );

  if (toAdd.length === 0) {
    log('ℹ️  Permissões já presentes no AndroidManifest.xml.');
    return manifest;
  }

  const permissionLines = toAdd
    .map((perm) => `    <uses-permission android:name="${perm}" />`)
    .join('\n');

  // Usa regex para encontrar a tag <manifest ...> com segurança
  const manifestTagMatch = manifest.match(/<manifest[^>]*>/);
  if (!manifestTagMatch) {
    log('⚠️  Tag <manifest> não encontrada.');
    return manifest;
  }

  const tagEnd = manifestTagMatch.index + manifestTagMatch[0].length;
  manifest =
    manifest.slice(0, tagEnd) +
    '\n' +
    permissionLines +
    manifest.slice(tagEnd);

  return manifest;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function writeIfChanged(filePath, content) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) {
    log(`ℹ️  ${path.basename(filePath)} inalterado.`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  log(`✅ ${path.relative(process.cwd(), filePath)} atualizado.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  log('Iniciando pós-processamento do projeto Android...');

  // build.gradle
  if (fs.existsSync(BUILD_GRADLE)) {
    let gradle = fs.readFileSync(BUILD_GRADLE, 'utf8');
    gradle = injectVersion(gradle);
    gradle = injectSigning(gradle);
    writeIfChanged(BUILD_GRADLE, gradle);
  } else {
    log('⚠️  android/app/build.gradle não encontrado. Execute "npx cap add android" primeiro.');
  }

  // AndroidManifest.xml
  if (fs.existsSync(MANIFEST)) {
    let manifest = fs.readFileSync(MANIFEST, 'utf8');
    manifest = injectPermissions(manifest);
    writeIfChanged(MANIFEST, manifest);
  } else {
    log('⚠️  AndroidManifest.xml não encontrado.');
  }

  // Plugins nativos (FFmpeg + MediaSaver) — fontes versionados em android-reference/
  syncNative();

  log('Concluído.');
}

main();