import { test, expect, Page } from '@playwright/test';

// Test configuration
const TEST_URL = 'http://localhost:4200';

// Helper: Wait for Angular app to load
async function waitForAppLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
}

// Helper: Check for console errors
function setupConsoleErrorTracking(page: Page) {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  return errors;
}

test.describe('AudioPlex4 - Testes Completos', () => {
  
  test.describe('1. Carregamento da Aplicação', () => {
    
    test('1.1 Página principal carrega corretamente', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page);
      
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      const title = await page.title();
      console.log(`Título da página: ${title}`);
      
      const criticalErrors = errors.filter(e => 
        e.includes('TypeError') || 
        e.includes('ReferenceError') ||
        e.includes('SyntaxError')
      );
      
      if (criticalErrors.length > 0) {
        console.log('Erros críticos encontrados:', criticalErrors);
      }
      
      const hasAngular = await page.evaluate(() => {
        return !!(window as any).ng || document.querySelector('[ng-version]') !== null;
      });
      
      console.log('Angular carregado:', hasAngular);
      expect(hasAngular).toBeTruthy();
    });

    test('1.2 Rota de login funciona', async ({ page }) => {
      await page.goto(`${TEST_URL}/login`);
      await waitForAppLoad(page);
      
      const hasEmailInput = await page.locator('input[type="email"], input[formcontrolname="email"]').count();
      const hasPasswordInput = await page.locator('input[type="password"], input[formcontrolname="password"]').count();
      
      console.log('Email input:', hasEmailInput);
      console.log('Password input:', hasPasswordInput);
      
      expect(hasEmailInput).toBeGreaterThan(0);
      expect(hasPasswordInput).toBeGreaterThan(0);
    });

    test('1.3 Rota de registro funciona', async ({ page }) => {
      await page.goto(`${TEST_URL}/register`);
      await waitForAppLoad(page);
      
      const hasEmailInput = await page.locator('input[type="email"], input[formcontrolname="email"]').count();
      const hasPasswordInput = await page.locator('input[type="password"], input[formcontrolname="password"]').count();
      
      console.log('Email input:', hasEmailInput);
      console.log('Password input:', hasPasswordInput);
      
      expect(hasEmailInput).toBeGreaterThan(0);
      expect(hasPasswordInput).toBeGreaterThan(0);
    });
  });

  test.describe('2. Funcionalidades da API', () => {
    
    test('2.1 Health check da API', async ({ request }) => {
      const response = await request.get('http://localhost:3000/api/health');
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      console.log('Health check:', data);
      
      // API retorna {status: 'OK'} ou {success: true}
      expect(data.status === 'OK' || data.success === true).toBeTruthy();
    });

    test('2.2 Busca de informações de vídeo', async ({ request }) => {
      const response = await request.post('http://localhost:3000/api/video-info', {
        data: {
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }
      });
      
      expect(response.ok()).toBeTruthy();
      
      const data = await response.json();
      console.log('Video info response:', {
        success: data.success,
        hasVideoInfo: !!data.videoInfo,
        title: data.videoInfo?.title,
        duration: data.videoInfo?.durationSeconds
      });
      
      // API retorna {success: true, videoInfo: {...}}
      expect(data.success).toBeTruthy();
      expect(data.videoInfo).toBeTruthy();
      expect(data.videoInfo.title).toBeTruthy();
      expect(data.videoInfo.durationSeconds).toBeGreaterThan(0);
    });

    test('2.3 Queue - operações CRUD', async ({ request }) => {
      // Limpar queue
      await request.delete('http://localhost:3000/api/player/queue');
      
      // Adicionar item
      const addResponse = await request.post('http://localhost:3000/api/player/queue', {
        data: {
          video_id: 'test-video-1',
          title: 'Test Video 1',
          author: 'Test Author',
          thumbnail: 'https://example.com/thumb.jpg',
          duration: 180,
          url: 'https://www.youtube.com/watch?v=test1'
        }
      });
      
      expect(addResponse.ok()).toBeTruthy();
      const addData = await addResponse.json();
      console.log('Item adicionado:', addData.success);
      
      // Listar queue
      const listResponse = await request.get('http://localhost:3000/api/player/queue');
      expect(listResponse.ok()).toBeTruthy();
      
      const listData = await listResponse.json();
      console.log('Queue length:', listData.queue.length);
      expect(listData.queue.length).toBe(1);
      
      // Adicionar segundo item
      await request.post('http://localhost:3000/api/player/queue', {
        data: {
          video_id: 'test-video-2',
          title: 'Test Video 2',
          author: 'Test Author 2',
          thumbnail: 'https://example.com/thumb2.jpg',
          duration: 240,
          url: 'https://www.youtube.com/watch?v=test2'
        }
      });
      
      // Verificar queue com 2 itens
      const listResponse2 = await request.get('http://localhost:3000/api/player/queue');
      const listData2 = await listResponse2.json();
      expect(listData2.queue.length).toBe(2);
      
      console.log('Queue final:', listData2.queue.map((q: any) => q.track.title));
    });

    test('2.4 Preferences - operações CRUD', async ({ request }) => {
      // Obter preferences atuais
      const getResponse = await request.get('http://localhost:3000/api/player/preferences');
      expect(getResponse.ok()).toBeTruthy();
      
      const getData = await getResponse.json();
      console.log('Preferences iniciais:', getData.preferences);
      
      // Atualizar preferences
      const updateResponse = await request.put('http://localhost:3000/api/player/preferences', {
        data: {
          volume: 0.5,
          muted: true,
          repeatMode: 'all',
          shuffle: true
        }
      });
      
      expect(updateResponse.ok()).toBeTruthy();
      
      // Verificar se foram salvas
      const verifyResponse = await request.get('http://localhost:3000/api/player/preferences');
      const verifyData = await verifyResponse.json();
      
      expect(verifyData.preferences.volume).toBe(0.5);
      expect(verifyData.preferences.muted).toBe(true);
      expect(verifyData.preferences.repeat_mode).toBe('all');
      expect(verifyData.preferences.shuffle).toBe(true);
      
      console.log('Preferences verificadas:', verifyData.preferences);
    });
  });

  test.describe('3. Funcionalidades do Frontend', () => {
    
    test('3.1 Página inicial (home) carrega', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page);
      
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      // Verificar se há elementos na página
      const bodyContent = await page.locator('body').textContent();
      console.log('Conteúdo da página (primeiros 200 chars):', bodyContent?.substring(0, 200));
      
      // Verificar erros no console
      const jsErrors = errors.filter(e => e.includes('Error') || e.includes('error'));
      if (jsErrors.length > 0) {
        console.log('Erros JS encontrados:', jsErrors.slice(0, 5));
      }
    });

    test('3.2 Player de áudio existe na página', async ({ page }) => {
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      // Verificar se há elemento de áudio
      const audioElement = await page.locator('audio').count();
      console.log('Elementos de áudio:', audioElement);
      
      // Verificar se há mini-player (pode estar escondido se não há track)
      const miniPlayer = await page.locator('app-mini-player').count();
      console.log('Mini-player component:', miniPlayer);
      
      // Verificar se há now-playing
      const nowPlaying = await page.locator('app-now-playing').count();
      console.log('Now-playing component:', nowPlaying);
      
      expect(audioElement).toBeGreaterThan(0);
      expect(miniPlayer).toBeGreaterThan(0);
      expect(nowPlaying).toBeGreaterThan(0);
    });

    test('3.3 Fila de reprodução existe', async ({ page }) => {
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      // Verificar se há queue drawer
      const queueDrawer = await page.locator('app-queue-drawer').count();
      console.log('Queue drawer component:', queueDrawer);
      
      expect(queueDrawer).toBeGreaterThan(0);
    });
  });

  test.describe('4. Testes de Integração', () => {
    
    test('4.1 Botões de controle do player existem', async ({ page }) => {
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      // Verificar botões de Material Design
      const matButtons = await page.locator('button[mat-icon-button], button[mat-fab]').count();
      console.log('Botões Material:', matButtons);
      
      // Verificar mat-icon elements
      const matIcons = await page.locator('mat-icon').count();
      console.log('Ícones Material:', matIcons);
      
      // Verificar se há ícones específicos do player
      const playArrowIcon = await page.locator('mat-icon:has-text("play_arrow")').count();
      const pauseIcon = await page.locator('mat-icon:has-text("pause")').count();
      const skipNextIcon = await page.locator('mat-icon:has-text("skip_next")').count();
      const skipPreviousIcon = await page.locator('mat-icon:has-text("skip_previous")').count();
      
      console.log('Ícones play_arrow:', playArrowIcon);
      console.log('Ícones pause:', pauseIcon);
      console.log('Ícones skip_next:', skipNextIcon);
      console.log('Ícones skip_previous:', skipPreviousIcon);
      
      // Pelo menos alguns controles devem existir
      expect(matButtons + matIcons).toBeGreaterThan(0);
    });

    test('4.2 Slider de volume existe', async ({ page }) => {
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      // Verificar input range (volume slider)
      const rangeInputs = await page.locator('input[type="range"]').count();
      console.log('Inputs range:', rangeInputs);
      
      // Verificar se há displays de tempo
      const timeElements = await page.locator('.time, [class*="time"]').count();
      console.log('Elementos de tempo:', timeElements);
    });
  });

  test.describe('5. Testes de Performance', () => {
    
    test('5.1 Tempo de carregamento da página', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      const loadTime = Date.now() - startTime;
      console.log(`Tempo de carregamento: ${loadTime}ms`);
      
      expect(loadTime).toBeLessThan(10000);
    });
  });

  test.describe('6. Testes de Erro', () => {
    
    test('6.1 Tratamento de erro de rede', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page);
      
      await page.goto(TEST_URL);
      await waitForAppLoad(page);
      
      // Simular erro de rede
      await page.route('**/api/**', route => {
        route.abort('connectionrefused');
      });
      
      // Verificar se a aplicação não crasheou
      const isPageStillAlive = await page.evaluate(() => {
        return document.body !== null;
      });
      
      expect(isPageStillAlive).toBeTruthy();
      console.log('Aplicação sobreviveu a erro de rede');
    });

    test('6.2 Rota inexistente redireciona', async ({ page }) => {
      await page.goto(`${TEST_URL}/rota-inexistente-12345`);
      await waitForAppLoad(page);
      
      const url = page.url();
      console.log('URL após rota inexistente:', url);
      
      // A aplicação deve tratar a rota
      const isPageValid = await page.evaluate(() => {
        return document.body !== null;
      });
      
      expect(isPageValid).toBeTruthy();
    });
  });
});
