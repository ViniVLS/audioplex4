import { test, expect } from '@playwright/test';

test('Capturar estado real da aplicação', async ({ page }) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });
  page.on('pageerror', error => errors.push(`PAGE_ERROR: ${error.message}`));

  // 1. Tela de login
  await page.goto('http://localhost:4200/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/01-login.png', fullPage: true });
  
  console.log('=== TELA DE LOGIN ===');
  console.log('URL:', page.url());
  const loginText = await page.locator('body').textContent();
  console.log('Texto visível:', loginText?.substring(0, 500));
  
  // 2. Tentar logar com credenciais
  const emailInput = page.locator('input[formcontrolname="email"]').first();
  const passwordInput = page.locator('input[formcontrolname="password"]').first();
  
  if (await emailInput.count() > 0) {
    await emailInput.fill('vitalidadeativax@gmail.com');
    await passwordInput.fill('Monique@2014');
    await page.screenshot({ path: 'test-results/02-login-filled.png', fullPage: true });
    
    // Clicar em Entrar
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'test-results/03-after-login.png', fullPage: true });
    
    console.log('\n=== APÓS LOGIN ===');
    console.log('URL:', page.url());
    const afterLoginText = await page.locator('body').textContent();
    console.log('Texto visível:', afterLoginText?.substring(0, 800));
  }

  // 3. Se foi para home, verificar o que tem
  if (page.url().includes('/') && !page.url().includes('login')) {
    await page.screenshot({ path: 'test-results/04-home.png', fullPage: true });
    
    // Verificar o que existe na home
    const buttons = await page.locator('button').allTextContents();
    console.log('\n=== BOTÕES NA HOME ===');
    console.log(buttons);
    
    const inputs = await page.locator('input').count();
    console.log('Inputs:', inputs);
    
    const links = await page.locator('a').allTextContents();
    console.log('Links:', links);
    
    // Tentar usar um vídeo de teste
    const testBtn = page.locator('button:has-text("Rick Astley")');
    if (await testBtn.count() > 0) {
      await testBtn.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/05-video-searched.png', fullPage: true });
      
      console.log('\n=== APÓS BUSCAR VÍDEO ===');
      const afterSearchText = await page.locator('body').textContent();
      console.log('Texto visível:', afterSearchText?.substring(0, 1000));
    }
  }
  
  console.log('\n=== ERROS NO CONSOLE ===');
  errors.forEach(e => console.log('ERROR:', e));
  
  console.log('\n=== WARNINGS NO CONSOLE ===');
  warnings.forEach(w => console.log('WARN:', w));
  
  // Não falhar o teste, queremos só ver o que acontece
  expect(true).toBeTruthy();
});
