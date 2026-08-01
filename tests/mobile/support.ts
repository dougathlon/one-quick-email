import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export type MiniGameId =
  | 'calendar-collision'
  | 'reply-all-intercept'
  | 'paper-jam'
  | 'hold-music-hero'
  | 'stamp-of-approval'
  | 'expense-triage'
  | 'quick-question'
  | 'phone-transfer'
  | 'badge-scan'
  | 'attachment-hunt';

export interface BrowserTestState {
  phase: 'title' | 'compose' | 'minigame' | 'inbox' | 'reply' | 'sent';
  draft: string;
  scenarioId: string | null;
  activeMiniGame: MiniGameId | null;
}

interface BrowserTestHooks {
  forceInterruption?: (id?: MiniGameId) => void;
  completeMiniGame?: (outcome?: 'success' | 'timeout') => void;
  setDraft?: (text: string, caret?: number) => void;
  skipInboxDelay?: () => void;
  getState?: () => BrowserTestState;
}

type TestWindow = Window & {
  __ONE_QUICK_EMAIL_TEST__?: BrowserTestHooks;
};

const PROJECT_VIEWPORTS = {
  'iphone-13': { width: 390, height: 844 },
  'compact-phone': { width: 360, height: 800 },
} as const;

export const MINI_GAMES: readonly MiniGameId[] = [
  'calendar-collision',
  'reply-all-intercept',
  'paper-jam',
  'hold-music-hero',
  'stamp-of-approval',
  'expense-triage',
  'quick-question',
  'phone-transfer',
  'badge-scan',
  'attachment-hunt',
];

export const words = (count: number): string => Array.from(
  { length: count },
  (_, index) => `word${index + 1}`,
).join(' ');

export function expectedViewport(testInfo: TestInfo): { width: number; height: number } {
  const viewport = PROJECT_VIEWPORTS[testInfo.project.name as keyof typeof PROJECT_VIEWPORTS];
  if (!viewport) throw new Error(`Unexpected mobile project: ${testInfo.project.name}`);
  return viewport;
}

export async function expectMobileEnvironment(page: Page, testInfo: TestInfo): Promise<void> {
  expect(page.viewportSize()).toEqual(expectedViewport(testInfo));
  const capabilities = await page.evaluate(() => ({
    maxTouchPoints: navigator.maxTouchPoints,
    coarsePointer: matchMedia('(pointer: coarse)').matches,
  }));
  expect(capabilities.maxTouchPoints).toBeGreaterThan(0);
  expect(capabilities.coarsePointer).toBe(true);
}

export async function expectNoDesktopBlocker(page: Page): Promise<void> {
  await expect(page.getByText(/desktop\s+(?:browser\s+)?required|desktop\s+only|use\s+a\s+desktop/i)).toHaveCount(0);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => {
    const visibleContainers = [
      document.querySelector<HTMLElement>('main'),
      document.querySelector<HTMLElement>('.mail-window'),
      document.querySelector<HTMLElement>('.compose-pane'),
      document.querySelector<HTMLElement>('.message-list'),
      document.querySelector<HTMLElement>('.message-window'),
    ].filter((element): element is HTMLElement => Boolean(
      element && getComputedStyle(element).display !== 'none',
    ));

    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      containers: visibleContainers.map((element) => ({
        className: element.className,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    };
  });

  expect(metrics.documentWidth, 'document must not overflow horizontally')
    .toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.bodyWidth, 'body must not overflow horizontally')
    .toBeLessThanOrEqual(metrics.viewportWidth + 1);
  for (const container of metrics.containers) {
    expect(
      container.scrollWidth,
      `${container.className || 'unnamed container'} must not hide horizontal overflow`,
    ).toBeLessThanOrEqual(container.clientWidth + 1);
  }
}

export async function expectInsideViewport(page: Page, locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

export async function touchCenter(page: Page, locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error('Cannot touch an element without a bounding box');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

export async function getTestState(page: Page): Promise<BrowserTestState> {
  return page.evaluate(() => {
    const state = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.getState?.();
    if (!state) throw new Error('Development test state is unavailable');
    return state;
  });
}

export async function setDraft(page: Page, text: string, caret = text.length): Promise<void> {
  await page.evaluate(({ draft, position }) => {
    const setDraftHook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.setDraft;
    if (!setDraftHook) throw new Error('Development setDraft hook is unavailable');
    setDraftHook(draft, position);
  }, { draft: text, position: caret });
}

export async function forceInterruption(page: Page, id: MiniGameId): Promise<void> {
  await page.evaluate((miniGameId) => {
    const forceHook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.forceInterruption;
    if (!forceHook) throw new Error('Development forceInterruption hook is unavailable');
    forceHook(miniGameId);
  }, id);
}

export async function completeMiniGame(page: Page): Promise<void> {
  await page.evaluate(() => {
    const completeHook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.completeMiniGame;
    if (!completeHook) throw new Error('Development completeMiniGame hook is unavailable');
    completeHook('success');
  });
}

export async function skipInboxDelay(page: Page): Promise<void> {
  await page.evaluate(() => {
    const skipHook = (window as TestWindow).__ONE_QUICK_EMAIL_TEST__?.skipInboxDelay;
    if (!skipHook) throw new Error('Development skipInboxDelay hook is unavailable');
    skipHook();
  });
}

export async function captureMobileScreenshot(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  const directory = resolve('artifacts/mobile-qa/screenshots');
  await mkdir(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `${testInfo.project.name}-${label}.png`),
    animations: 'disabled',
  });
}
