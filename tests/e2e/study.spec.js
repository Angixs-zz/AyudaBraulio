import { test, expect } from '@playwright/test';

test('a student can complete and bookmark a lesson, then resume after reload', async ({ page }) => {
  await page.goto('/#leccion/ios');
  await page.getByRole('button', { name: 'Guardar tema', exact: true }).click();
  await page.getByRole('button', { name: 'Marcar como entendido' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Completado · desmarcar' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardado', exact: true })).toBeVisible();
  await page.goto('/#inicio');
  await expect(page.locator('.stat').first()).toContainText('1 / 12');
});

test('lab checklist and per-router configuration are usable and persistent', async ({ page }) => {
  await page.goto('/#practica/rip-cuatro');
  await page.locator('[data-practice="rip-cuatro"]').first().check();
  await page.reload();
  await expect(page.locator('[data-practice="rip-cuatro"]').first()).toBeChecked();
  await expect(page.locator('#lab-progress-text')).toHaveText('1 de 5 pasos completados');
  await page.locator('#config-device').selectOption('R4');
  await expect(page.locator('#device-config')).toContainText('hostname R4');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar configuración .txt' }).click();
  expect((await downloaded).suggestedFilename()).toBe('rip-cuatro-R4.txt');
});

test('packet explorer explains a blocked route, routing, and local switching', async ({ page }) => {
  await page.goto('/#mapa');
  await page.getByRole('button', { name: 'Enviar paquete' }).click();
  await expect(page.locator('#packet-result')).toContainText('Falta el paso de capa 3');
  await page.locator('#packet-routing').check();
  await page.getByRole('button', { name: 'Enviar paquete' }).click();
  await expect(page.locator('#packet-result')).toContainText('¡Llegó a la VLAN 102!');
  await page.locator('#packet-routing').uncheck();
  await page.locator('#packet-destination').selectOption('same');
  await page.getByRole('button', { name: 'Enviar paquete' }).click();
  await expect(page.locator('#packet-result')).toContainText('¡Llegó dentro de la VLAN 101!');
});

test('campus generator updates department-specific addressing and downloadable output', async ({ page }) => {
  await page.goto('/#mapa');
  await page.locator('#campus-department').selectOption('108');
  await expect(page.locator('#campus-facts')).toContainText('10.168.108.0/24');
  await expect(page.locator('#campus-code')).toContainText('ip address 10.168.0.17');
  await page.locator('#campus-role').selectOption('dhcp');
  await expect(page.locator('#campus-code')).toContainText('ip dhcp pool INDUSTRIAL');
  await expect(page.locator('#campus-code')).toContainText('default-router 10.168.108.1');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar .txt', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('campus-vlan108-dhcp.txt');
});

test('calculator handles valid prefixes and rejects invalid input in the UI', async ({ page }) => {
  await page.goto('/#mapa');
  await page.locator('#subnet-input').fill('10.0.0.3/31');
  await page.getByRole('button', { name: 'Calcular' }).click();
  await expect(page.locator('#subnet-result')).toContainText('10.0.0.2/31');
  await expect(page.locator('#subnet-result')).toContainText('No aplica');
  await page.locator('#subnet-input').fill('300.1.2.3/24');
  await page.getByRole('button', { name: 'Calcular' }).click();
  await expect(page.getByRole('alert')).toContainText('Cada octeto');
});

test('search and command filters work without accents and handle empty results', async ({ page }) => {
  await page.goto('/#inicio');
  await page.locator('#global-query').fill('direccionamiento');
  await page.locator('#global-query').press('Enter');
  await expect(page.locator('.search-result').first()).toContainText('IP, máscara y gateway');
  await page.goto('/#comandos/dhcp');
  await page.locator('#command-query').fill('concesiones');
  await expect(page.locator('.command-row')).toHaveCount(1);
  await expect(page.locator('.command-row')).toContainText('show ip dhcp binding');
  await page.locator('#command-query').fill('ninguncomando');
  await expect(page.locator('.empty-state')).toContainText('No encontré');
});

test('quiz explains answers, finishes once, and persists its result', async ({ page }) => {
  await page.goto('/#repaso');
  await page.locator('#quiz-topic').selectOption('dhcp');
  await page.getByRole('button', { name: 'Empezar reto' }).click();
  for (let i = 0; i < 2; i++) {
    const prompt = await page.locator('.quiz-question h2').textContent();
    await page.locator(`[data-answer="${prompt.includes('DORA') ? 1 : 2}"]`).click();
    await expect(page.locator('.answer-feedback')).toContainText('¡Exacto!');
    await expect(page.locator('[data-action="answer"]:enabled')).toHaveCount(0);
    await page.locator('[data-action="next-question"]').click();
  }
  await expect(page.locator('.quiz-score')).toHaveText('100%');
  await page.reload();
  await expect(page.locator('.quiz-stats')).toContainText('100%');
  await expect(page.locator('.quiz-stats')).toContainText('Repasos terminados 1');
  await page.getByRole('button', { name: 'Mostrar respuesta' }).click();
  await expect(page.locator('.flashcard')).toContainText('El switch decide con MAC');
});

test('all original notes load, open and download, including missing-attachment context', async ({ page }) => {
  await page.goto('/#biblioteca');
  await expect(page.locator('.original-row')).toHaveCount(43);
  await page.locator('#notes-query').fill('PRACTICA GENERAL');
  await page.getByRole('link', { name: /PRACTICA GENERAL/ }).click();
  await expect(page.locator('.original-content')).toContainText('Imagen mencionada: principiosSwitch.png');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar .md' }).click();
  expect((await download).suggestedFilename()).toBe('PRACTICA GENERAL.md');
});

test('failed notes fetch can be retried without a page reload', async ({ page }) => {
  let fails = true;
  await page.route('**/apuntes/originales.json', async route => fails ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
  await page.goto('/#biblioteca');
  await expect(page.getByRole('button', { name: 'Reintentar', exact: true })).toBeVisible();
  fails = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.original-row')).toHaveCount(43);
});

test('simulator receives IOS commands and can return to the dashboard', async ({ page }) => {
  await page.goto('/#simulador');
  await page.getByRole('link', { name: 'Entrar al simulador' }).click();
  await page.locator('#commandInput').fill('enable');
  await page.locator('#commandInput').press('Enter');
  await expect(page.locator('#promptLabel')).toHaveText('Switch#');
  for (const command of ['configure terminal', 'vlan 116', 'name INDUSTRIAL', 'end', 'show vlan brief']) {
    await page.locator('#commandInput').fill(command);
    await page.locator('#commandInput').press('Enter');
  }
  await expect(page.locator('#terminalOutput')).toContainText('INDUSTRIAL');
  await page.getByRole('link', { name: 'Volver a Braulio · Network Lab' }).click();
  await expect(page.locator('h1')).toContainText('Tu switch virtual');
});

test('mobile navigation works and all main views avoid page-level horizontal overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir navegación' }).click();
  await page.getByRole('link', { name: 'Ruta de aprendizaje', exact: true }).click();
  await expect(page.locator('h1')).toContainText('Conecta una idea');
  for (const route of ['inicio', 'ruta', 'leccion/trunks', 'practicas', 'practica/ospf-cuatro', 'mapa', 'comandos', 'repaso', 'biblioteca', 'simulador']) {
    await page.goto(`/#${route}`);
    await expect(page.locator('h1')).toBeVisible();
    const dimensions = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: window.innerWidth }));
    expect(dimensions.actual, route).toBeLessThanOrEqual(dimensions.viewport);
  }
  expect(errors).toEqual([]);
});
