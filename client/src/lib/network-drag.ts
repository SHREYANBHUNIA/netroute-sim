export const NETWORK_CANVAS_WIDTH = 1000;
export const NETWORK_CANVAS_HEIGHT = 610;

export type DragCoordinates = { x: number; y: number };

export type NodeDragUpdate = { id: string; x: number; y: number };

export function resolveNodeDrag(nodeId: string | null | undefined, event: DragCoordinates): NodeDragUpdate | null {
  if (!nodeId || !Number.isFinite(event.x) || !Number.isFinite(event.y)) return null;
  return {
    id: nodeId,
    x: Math.max(7, Math.min(93, (event.x / NETWORK_CANVAS_WIDTH) * 100)),
    y: Math.max(11, Math.min(89, (event.y / NETWORK_CANVAS_HEIGHT) * 100)),
  };
}
