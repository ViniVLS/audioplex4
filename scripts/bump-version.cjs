#!/usr/bin/env node
// scripts/bump-version.cjs
// ---------------------------------------------------------------------------
// Versionamento automático para Android builds.
//
// Uso:
//   node scripts/bump-version.cjs [patch|minor|major]
//
// - patch (padrão): 1.0.0 → 1.0.1
// - minor:          1.0.0 → 1.1.0
// - major:          1.0.0 → 2.0.0
//
// O script:
//   1. Lê a versão atual do package.json
//   2. Incrementa conforme o tipo especificado
//   3. Atualiza package.json, environment.ts, environment.production.ts
//   4. Atualiza build.gradle (versionCode + versionName)
// ---------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const ENV_TS = path.join(ROOT, 'frontend', 'src', 'environments', 'environment.ts');
const ENV_PROD = path.join(ROOT, 'frontend', 'src', 'environments', 'environment.production.ts');
const BUILD_GRADLE = path.join(ROOT, 'android', 'app', 'build.gradle');

const bumpType = process.argv[2] || 'patch';

function log(msg) {
  console.log(`[bump-version] ${msg}`);
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Versão inválida: ${version}`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function incrementVersion(version, type) {
  const v = parseVersion(version);
  switch (type) {
    case 'major':
      return `${v.major + 1}.0.0`;
    case 'minor':
      return `${v.major}.${v.minor + 1}.0`;
    case 'patch':
    default:
      return `${v.major}.${v.minor}.${v.patch + 1}`;
  }
}

function updateFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    log(`⚠️  Arquivo não encontrado: ${filePath}`);
    return false;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    log(`✅ ${path.relative(ROOT, filePath)} atualizado.`);
    return true;
  }

  log(`ℹ️  ${path.relative(ROOT, filePath)} inalterado.`);
  return false;
}

function main() {
  log(`Tipo de bump: ${bumpType}`);

  // 1. Ler versão atual do package.json
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
  const currentVersion = packageJson.version;
  log(`Versão atual: ${currentVersion}`);

  // 2. Incrementar versão
  const newVersion = incrementVersion(currentVersion, bumpType);
  log(`Nova versão: ${newVersion}`);

  // 3. Calcular versionCode (baseado no timestamp)
  const versionCode = Math.floor(Date.now() / 1000);
  log(`VersionCode: ${versionCode}`);

  // 4. Atualizar package.json
  packageJson.version = newVersion;
  fs.writeFileSync(PACKAGE_JSON, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
  log('✅ package.json atualizado.');

  // 5. Atualizar environment.ts
  updateFile(ENV_TS, [
    [/version:\s*'[^']*'/, `version: '${newVersion}'`],
  ]);

  // 6. Atualizar environment.production.ts
  updateFile(ENV_PROD, [
    [/version:\s*'[^']*'/, `version: '${newVersion}'`],
  ]);

  // 7. Atualizar build.gradle
  updateFile(BUILD_GRADLE, [
    [/versionCode\s+\d+/, `versionCode ${versionCode}`],
    [/versionName\s+"[^"]*"/, `versionName "${newVersion}"`],
  ]);

  log(`✅ Versão ${newVersion} (code: ${versionCode}) configurada.`);
}

main();
