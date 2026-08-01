import { describe, expect, it } from 'vitest';

import {
  canvasPointToMiniGame,
  fitMiniGameViewport,
  shouldUsePortraitMiniGameLayout,
} from '../../src/phaser/layout';

describe('mini-game responsive layout', () => {
  it('selects the portrait board for phone-shaped viewports only', () => {
    expect(shouldUsePortraitMiniGameLayout({ width: 390, height: 844 })).toBe(true);
    expect(shouldUsePortraitMiniGameLayout({ width: 360, height: 800 })).toBe(true);
    expect(shouldUsePortraitMiniGameLayout({ width: 844, height: 390 })).toBe(false);
    expect(shouldUsePortraitMiniGameLayout({ width: 1440, height: 900 })).toBe(false);
  });

  it('fits a readable 600 by 1200 board at both target phone sizes', () => {
    expect(fitMiniGameViewport(
      { width: 360, height: 800 },
      { width: 600, height: 1200 },
    )).toEqual({ scale: 0.6, x: 0, y: 40 });

    expect(fitMiniGameViewport(
      { width: 390, height: 844 },
      { width: 600, height: 1200 },
    )).toEqual({ scale: 0.65, x: 0, y: 32 });
  });

  it('keeps the fitted board inside safe-area insets', () => {
    expect(fitMiniGameViewport(
      { width: 390, height: 844 },
      { width: 600, height: 1200 },
      { top: 44, right: 10, bottom: 34, left: 10 },
    )).toEqual({ scale: 370 / 600, x: 10, y: 57 });
  });

  it('maps a scaled canvas pointer back to the logical playfield', () => {
    const transform = { scale: 370 / 600, x: 10, y: 57 };
    expect(canvasPointToMiniGame({ x: 195, y: 427 }, transform)).toEqual({ x: 300, y: 600 });
  });
});
