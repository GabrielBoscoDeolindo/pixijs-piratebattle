import type { Vector2 } from './types';

export function circlesOverlap(
  first: Vector2,
  firstRadius: number,
  second: Vector2,
  secondRadius: number,
): boolean {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const combinedRadius = firstRadius + secondRadius;

  return dx * dx + dy * dy < combinedRadius * combinedRadius;
}

export function circleIntersectsPolygon(
  circle: Vector2,
  radius: number,
  polygonPosition: Vector2,
  localPoints: readonly Vector2[],
): boolean {
  if (isPointInsidePolygon(circle, polygonPosition, localPoints)) {
    return true;
  }

  const radiusSquared = radius * radius;

  for (let index = 0; index < localPoints.length; index += 1) {
    const start = localPoints[index];
    const end = localPoints[(index + 1) % localPoints.length];

    if (
      distanceToSegmentSquared(
        circle,
        { x: polygonPosition.x + start.x, y: polygonPosition.y + start.y },
        { x: polygonPosition.x + end.x, y: polygonPosition.y + end.y },
      ) <= radiusSquared
    ) {
      return true;
    }
  }

  return false;
}

export function sweptCircleIntersectsPolygon(
  start: Vector2,
  end: Vector2,
  radius: number,
  polygonPosition: Vector2,
  localPoints: readonly Vector2[],
): boolean {
  if (
    isPointInsidePolygon(start, polygonPosition, localPoints) ||
    isPointInsidePolygon(end, polygonPosition, localPoints)
  ) {
    return true;
  }

  const radiusSquared = radius * radius;

  for (let index = 0; index < localPoints.length; index += 1) {
    const localStart = localPoints[index];
    const localEnd = localPoints[(index + 1) % localPoints.length];
    const edgeStart = {
      x: polygonPosition.x + localStart.x,
      y: polygonPosition.y + localStart.y,
    };
    const edgeEnd = {
      x: polygonPosition.x + localEnd.x,
      y: polygonPosition.y + localEnd.y,
    };

    if (segmentsIntersect(start, end, edgeStart, edgeEnd)) return true;

    const distanceSquared = Math.min(
      distanceToSegmentSquared(start, edgeStart, edgeEnd),
      distanceToSegmentSquared(end, edgeStart, edgeEnd),
      distanceToSegmentSquared(edgeStart, start, end),
      distanceToSegmentSquared(edgeEnd, start, end),
    );

    // A tangent route is safe and lets a hull slide along an island edge.
    // Only an actual overlap of the swept circle blocks the path.
    if (distanceSquared < radiusSquared) return true;
  }

  return false;
}

function isPointInsidePolygon(
  point: Vector2,
  polygonPosition: Vector2,
  localPoints: readonly Vector2[],
): boolean {
  let inside = false;

  for (
    let currentIndex = 0, previousIndex = localPoints.length - 1;
    currentIndex < localPoints.length;
    previousIndex = currentIndex++
  ) {
    const current = localPoints[currentIndex];
    const previous = localPoints[previousIndex];
    const currentX = polygonPosition.x + current.x;
    const currentY = polygonPosition.y + current.y;
    const previousX = polygonPosition.x + previous.x;
    const previousY = polygonPosition.y + previous.y;

    const crossesHorizontalRay =
      currentY > point.y !== previousY > point.y &&
      point.x <
        ((previousX - currentX) * (point.y - currentY)) /
          (previousY - currentY) +
          currentX;

    if (crossesHorizontalRay) inside = !inside;
  }

  return inside;
}

function distanceToSegmentSquared(
  point: Vector2,
  start: Vector2,
  end: Vector2,
): number {
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    return dx * dx + dy * dy;
  }

  const projection = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) /
        segmentLengthSquared,
    ),
  );
  const closestX = start.x + projection * segmentX;
  const closestY = start.y + projection * segmentY;
  const dx = point.x - closestX;
  const dy = point.y - closestY;

  return dx * dx + dy * dy;
}

function segmentsIntersect(
  firstStart: Vector2,
  firstEnd: Vector2,
  secondStart: Vector2,
  secondEnd: Vector2,
): boolean {
  const firstSideStart = cross(firstStart, firstEnd, secondStart);
  const firstSideEnd = cross(firstStart, firstEnd, secondEnd);
  const secondSideStart = cross(secondStart, secondEnd, firstStart);
  const secondSideEnd = cross(secondStart, secondEnd, firstEnd);

  if (
    ((firstSideStart > 0 && firstSideEnd < 0) ||
      (firstSideStart < 0 && firstSideEnd > 0)) &&
    ((secondSideStart > 0 && secondSideEnd < 0) ||
      (secondSideStart < 0 && secondSideEnd > 0))
  ) {
    return true;
  }

  return (
    (firstSideStart === 0 && pointOnSegment(secondStart, firstStart, firstEnd)) ||
    (firstSideEnd === 0 && pointOnSegment(secondEnd, firstStart, firstEnd)) ||
    (secondSideStart === 0 && pointOnSegment(firstStart, secondStart, secondEnd)) ||
    (secondSideEnd === 0 && pointOnSegment(firstEnd, secondStart, secondEnd))
  );
}

function cross(start: Vector2, end: Vector2, point: Vector2): number {
  return (
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x)
  );
}

function pointOnSegment(
  point: Vector2,
  start: Vector2,
  end: Vector2,
): boolean {
  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  );
}
