export interface MiniGameViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface MiniGameSafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface MiniGameViewportTransform {
  readonly scale: number;
  readonly x: number;
  readonly y: number;
}

export const NO_SAFE_AREA: MiniGameSafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function shouldUsePortraitMiniGameLayout(size: MiniGameViewportSize): boolean {
  return size.height > size.width && size.width <= 820;
}

export function fitMiniGameViewport(
  viewport: MiniGameViewportSize,
  logical: MiniGameViewportSize,
  safeArea: MiniGameSafeAreaInsets = NO_SAFE_AREA,
): MiniGameViewportTransform {
  const availableWidth = Math.max(1, viewport.width - safeArea.left - safeArea.right);
  const availableHeight = Math.max(1, viewport.height - safeArea.top - safeArea.bottom);
  const scale = Math.min(availableWidth / logical.width, availableHeight / logical.height);

  return {
    scale,
    x: safeArea.left + (availableWidth - logical.width * scale) / 2,
    y: safeArea.top + (availableHeight - logical.height * scale) / 2,
  };
}

export function canvasPointToMiniGame(
  point: Readonly<{ x: number; y: number }>,
  transform: MiniGameViewportTransform,
): { x: number; y: number } {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}
