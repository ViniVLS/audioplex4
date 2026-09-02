// scripts/write-env.cjs
// -----------------------------------------------------------------------------
// Gera frontend/src/environments/environment.production.ts a partir de
// variáveis de ambiente injetadas no CI (GitHub Actions secrets).
//
// Variáveis esperadas:
//   NG_APP_SUPABASE_URL
//   NG_APP_SUPABASE_ANON_KEY
//
// Se as variáveis não existirem, mantém placeholders visíveis para que o
// build não falhe (útil para PRs / builds de debug).
// -----------------------------------------------------------------------------

const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname,
  '..',
  'frontend',
  'src',
  'environments',
  'environment.production.ts',
);

const SUPABASE_URL = process.env.NG_APP_SUPABASE_URL || '__SUPABASE_URL__';
const SUPABASE_ANON_KEY = process.env.NG_APP_SUPABASE_ANON_KEY || '__SUPABASE_ANON_KEY__';

const content = `// frontend/src/environments/environment.production.ts
// GERADO AUTOMATICAMENTE por scripts/write-env.cjs — NÃO EDITE MANUALMENTE.
export const environment = {
  production: true,

  supabase: {
    url: '${SUPABASE_URL}',
    anonKey: '${SUPABASE_ANON_KEY}',
  },
};
`;

fs.writeFileSync(TARGET, content, 'utf8');
console.log(`[write-env] environment.production.ts gerado com (url=${SUPABASE_URL}).`);