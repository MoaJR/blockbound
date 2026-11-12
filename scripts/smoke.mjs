/**
 * Smoke test real no navegador (Playwright + Chromium do cache local).
 * Cobre: menu, início de run, tap-to-place, arrastar, poderes, pausa,
 * autosave/retomada, telas secundárias, mobile, tablet e overflow horizontal.
 *
 * Uso: npm run build && npm run smoke
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = process.env.SMOKE_PORT || '4173';
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = path.join(ROOT, 'screenshots');
const failures = [];
const consoleErrors = [];

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const cache = path.join(homedir(), '.cache', 'ms-playwright');
  const candidates = [
    path.join(cache, 'chromium-1254', 'chrome-linux64', 'chrome'),
    path.join(cache, 'chromium-1234', 'chrome-linux64', 'chrome'),
    path.join(
      cache,
      'chromium_headless_shell-1254',
      'chrome-headless-shell-linux64',
      'chrome-headless-shell',
    ),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      /* ainda subindo */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function check(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
  } else {
    failures.push(message);
    console.error(`  ✗ ${message}`);
  }
}

async function countBlocks(page) {
  return page.locator('.cell--block').count();
}

async function tapAt(page, x, y, touch) {
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function playTapToPlace(page, useTouch = false) {
  const trayBox = await page.locator('.tray__card:not(.tray__card--used)').first().boundingBox();
  if (!trayBox) return { hint: 0, placed: false };
  await tapAt(page, trayBox.x + trayBox.width / 2, trayBox.y + trayBox.height / 2, useTouch);
  await page.waitForTimeout(140);
  const hint = await page.locator('.tray-hint').count();
  const empties = page.locator('.cell--empty');
  const total = await empties.count();
  for (let index = total - 1; index >= 0; index -= 1) {
    const box = await empties.nth(index).boundingBox();
    if (!box) continue;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await tapAt(page, x, y, useTouch);
    await page.waitForTimeout(100);
    const valid = await page.locator('.preview-cell--good').count();
    if (valid > 0) {
      await tapAt(page, x, y, useTouch);
      await page.waitForTimeout(340);
      return { hint, placed: true };
    }
  }
  return { hint, placed: false };
}

async function overflowOf(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function run() {
  if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true });
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('Chromium não encontrado no cache do Playwright.');
    process.exit(1);
  }

  const viteBin = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const server = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', PORT, '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: 'ignore', detached: true },
  );

  const stopServer = () => {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      try {
        server.kill('SIGKILL');
      } catch {
        /* já encerrado */
      }
    }
  };

  if (!(await waitForServer(BASE))) {
    stopServer();
    console.error('Servidor de preview não respondeu.');
    process.exit(1);
  }

  const browser = await chromium.launch({ executablePath: chromePath, args: ['--no-sandbox'] });

  try {
    // ---------- DESKTOP ----------
    console.log('\n[desktop 1440x900]');
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await desktop.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`desktop: ${msg.text()}`);
    });
    page.on('pageerror', (error) => consoleErrors.push(`desktop pageerror: ${error.message}`));

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });

    check(
      (await page.locator('.logo__text').innerText()).replace(/\s+/g, '') === 'BLOCKBOUND',
      'menu exibe o logo BLOCKBOUND',
    );
    check((await page.getByRole('button', { name: /^jogar$/i }).count()) > 0, 'botão Jogar presente');
    check((await page.getByRole('button', { name: /coleção/i }).count()) > 0, 'acesso à Coleção presente');
    check(
      (await page.getByRole('button', { name: /conquistas/i }).count()) > 0,
      'acesso a Conquistas presente',
    );
    check(
      (await page.getByRole('button', { name: /estatísticas/i }).count()) > 0,
      'acesso a Estatísticas presente',
    );
    await page.screenshot({ path: path.join(SHOTS, '01-menu-desktop.png') });

    await page.getByRole('button', { name: /^jogar$/i }).first().click();
    await page.waitForSelector('.board', { timeout: 5000 });
    check((await page.locator('.tray__card').count()) === 3, 'bandeja com 3 peças');
    check((await page.locator('.objective').count()) >= 1, 'objetivos visíveis');
    check((await page.locator('.power').count()) >= 1, 'poderes disponíveis');
    check((await page.locator('.energybar').count()) === 1, 'barra de energia visível');
    await page.screenshot({ path: path.join(SHOTS, '02-run-desktop.png') });

    const before = await countBlocks(page);
    const tapResult = await playTapToPlace(page);
    const after = await countBlocks(page);
    check(tapResult.hint > 0, 'toque seleciona prévia no tabuleiro');
    check(tapResult.placed && after > before, 'tap-to-place posiciona a peça');
    const scoreText = await page.locator('.hud__score-value').innerText();
    check(Number(scoreText.replace(/\D/g, '')) > 0, `pontuação aumentou (${scoreText})`);

    // Arrastar a próxima peça: sem snap (ghost acompanha o ponteiro) + preview
    const tray2 = page.locator('.tray__card:not(.tray__card--used)').first();
    const trayBox = await tray2.boundingBox();
    const boardBox = await page.locator('.board').boundingBox();
    if (trayBox && boardBox) {
      const cell = boardBox.width / 9;
      const readGhost = () =>
        page.evaluate(() => {
          const el = document.querySelector('.drag-ghost');
          if (!el) return null;
          const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
          return { x: matrix.m41, y: matrix.m42 };
        });

      await page.mouse.move(trayBox.x + trayBox.width / 2, trayBox.y + trayBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(boardBox.x + cell * 1.5, boardBox.y + cell * 1.5, { steps: 10 });
      await page.waitForTimeout(60);
      const firstPos = await readGhost();
      const previewDuringDrag = await page.locator('.preview-cell--good').count();
      const predictDuringDrag = await page.locator('.board-predict').count();

      // 2px de movimento do mouse devem gerar ~2px de movimento da peça (sem snap).
      await page.mouse.move(boardBox.x + cell * 1.5 + 2, boardBox.y + cell * 1.5, { steps: 1 });
      await page.waitForTimeout(60);
      const secondPos = await readGhost();

      check(previewDuringDrag > 0, 'arraste mostra preview fantasma');
      check(predictDuringDrag === 1, 'arraste mostra pontuação prevista');
      await page.screenshot({ path: path.join(SHOTS, '19-drag-desktop.png') });
      check(
        Boolean(firstPos && secondPos) &&
          Math.abs((secondPos.x - firstPos.x) - 2) < 0.75 &&
          Math.abs(secondPos.y - firstPos.y) < 0.75,
        `ghost acompanha o ponteiro sem snap (${firstPos?.x.toFixed(1)} → ${secondPos?.x.toFixed(1)})`,
      );

      await page.mouse.move(boardBox.x + cell * 1.5, boardBox.y + cell * 1.5, { steps: 3 });
      await page.waitForTimeout(60);
      const previewKeys = await page.evaluate(() => {
        const board = document.querySelector('.board')?.getBoundingClientRect();
        if (!board) return [];
        const size = board.width / 9;
        return [...document.querySelectorAll('.preview-cell--good')].map((el) => {
          const rect = el.getBoundingClientRect();
          return `${Math.round((rect.y - board.y) / size)}:${Math.round((rect.x - board.x) / size)}`;
        });
      });
      await page.mouse.up();
      await page.waitForTimeout(280);
      check((await countBlocks(page)) > after, 'arrastar e soltar posiciona a peça');
      check((await page.locator('.drag-ghost').count()) === 0, 'ghost some ao soltar');

      const matchesPreview = await page.evaluate((keys) => {
        const grid = document.querySelector('.board__grid');
        if (!grid) return false;
        const cells = [...grid.children];
        return keys.every((key) => {
          const [r, c] = key.split(':').map(Number);
          const cell = cells[r * 9 + c];
          return Boolean(cell) && !cell.classList.contains('cell--empty');
        });
      }, previewKeys);
      check(previewKeys.length > 0 && matchesPreview, 'posição confirmada é exatamente a do preview');
    }

    // Poder Reorganizar
    const shuffleButton = page.getByRole('button', { name: /reorganizar/i }).first();
    if ((await shuffleButton.count()) > 0) {
      await shuffleButton.click();
      await page.waitForTimeout(220);
      check(
        (await page.locator('.tray__card:not(.tray__card--used)').count()) > 0,
        'poder Reorganizar executa',
      );
    }

    // Pausa
    await page.getByRole('button', { name: /pausar/i }).click();
    await page.waitForSelector('.modal');
    check((await page.locator('.modal').innerText()).includes('Pausa'), 'tela de pausa abre');
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForTimeout(200);

    // Autosave / retomada
    const scoreBeforeReload = await page.locator('.hud__score-value').innerText();
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.menu');
    check(
      (await page.getByRole('button', { name: /continuar/i }).count()) > 0,
      'menu oferece Continuar após reload',
    );
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForSelector('.board');
    const scoreAfterReload = await page.locator('.hud__score-value').innerText();
    check(
      scoreBeforeReload === scoreAfterReload,
      `run restaurada do salvamento (${scoreAfterReload})`,
    );

    const overflow = await overflowOf(page);
    check(overflow <= 1, `sem overflow horizontal no desktop (${overflow}px)`);
    await page.screenshot({ path: path.join(SHOTS, '03-run-desktop-after.png') });

    // ---------- RECOMPENSA (save manipulado para concluir o estágio) ----------
    await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return;
      const run = JSON.parse(raw);
      run.stage.objectives = [{ kind: 'score', target: 1, progress: 0 }];
      run.stage.movesLeft = 30;
      run.stage.movesTotal = 30;
      localStorage.setItem('blockbound.run.v1', JSON.stringify(run));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForSelector('.board');
    await playTapToPlace(page);
    await page.waitForSelector('.reward', { timeout: 6000 });
    check((await page.locator('.relic-card').count()) >= 3, 'recompensa oferece 3 relíquias');
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, '12-reward-desktop.png') });
    await page.locator('.relic-card').first().click();
    await page.waitForSelector('.board', { timeout: 8000 });
    await page.waitForTimeout(500);
    check((await page.locator('.relic-rail__item').count()) >= 1, 'relíquia escolhida entra na run');
    check(
      (await page.locator('.hud__stage-label').innerText()).includes('2'),
      'avança para o estágio 2 após a recompensa',
    );
    await page.screenshot({ path: path.join(SHOTS, '13-stage2-desktop.png') });

    // Atalhos de teclado (tabuleiro do estágio 2 está vazio)
    const beforeKeyboard = await countBlocks(page);
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(360);
    check(
      (await countBlocks(page)) > beforeKeyboard,
      'atalho de teclado posiciona peça (1 + Enter)',
    );

    // ---------- ENERGIA E EVENTOS DURANTE A FASE ----------
    await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return;
      const run = JSON.parse(raw);
      run.energy.value = run.energy.max - 1;
      run.energy.pending = 0;
      run.energy.offer = null;
      run.stage.movesLeft = 40;
      run.stage.movesTotal = 40;
      run.stage.objectives = [{ kind: 'score', target: 999999, progress: 0 }];
      localStorage.setItem('blockbound.run.v1', JSON.stringify(run));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForSelector('.board');
    await playTapToPlace(page);
    await page.waitForTimeout(420);
    check(
      (await page.locator('.energybar.is-ready').count()) === 1,
      'energia cheia sinaliza recompensa',
    );
    await page.locator('.energybar__main').click();
    await page.waitForSelector('.modal .choice-card', { timeout: 4000 });
    await page.waitForTimeout(320);
    check((await page.locator('.choice-card').count()) >= 2, 'painel de energia oferece escolhas');
    await page.screenshot({ path: path.join(SHOTS, '18-energy-desktop.png') });
    await page.locator('.choice-card').first().click();
    await page.waitForTimeout(420);
    const energyResult = await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return null;
      const run = JSON.parse(raw);
      return { claimed: run.energy.claimed, pending: run.energy.pending };
    });
    check(
      energyResult?.claimed === 1 && energyResult?.pending === 0,
      'recompensa de energia aplicada uma única vez',
    );

    // Evento injetado no save: chip na HUD, painel e aplicação
    await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return;
      const run = JSON.parse(raw);
      localStorage.setItem('blockbound.smoke.crystals', String(run.crystals));
      run.pendingEvent = {
        id: 'smoke-chest',
        kind: 'chest',
        title: 'Baú Misterioso',
        desc: 'Evento de teste',
        options: [
          {
            id: 'smoke-crystals',
            kind: 'crystals',
            amount: 25,
            label: 'Cristais +25',
            desc: '+25 cristais da run',
            rarity: 'common',
          },
        ],
      };
      localStorage.setItem('blockbound.run.v1', JSON.stringify(run));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForSelector('.board');
    check((await page.locator('.event-chip').count()) === 1, 'evento disponível aparece na HUD');
    await page.locator('.event-chip').click();
    await page.waitForSelector('.modal .choice-card', { timeout: 4000 });
    await page.locator('.choice-card').first().click();
    await page.waitForTimeout(400);
    const eventResult = await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      const before = Number(localStorage.getItem('blockbound.smoke.crystals') ?? '0');
      if (!raw) return null;
      const run = JSON.parse(raw);
      return { pending: run.pendingEvent, crystals: run.crystals, before };
    });
    check(eventResult?.pending === null, 'evento é consumido após a escolha');
    check(
      (eventResult?.crystals ?? -1) === (eventResult?.before ?? 0) + 25,
      'recompensa do evento é aplicada',
    );

    // ---------- CHEFE ----------
    await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return;
      const run = JSON.parse(raw);
      run.stage.index = 3;
      run.stage.number = 4;
      run.stage.isBoss = true;
      run.stage.isFinal = false;
      run.stage.modifier = null;
      run.stage.boss = {
        id: 'ice_king',
        name: 'Rei de Gelo',
        hp: 12,
        maxHp: 20,
        tick: 0,
        phase: 0,
      };
      run.stage.objectives = [{ kind: 'boss', target: 20, progress: 8 }];
      run.stage.movesLeft = 26;
      run.stage.movesTotal = 26;
      localStorage.setItem('blockbound.run.v1', JSON.stringify(run));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForSelector('.board');
    await page.waitForTimeout(500);
    check((await page.locator('.bossbar').count()) === 1, 'barra de chefe é exibida no estágio 4');
    check(
      (await page.locator('.bossbar').innerText()).includes('Rei de Gelo'),
      'chefe exibe nome e regra',
    );
    check(
      (await page.locator('.objective--boss').count()) === 1,
      'objetivo de chefe aparece na HUD',
    );
    await page.screenshot({ path: path.join(SHOTS, '17-boss-desktop.png') });

    // ---------- VITÓRIA ----------
    await page.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return;
      const run = JSON.parse(raw);
      run.stage.index = 7;
      run.stage.number = 8;
      run.stage.isFinal = true;
      run.stage.isBoss = false;
      run.stage.boss = null;
      run.stage.modifier = null;
      run.stage.objectives = [{ kind: 'score', target: 1, progress: 0 }];
      run.stage.movesLeft = 30;
      run.stage.movesTotal = 30;
      localStorage.setItem('blockbound.run.v1', JSON.stringify(run));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /continuar/i }).click();
    await page.waitForSelector('.board');
    await playTapToPlace(page);
    await page.waitForSelector('.result', { timeout: 8000 });
    await page.waitForTimeout(900);
    check((await page.locator('.result.is-victory').count()) === 1, 'tela de vitória é exibida');
    check((await page.locator('.result__crystals').count()) === 1, 'vitória mostra cristais ganhos');
    check((await page.locator('.result__achievements li').count()) >= 1, 'vitória registra conquistas');
    await page.screenshot({ path: path.join(SHOTS, '14-victory-desktop.png') });
    await desktop.close();

    // ---------- MOBILE ----------
    console.log('\n[mobile 390x844 touch]');
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    });
    const mp = await mobile.newPage();
    mp.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(`mobile: ${msg.text()}`);
    });
    mp.on('pageerror', (error) => consoleErrors.push(`mobile pageerror: ${error.message}`));

    await mp.goto(BASE, { waitUntil: 'networkidle' });
    await mp.evaluate(() => localStorage.clear());
    await mp.reload({ waitUntil: 'networkidle' });
    await mp.screenshot({ path: path.join(SHOTS, '04-menu-mobile.png') });

    const menuOverflow = await overflowOf(mp);
    check(menuOverflow <= 1, `sem overflow horizontal no menu mobile (${menuOverflow}px)`);

    await mp.getByRole('button', { name: /^jogar$/i }).first().click();
    await mp.waitForSelector('.board');
    await mp.waitForTimeout(340);
    await mp.screenshot({ path: path.join(SHOTS, '05-run-mobile.png') });

    const mTray = await mp.locator('.tray__card:not(.tray__card--used)').first().boundingBox();
    const beforeMobile = await countBlocks(mp);
    if (mTray) {
      await mp.touchscreen.tap(mTray.x + mTray.width / 2, mTray.y + mTray.height / 2);
      await mp.waitForTimeout(200);
      // mede o tabuleiro depois da seleção (o layout do dock é estável por design)
      const mBoard = await mp.locator('.board').boundingBox();
      if (mBoard) {
        const cell = mBoard.width / 9;
        const tx = mBoard.x + cell * 4.5;
        const ty = mBoard.y + cell * 4.5;
        await mp.touchscreen.tap(tx, ty);
        await mp.waitForTimeout(200);
        await mp.touchscreen.tap(tx, ty);
        await mp.waitForTimeout(340);
      }
    }
    check((await countBlocks(mp)) > beforeMobile, 'tap-to-place funciona com toque');

    // Arrastar no mobile (mesma geometria, viewport estreita)
    const mobileBeforeDrag = await countBlocks(mp);
    const dragTray = mp.locator('.tray__card:not(.tray__card--used)').first();
    const dragTrayBox = await dragTray.boundingBox();
    const dragBoardBox = await mp.locator('.board').boundingBox();
    if (dragTrayBox && dragBoardBox) {
      const dragCell = dragBoardBox.width / 9;
      await mp.mouse.move(
        dragTrayBox.x + dragTrayBox.width / 2,
        dragTrayBox.y + dragTrayBox.height / 2,
      );
      await mp.mouse.down();
      await mp.mouse.move(
        dragBoardBox.x + dragCell * 7.5,
        dragBoardBox.y + dragCell * 7.5,
        { steps: 8 },
      );
      await mp.mouse.up();
      await mp.waitForTimeout(300);
      check((await countBlocks(mp)) > mobileBeforeDrag, 'arrastar funciona na viewport mobile');
    }

    const touchOverflow = await overflowOf(mp);
    check(touchOverflow <= 1, `sem overflow horizontal jogando no mobile (${touchOverflow}px)`);

    const fits = await mp.evaluate(() => {
      const board = document.querySelector('.board');
      const tray = document.querySelector('.tray');
      if (!board || !tray) return false;
      const boardRect = board.getBoundingClientRect();
      const trayRect = tray.getBoundingClientRect();
      return (
        boardRect.height > 200 &&
        boardRect.bottom <= window.innerHeight + 1 &&
        trayRect.bottom <= window.innerHeight + 1 &&
        trayRect.top >= boardRect.bottom - 2
      );
    });
    check(fits, 'tabuleiro e bandeja cabem na viewport mobile');
    await mp.screenshot({ path: path.join(SHOTS, '06-run-mobile-after.png') });

    // Recompensa no mobile (save manipulado para concluir o estágio)
    await mp.evaluate(() => {
      const raw = localStorage.getItem('blockbound.run.v1');
      if (!raw) return;
      const run = JSON.parse(raw);
      run.stage.objectives = [{ kind: 'score', target: 1, progress: 0 }];
      run.stage.movesLeft = 30;
      run.stage.movesTotal = 30;
      localStorage.setItem('blockbound.run.v1', JSON.stringify(run));
    });
    await mp.reload({ waitUntil: 'networkidle' });
    await mp.getByRole('button', { name: /continuar/i }).click();
    await mp.waitForSelector('.board');
    const mobilePlace = await playTapToPlace(mp, true);
    check(mobilePlace.placed, 'posicionamento por toque após retomar a run');
    await mp.waitForSelector('.reward', { timeout: 6000 });
    await mp.waitForTimeout(900);
    await mp.screenshot({ path: path.join(SHOTS, '15-reward-mobile.png') });
    await mp.locator('.relic-card').first().click();
    await mp.waitForSelector('.board', { timeout: 8000 });
    await mp.waitForTimeout(500);
    check(
      (await mp.locator('.relic-rail__item').count()) >= 1,
      'relíquia escolhida entra na run no mobile',
    );

    await mp.getByRole('button', { name: /pausar/i }).click();
    await mp.waitForSelector('.modal');
    await mp.getByRole('button', { name: /abandonar/i }).click();
    await mp.getByRole('button', { name: /confirmar abandono/i }).click();
    await mp.waitForSelector('.result', { timeout: 5000 });
    check((await mp.locator('.result').count()) === 1, 'tela de resultado aparece após abandono');
    check(
      (await mp.locator('.result__crystals').count()) === 1,
      'resultado mostra cristais ganhos',
    );
    await mp.waitForTimeout(900);
    await mp.screenshot({ path: path.join(SHOTS, '07-result-mobile.png') });

    await mp.getByRole('button', { name: /coleção/i }).click();
    await mp.waitForSelector('.collection');
    check((await mp.locator('.collection-card').count()) > 10, 'coleção lista relíquias');
    await mp.evaluate(() => window.scrollTo(0, 0));
    await mp.waitForTimeout(700);
    await mp.screenshot({ path: path.join(SHOTS, '08-collection-mobile.png') });

    await mp.getByRole('button', { name: /voltar/i }).click();
    await mp.waitForSelector('.menu');
    await mp.getByRole('button', { name: /conquistas/i }).click();
    await mp.waitForSelector('.achievements');
    check((await mp.locator('.achievement').count()) >= 10, 'conquistas listadas');
    await mp.waitForTimeout(600);
    await mp.screenshot({ path: path.join(SHOTS, '09-achievements-mobile.png') });

    await mp.getByRole('button', { name: /voltar/i }).click();
    await mp.waitForSelector('.menu');
    await mp.getByRole('button', { name: /estatísticas/i }).click();
    await mp.waitForSelector('.stats-screen');
    check((await mp.locator('.stat-tile').count()) >= 10, 'estatísticas listadas');
    await mp.waitForTimeout(600);
    await mp.screenshot({ path: path.join(SHOTS, '10-stats-mobile.png') });
    await mobile.close();

    // ---------- TABLET ----------
    console.log('\n[tablet 820x1180]');
    const tablet = await browser.newContext({
      viewport: { width: 820, height: 1180 },
      hasTouch: true,
    });
    const tp = await tablet.newPage();
    tp.on('pageerror', (error) => consoleErrors.push(`tablet pageerror: ${error.message}`));
    await tp.goto(BASE, { waitUntil: 'networkidle' });
    await tp.getByRole('button', { name: /^jogar$/i }).first().click();
    await tp.waitForSelector('.board');
    await tp.waitForTimeout(340);
    await tp.screenshot({ path: path.join(SHOTS, '11-run-tablet.png') });
    const tabletFits = await tp.evaluate(() => {
      const board = document.querySelector('.board');
      if (!board) return false;
      const rect = board.getBoundingClientRect();
      return rect.height > 260 && rect.bottom <= window.innerHeight + 1;
    });
    check(tabletFits, 'tabuleiro visível sem corte no tablet');
    await tablet.close();

    // ---------- CELULAR NA HORIZONTAL ----------
    console.log('\n[landscape 844x390]');
    const land = await browser.newContext({
      viewport: { width: 844, height: 390 },
      isMobile: true,
      hasTouch: true,
    });
    const lp = await land.newPage();
    lp.on('pageerror', (error) => consoleErrors.push(`landscape pageerror: ${error.message}`));
    await lp.goto(BASE, { waitUntil: 'networkidle' });
    await lp.getByRole('button', { name: /^jogar$/i }).first().click();
    await lp.waitForSelector('.board');
    await lp.waitForTimeout(340);
    const landOverflow = await overflowOf(lp);
    check(landOverflow <= 1, `sem overflow horizontal na horizontal (${landOverflow}px)`);
    const landFits = await lp.evaluate(() => {
      const board = document.querySelector('.board');
      const tray = document.querySelector('.tray');
      if (!board || !tray) return false;
      const b = board.getBoundingClientRect();
      const t = tray.getBoundingClientRect();
      return (
        b.width > 160 &&
        b.height > 160 &&
        b.bottom <= window.innerHeight + 1 &&
        t.bottom <= window.innerHeight + 1
      );
    });
    check(landFits, 'layout horizontal cabe sem cortes');
    await lp.screenshot({ path: path.join(SHOTS, '16-run-landscape.png') });
    await land.close();
  } finally {
    await browser.close();
    stopServer();
  }

  if (consoleErrors.length > 0) {
    console.error('\nErros de console detectados:');
    for (const message of consoleErrors) console.error(` - ${message}`);
    failures.push('erros de console');
  }

  console.log('\n------------------------------');
  if (failures.length > 0) {
    console.error(`FALHOU: ${failures.length} verificação(ões).`);
    process.exit(1);
  }
  console.log('SMOKE TEST OK — screenshots em ./screenshots');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
