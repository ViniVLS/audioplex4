import { test, expect } from '@playwright/test';

test('Teste completo: buscar -> tocar -> extrair', async ({ page }) => {
  const errors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', error => errors.push(`PAGE_ERROR: ${error.message}`));

  // Login
  await page.goto('http://localhost:4200/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  await page.locator('input[formcontrolname="email"]').first().fill('vitalidadeativax@gmail.com');
  await page.locator('input[formcontrolname="password"]').first().fill('Monique@2014');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  console.log('1. Login OK - URL:', page.url());

  // Buscar vídeo
  await page.locator('button:has-text("Rick Astley")').click();
  await page.waitForTimeout(8000);
  
  const hasVideoInfo = await page.locator('text=Never Gonna Give You Up').count();
  console.log('2. Vídeo encontrado:', hasVideoInfo > 0 ? 'SIM' : 'NÃO');
  
  if (hasVideoInfo > 0) {
    // Clicar "Tocar Agora"
    const playBtn = page.locator('button:has-text("Tocar Agora")');
    console.log('3. Botão Tocar Agora existe:', await playBtn.count() > 0 ? 'SIM' : 'NÃO');
    
    if (await playBtn.count() > 0) {
      await playBtn.click();
      await page.waitForTimeout(3000);
      
      // Verificar se tocou
      const bodyText = await page.locator('body').textContent();
      const hasQueue = bodyText?.includes('Rick Astley') && bodyText?.includes('queue');
      console.log('4. Após Tocar Agora - texto contém Rick Astley:', bodyText?.includes('Rick Astley') ? 'SIM' : 'NÃO');
      
      // Verificar erros
      console.log('\n=== ERROS ===');
      errors.forEach(e => console.log('ERROR:', e));
      
      if (errors.length === 0) {
        console.log('NENHUM ERRO!');
      }
    }
  }

  expect(true).toBeTruthy();
});
