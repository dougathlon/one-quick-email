import { describe, expect, it } from 'vitest';

import { resolveAttachmentHit, type AttachmentHitArea } from '../../src/game/attachmentHit';

const area = (
  value: string,
  target: boolean,
  x: number,
  y: number,
  rotation = 0,
): AttachmentHitArea<string> => ({
  value,
  target,
  x,
  y,
  width: 250,
  height: 190,
  rotation,
});

describe('Attachment Hunt hit resolution', () => {
  it('does not let an overlapping decoy steal a click on the requested file', () => {
    const target = area('requested.pdf', true, 165, 784);
    const closerDecoy = area('nearly_the_same.pdf', false, 165, 846);

    expect(resolveAttachmentHit([closerDecoy, target], { x: 165, y: 824 }))
      .toBe('requested.pdf');
  });

  it('selects the closest decoy when the requested file is not under the pointer', () => {
    const farDecoy = area('far.pdf', false, 165, 680);
    const closeDecoy = area('close.pdf', false, 165, 850);
    const target = area('requested.pdf', true, 435, 410);

    expect(resolveAttachmentHit([farDecoy, closeDecoy, target], { x: 165, y: 825 }))
      .toBe('close.pdf');
  });

  it('honours rotation and returns no selection outside every window', () => {
    const rotated = area('rotated.pdf', false, 300, 500, Math.PI / 4);

    expect(resolveAttachmentHit([rotated], { x: 300, y: 500 })).toBe('rotated.pdf');
    expect(resolveAttachmentHit([rotated], { x: 20, y: 20 })).toBeUndefined();
  });
});
