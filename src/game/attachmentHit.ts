export interface AttachmentHitArea<T> {
  readonly value: T;
  readonly target: boolean;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: number;
}

export interface AttachmentHitPoint {
  readonly x: number;
  readonly y: number;
}

function containsPoint<T>(area: AttachmentHitArea<T>, point: AttachmentHitPoint): boolean {
  const dx = point.x - area.x;
  const dy = point.y - area.y;
  const cosine = Math.cos(area.rotation);
  const sine = Math.sin(area.rotation);
  const localX = dx * cosine + dy * sine;
  const localY = -dx * sine + dy * cosine;
  return Math.abs(localX) <= area.width / 2 && Math.abs(localY) <= area.height / 2;
}

function squaredDistance<T>(area: AttachmentHitArea<T>, point: AttachmentHitPoint): number {
  return (point.x - area.x) ** 2 + (point.y - area.y) ** 2;
}

/**
 * Resolve a click against moving file windows. During a shuffle their large
 * rectangles overlap, so the requested attachment wins any ambiguous overlap;
 * otherwise the closest visible window wins.
 */
export function resolveAttachmentHit<T>(
  areas: readonly AttachmentHitArea<T>[],
  point: AttachmentHitPoint,
): T | undefined {
  const matches = areas.filter((area) => containsPoint(area, point));
  const selected = matches.find((area) => area.target)
    ?? matches.reduce<AttachmentHitArea<T> | undefined>((closest, area) => (
      !closest || squaredDistance(area, point) < squaredDistance(closest, point) ? area : closest
    ), undefined);
  return selected?.value;
}
