import { naturalCompare } from "./format";

export const FLOOR_PLAN_STAGE_WIDTH = 960;
export const FLOOR_PLAN_STAGE_HEIGHT = 560;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function fallbackLayout(index) {
  const columns = 5;
  const width = 92;
  const height = 68;
  const gutterX = 34;
  const gutterY = 26;
  const startX = 28;
  const startY = 24;
  const column = index % columns;
  const row = Math.floor(index / columns);

  return {
    x: startX + column * (width + gutterX),
    y: startY + row * (height + gutterY),
    width,
    height,
    rotation: 0,
    shape: "RECT"
  };
}

export function resolveTableLayout(table, index = 0) {
  const fallback = fallbackLayout(index);
  const width = clamp(Number(table.layoutWidth || fallback.width), 56, 180);
  const height = clamp(Number(table.layoutHeight || fallback.height), 48, 180);
  const x = clamp(
    Number(table.layoutX ?? fallback.x),
    0,
    FLOOR_PLAN_STAGE_WIDTH - width
  );
  const y = clamp(
    Number(table.layoutY ?? fallback.y),
    0,
    FLOOR_PLAN_STAGE_HEIGHT - height
  );

  return {
    x,
    y,
    width,
    height,
    rotation: Number(table.layoutRotation || 0),
    shape: table.layoutShape || fallback.shape
  };
}

export function buildFloorPlanZones(location) {
  const orderedZones = [...(location.zones || [])].sort(
    (left, right) =>
      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || naturalCompare(left.name, right.name)
  );
  const groups = new Map(
    orderedZones.map((zone) => [
      zone.id,
      {
        id: zone.id,
        name: zone.name,
        active: zone.active !== false,
        sortOrder: zone.sortOrder ?? 0,
        tables: []
      }
    ])
  );

  const fallbackZoneId = "unassigned";

  for (const table of location.tables || []) {
    const zoneId = table.zoneId || fallbackZoneId;

    if (!groups.has(zoneId)) {
      groups.set(zoneId, {
        id: zoneId,
        name: table.zoneRecord?.name || table.zone || "Senza zona",
        active: true,
        sortOrder: Number.MAX_SAFE_INTEGER,
        tables: []
      });
    }

    groups.get(zoneId).tables.push(table);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      tables: [...group.tables].sort((left, right) => naturalCompare(left.code, right.code))
    }))
    .sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || naturalCompare(left.name, right.name)
    );
}
