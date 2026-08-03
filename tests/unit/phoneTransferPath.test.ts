import { describe, expect, it } from 'vitest';

import {
  connectorJoinsRoute,
  isPhoneTransferPathComplete,
  type PhoneConnectorRoute,
  type PhoneConnectorState,
} from '../../src/game/phoneTransferPath';

const landscapeRoute: readonly PhoneConnectorRoute[] = [
  { entry: 'left', exit: 'right' },
  { entry: 'left', exit: 'down' },
  { entry: 'up', exit: 'down' },
  { entry: 'up', exit: 'right' },
  { entry: 'left', exit: 'right' },
  { entry: 'left', exit: 'right' },
];

const connected: readonly PhoneConnectorState[] = [
  { kind: 'straight', rotation: 0 },
  { kind: 'corner', rotation: 1 },
  { kind: 'straight', rotation: 1 },
  { kind: 'corner', rotation: 3 },
  { kind: 'straight', rotation: 0 },
  { kind: 'straight', rotation: 0 },
];

const portraitRoute: readonly PhoneConnectorRoute[] = [
  ...landscapeRoute.slice(0, 4),
  { entry: 'left', exit: 'down' },
  { entry: 'up', exit: 'down' },
];

const portraitConnected: readonly PhoneConnectorState[] = [
  ...connected.slice(0, 4),
  { kind: 'corner', rotation: 1 },
  { kind: 'straight', rotation: 1 },
];

describe('Phone Transfer path validation', () => {
  it('recognises only openings that join both sides of a route segment', () => {
    expect(connectorJoinsRoute(
      { kind: 'corner', rotation: 1 },
      { entry: 'left', exit: 'down' },
    )).toBe(true);
    expect(connectorJoinsRoute(
      { kind: 'corner', rotation: 0 },
      { entry: 'left', exit: 'down' },
    )).toBe(false);
  });

  it('accepts a connected caller-to-extension path', () => {
    expect(isPhoneTransferPathComplete(connected, landscapeRoute)).toBe(true);
    expect(isPhoneTransferPathComplete(portraitConnected, portraitRoute)).toBe(true);
  });

  it('rejects a route with one disconnected pipe or a missing segment', () => {
    const disconnected = connected.map((connector, index) => (
      index === 5 ? { ...connector, rotation: 1 } : connector
    ));
    expect(isPhoneTransferPathComplete(disconnected, landscapeRoute)).toBe(false);
    expect(isPhoneTransferPathComplete(connected.slice(0, -1), landscapeRoute)).toBe(false);
  });
});
