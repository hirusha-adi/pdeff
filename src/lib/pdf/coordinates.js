export function clamp(value, min, max) {
  if (Number.isNaN(value)) return 0;
  return Math.min(max, Math.max(min, value));
}

export function clientPointToPageUnits(event, element, workspaceBounds) {
  const rect = element.getBoundingClientRect();
  const minX = workspaceBounds.minX;
  const minY = workspaceBounds.minY;
  const maxX = workspaceBounds.minX + workspaceBounds.width;
  const maxY = workspaceBounds.minY + workspaceBounds.height;

  return {
    x: clamp(minX + ((event.clientX - rect.left) / rect.width) * workspaceBounds.width, minX, maxX),
    y: clamp(minY + ((event.clientY - rect.top) / rect.height) * workspaceBounds.height, minY, maxY)
  };
}

export function normalizeRect(start, end, workspaceBounds) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  const minX = workspaceBounds.minX;
  const minY = workspaceBounds.minY;
  const maxX = workspaceBounds.minX + workspaceBounds.width;
  const maxY = workspaceBounds.minY + workspaceBounds.height;

  return {
    x: clamp(x, minX, maxX),
    y: clamp(y, minY, maxY),
    width,
    height
  };
}

export function isUsableRect(rect, minSize = 0.004) {
  return rect.width >= minSize && rect.height >= minSize;
}
