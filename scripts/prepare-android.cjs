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

const ANDROID_APP_DIR = path.join(__dirname, '..', 'android', 'app');
const BUILD_GRADLE   = path.join(ANDROID_APP_DIR, 'build.gradle');
const MANIFEST       = path.join(ANDROID_APP_DIR, 'src', 'main', 'AndroidManifest.xml');

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

function injectSigning(gradle) {
  const signed = areSigningEnvPresent();

  if (!signed) {
    log('ℹ️  Variáveis de assinatura ausentes — build de DEBUG sem assinatura.');
    return gradle;
  }

  if (gradle.includes('signingConfigs')) {
    log('ℹ️  signingConfigs já presente — nada a fazer.');
    return gradle;
  }

  const { index } = findAndroidBlock(gradle);

  // Bloco signingConfigs que será inserido logo após "android {"
  const signingBlock = `
    signingConfigs {
        release {
            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
`;

  const openBraceClose = gradle.indexOf('{', index);
  // Insere logo após o "{" de "android {" (mantendo a indentação)
  gradle = gradle.slice(0, openBraceClose + 1) + signingBlock + gradle.slice(openBraceClose + 1);

  // Faz o buildTypes.release referenciar o signingConfig
  // Estratégia: dentro do release { ... }, adiciona a linha após "release {"
  const releaseMatch = gradle.match(/release\s*\{/);
  if (releaseMatch) {
    const releaseOpen = gradle.indexOf('{', releaseMatch.index);
    gradle =
      gradle.slice(0, releaseOpen + 1) +
      '\n            signingConfig signingConfigs.release' +
      gradle.slice(releaseOpen + 1);
  } else {
    log('⚠️  Bloco "release {" não encontrado em buildTypes — assinatura pode não ser aplicada.');
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

  // Insere após a tag de abertura <manifest ...>
  const manifestOpen = manifest.indexOf('>');
  const isSelfClosing = manifest[manifestOpen - 1] === '/';

  if (isSelfClosing) {
    // Caso raro de <manifest ... /> — insere antes de "/>"
    manifest =
      manifest.slice(0, manifestOpen) +
      '>\n' +
      permissionLines +
      '\n';
    // remove o "/" antes do ">" original
    manifest = manifest.slice(0, manifest.indexOf('/>')) + '>\n' + manifest.slice(manifest.indexOf('/>') + 2);
    // Simplesmente reescreve: (muito raro, mantém simples)
    log('⚠️  Manifest auto-fechado — ajustando manualmente.');
    // fallback: insere logo após <manifest ...>
    manifest = manifest.replace(
      /(<manifest[^>]*?)\/>/,
      `$1>\n${permissionLines}\n</manifest>`,
    );
  } else {
    manifest =
      manifest.slice(0, manifestOpen + 1) +
      '\n' +
      permissionLines +
      manifest.slice(manifestOpen + 1);
  }

  return manifest;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function areSigningEnvPresent() {
  const required = [
    // 'ANDROID_KEYSTORE_PATH' possui default; as demais são obrigatórias.
    'ANDROID_KEYSTORE_PASSWORD',
    'ANDROID_KEY_ALIAS',
    'ANDROID_KEY_PASSWORD',
  ];
  return required.every((k) => process.env[k] && process.env[k].length > 0);
}

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

  log('Concluído.');
}

main();