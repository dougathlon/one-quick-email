export type PhoneConnectorKind = 'straight' | 'corner';

export type PhoneConnectorDirection = 'up' | 'right' | 'down' | 'left';

export interface PhoneConnectorState {
  readonly kind: PhoneConnectorKind;
  readonly rotation: number;
}

export interface PhoneConnectorRoute {
  readonly entry: PhoneConnectorDirection;
  readonly exit: PhoneConnectorDirection;
}

const DIRECTIONS: readonly PhoneConnectorDirection[] = ['up', 'right', 'down', 'left'];

function rotateDirection(
  direction: PhoneConnectorDirection,
  quarterTurns: number,
): PhoneConnectorDirection {
  const start = DIRECTIONS.indexOf(direction);
  const rotated = DIRECTIONS[(start + ((quarterTurns % 4) + 4) % 4) % DIRECTIONS.length];
  if (!rotated) throw new Error('phone connector rotation failed');
  return rotated;
}

export function connectorJoinsRoute(
  connector: PhoneConnectorState,
  route: PhoneConnectorRoute,
): boolean {
  const baseOpenings: readonly PhoneConnectorDirection[] = connector.kind === 'straight'
    ? ['left', 'right']
    : ['right', 'down'];
  const openings = new Set(baseOpenings.map((direction) => rotateDirection(direction, connector.rotation)));
  return openings.has(route.entry) && openings.has(route.exit);
}

export function isPhoneTransferPathComplete(
  connectors: readonly PhoneConnectorState[],
  route: readonly PhoneConnectorRoute[],
): boolean {
  return connectors.length === route.length
    && connectors.every((connector, index) => {
      const segment = route[index];
      return segment !== undefined && connectorJoinsRoute(connector, segment);
    });
}

