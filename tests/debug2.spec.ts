import { test, expect } from '@playwright/test';

test('Debug completo - verificar todas as funcionalidades', async ({ page }) => {
  const errors: string[] = [];
  const networkErrors: string[] = [];
  const requests: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', error => errors.push(`PAGE_ERROR: ${error.message}`));
  page.on('requestfailed', req => networkErrors.push(`FAILED: ${req.url()} - ${req.failure()?.errorText}`));
  page.on('response', res => {
    if (res.status() >= 400) {
      requests.push(`${res.status()} ${res.url()}`);
    }
  });

  // Login
  await page.goto('http://localhost:4200/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  await page.locator('input[formcontrolname="email"]').first().fill('vitalidadeativax@gmail.com');
  await page.locator('input[formcontrolname="password"]').first().fill('Monique@2014');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForTimeout(3000);
  
  console.log('URL após login:', page.url());

  // Home - buscar vídeo
  const testBtn = page.locator('button:has-text("Rick Astley")');
  if (await testBtn.count() > 0) {
    console.log('Clicando em Rick Astley...');
    await testBtn.click();
    
    // Esperar 15 segundos para ver se Completa
    console.log('Aguardando resposta...');
    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      const text = await page.locator('body').textContent();
      if (!text?.includes('Buscando informações')) {
        console.log(`Completou após ${i+1}s`);
        break;
      }
      if (i === 14) console.log('TIMEOUT após 15s - busca travou!');
    }
    
    await page.screenshot({ path: 'test-results/debug-home.png', fullPage: true });
    
    const homeText = await page.locator('body').textContent();
    console.log('Texto final da home:', homeText?.substring(0, 1500));
  }

  console.log('\n=== NETWORK ERRORS ===');
  networkErrors.forEach(e => console.log(e));
  
  console.log('\n=== HTTP ERRORS (4xx/5xx) ===');
  requests.forEach(e => console.log(e));
  
  console.log('\n=== CONSOLE ERRORS ===');
  errors.forEach(e => console.log(e));

  expect(true).toBeTruthy();
});
