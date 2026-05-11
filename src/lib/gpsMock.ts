import { KT2116_ROUTE } from "./kt2116Route";
import roadGraph from "./demoRoadGraph.json";


export type Vehicle = {
  id: string;
  contract_id: string;
  client?: string;
  plate: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  status: "ONLINE" | "OVERDUE_WATCH" | "COLLECTION_RISK" | "IMMOBILIZER_ARMED";
};

type RoadPoint = { lat: number; lng: number };
type RoadSegment = { id?: number; name?: string; points: RoadPoint[] };
type RoadCursor = {
  segmentIndex: number;
  pointIndex: number;
  direction: 1 | -1;
};

const roadCursorsByContract = new Map<string, RoadCursor>();
const kt2116Cursor = new Map<string, { pointIndex: number }>();

function segmentLength(segment: RoadSegment) {
  let total = 0;
  for (let i = 1; i < segment.points.length; i += 1) {
    total += distanceBetween(segment.points[i - 1], segment.points[i]);
  }
  return total;
}

const ROAD_SEGMENTS: RoadSegment[] = ((roadGraph as any).segments || [])
  .filter((s: RoadSegment) => Array.isArray(s.points) && s.points.length >= 4)
  .filter((s: RoadSegment) => segmentLength(s) > 0.0035);

function safeSegmentIndex(seed: string) {
  if (!ROAD_SEGMENTS.length) return 0;
  return hash(seed) % ROAD_SEGMENTS.length;
}

function initialRoadCursor(contractId: string): RoadCursor {
  const segmentIndex = safeSegmentIndex(contractId);
  const segment = ROAD_SEGMENTS[segmentIndex];
  const maxStart = Math.max(0, segment.points.length - 2);
  const pointIndex = maxStart ? hash(contractId + "-road-start") % maxStart : 0;
  const direction = hash(contractId + "-road-dir") % 2 === 0 ? 1 : -1;
  return { segmentIndex, pointIndex, direction };
}

function pointForCursor(cursor: RoadCursor): RoadPoint {
  const segment = ROAD_SEGMENTS[cursor.segmentIndex];
  return segment.points[Math.max(0, Math.min(segment.points.length - 1, cursor.pointIndex))];
}

function distanceBetween(a: RoadPoint, b: RoadPoint) {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

function findConnectedCursor(contractId: string, fromPoint: RoadPoint, currentSegmentIndex: number): RoadCursor | null {
  const candidates: RoadCursor[] = [];
  const threshold = 0.00028;

  ROAD_SEGMENTS.forEach((segment, segmentIndex) => {
    if (segmentIndex === currentSegmentIndex || segment.points.length < 2) return;

    const first = segment.points[0];
    const last = segment.points[segment.points.length - 1];

    if (distanceBetween(fromPoint, first) < threshold) {
      candidates.push({ segmentIndex, pointIndex: 1, direction: 1 });
    }

    if (distanceBetween(fromPoint, last) < threshold) {
      candidates.push({ segmentIndex, pointIndex: segment.points.length - 2, direction: -1 });
    }
  });

  if (!candidates.length) return null;

  return candidates[hash(contractId + "-turn-" + currentSegmentIndex + "-" + Math.round(fromPoint.lat * 100000)) % candidates.length];
}

function advanceCursor(contractId: string, cursor: RoadCursor): RoadCursor {
  const currentSegment = ROAD_SEGMENTS[cursor.segmentIndex];
  const nextIndex = cursor.pointIndex + cursor.direction;

  if (nextIndex >= 0 && nextIndex < currentSegment.points.length) {
    return { ...cursor, pointIndex: nextIndex };
  }

  const endPoint = currentSegment.points[Math.max(0, Math.min(currentSegment.points.length - 1, cursor.pointIndex))];
  const connected = findConnectedCursor(contractId, endPoint, cursor.segmentIndex);

  if (connected) {
    return connected;
  }

  const reversedDirection = cursor.direction === 1 ? -1 : 1;
  const reversedIndex = cursor.pointIndex + reversedDirection;

  return {
    ...cursor,
    direction: reversedDirection,
    pointIndex: Math.max(0, Math.min(currentSegment.points.length - 1, reversedIndex))
  };
}


const CENTER = { lat: 11.5564, lng: 104.8900 };

// Demo road routes inside safe Phnom Penh dry zone.
// Vehicles will travel waypoint-to-waypoint instead of random drifting.
const DEMO_ROUTES = [
  [{ lat: 11.5486, lng: 104.8952 }, { lat: 11.5486, lng: 104.9020 }, { lat: 11.5486, lng: 104.9090 }, { lat: 11.5535, lng: 104.9090 }, { lat: 11.5585, lng: 104.9090 }, { lat: 11.5585, lng: 104.9145 }, { lat: 11.5535, lng: 104.9145 }, { lat: 11.5486, lng: 104.9145 }],
  [{ lat: 11.5405, lng: 104.8980 }, { lat: 11.5450, lng: 104.8980 }, { lat: 11.5500, lng: 104.8980 }, { lat: 11.5550, lng: 104.8980 }, { lat: 11.5550, lng: 104.9045 }, { lat: 11.5550, lng: 104.9110 }, { lat: 11.5500, lng: 104.9110 }, { lat: 11.5450, lng: 104.9110 }, { lat: 11.5405, lng: 104.9110 }],
  [{ lat: 11.5630, lng: 104.9000 }, { lat: 11.5630, lng: 104.9060 }, { lat: 11.5630, lng: 104.9120 }, { lat: 11.5680, lng: 104.9120 }, { lat: 11.5725, lng: 104.9120 }, { lat: 11.5725, lng: 104.9060 }, { lat: 11.5680, lng: 104.9060 }, { lat: 11.5630, lng: 104.9060 }],
  [{ lat: 11.5368, lng: 104.9040 }, { lat: 11.5420, lng: 104.9040 }, { lat: 11.5470, lng: 104.9040 }, { lat: 11.5520, lng: 104.9040 }, { lat: 11.5520, lng: 104.9100 }, { lat: 11.5470, lng: 104.9100 }, { lat: 11.5420, lng: 104.9100 }, { lat: 11.5368, lng: 104.9100 }],
  [{ lat: 11.5600, lng: 104.8925 }, { lat: 11.5600, lng: 104.8985 }, { lat: 11.5650, lng: 104.8985 }, { lat: 11.5700, lng: 104.8985 }, { lat: 11.5700, lng: 104.9045 }, { lat: 11.5650, lng: 104.9045 }, { lat: 11.5600, lng: 104.9045 }],
  [{ lat: 11.5440, lng: 104.8920 }, { lat: 11.5490, lng: 104.8920 }, { lat: 11.5540, lng: 104.8920 }, { lat: 11.5540, lng: 104.8980 }, { lat: 11.5490, lng: 104.8980 }, { lat: 11.5440, lng: 104.8980 }],
  [{ lat: 11.5365, lng: 104.8950 }, { lat: 11.5415, lng: 104.8950 }, { lat: 11.5465, lng: 104.8950 }, { lat: 11.5465, lng: 104.9010 }, { lat: 11.5415, lng: 104.9010 }, { lat: 11.5365, lng: 104.9010 }],
  [{ lat: 11.5570, lng: 104.9065 }, { lat: 11.5620, lng: 104.9065 }, { lat: 11.5670, lng: 104.9065 }, { lat: 11.5670, lng: 104.9130 }, { lat: 11.5620, lng: 104.9130 }, { lat: 11.5570, lng: 104.9130 }]
];


// Phnom Penh dry demo bounds: keep mock vehicles away from Tonle Sap / Mekong river.
const DRY_BOUNDS = {
  minLat: 11.5200,
  maxLat: 11.6000,
  minLng: 104.8500,
  maxLng: 104.9185
};

function isDemoContract(contractId: string) {
  return String(contractId || "").includes("2116");
}

function headingBetween(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const dLng = toLng - fromLng;
  const dLat = toLat - fromLat;
  const radians = Math.atan2(dLng, dLat);
  const degrees = radians * (180 / Math.PI);
  return degrees;
}

function clampToDryBounds(lat: number, lng: number) {
  return {
    lat: Math.min(DRY_BOUNDS.maxLat, Math.max(DRY_BOUNDS.minLat, lat)),
    lng: Math.min(DRY_BOUNDS.maxLng, Math.max(DRY_BOUNDS.minLng, lng))
  };
}

let vehicles: Vehicle[] = [];
let loaded = false;
const routeCursorByContract = new Map<string, number>();
const demoSafeStoppedContracts = new Set<string>();

export function markContractSafeStopped(contractId: string) {
  demoSafeStoppedContracts.add(String(contractId));
}

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function offset(seed: string, scale: number) {
  return ((hash(seed) % 2000) / 1000 - 1) * scale;
}

function statusFrom(contract: any, kase: any, gps: any): Vehicle["status"] {
  const deviceStatus = gps?.gps_status || gps?.status;
  const lastCommand = String(gps?.last_command || "").toUpperCase();
  const lastCommandStatus = String(gps?.last_command_status || "").toUpperCase();
  const commandIsInFlight = ["REQUESTED", "APPROVED", "SENT"].includes(lastCommandStatus);

  if (lastCommand === "IMMOBILIZE" && lastCommandStatus === "ACKNOWLEDGED") return "IMMOBILIZER_ARMED";
  if (deviceStatus === "IMMOBILIZER_ARMED" && !commandIsInFlight) return "IMMOBILIZER_ARMED";

  if (kase?.status === "CURED" || kase?.status === "CLOSED") return "ONLINE";
  if (contract?.status === "OVERDUE" || contract?.status === "DELINQUENT") return "COLLECTION_RISK";
  if (kase?.status === "OPEN" || kase?.status === "APPROVED") return "COLLECTION_RISK";

  return "ONLINE";
}

async function syncFromApi() {
  const res = await fetch("http://127.0.0.1:4000/gps-live-state", {
    credentials: "include"
  });

  if (!res.ok) return;

  const data = await res.json();

  const contracts = data.contracts || [];
  const cases = data.cases || [];
  const gpsVehicles = data.vehicles || [];

  const previousByContract = new Map(vehicles.map((v) => [String(v.contract_id), v]));

  vehicles = contracts.map((contract: any, index: number) => {
    const contractId = String(contract.id || contract.contract_id);
    const old = previousByContract.get(contractId);
    const gps = gpsVehicles.find((v: any) => String(v.contract_id) === contractId);
    const kase = cases.find((c: any) => String(c.contract_id) === contractId);

    const status = statusFrom(contract, kase, gps);
    const isArmed = status === "IMMOBILIZER_ARMED";
    const isSafeStopped = demoSafeStoppedContracts.has(contractId);

    return {
      id: String(gps?.id || gps?.vehicle_id || contract.vehicle_id || old?.id || `VEH-${contractId}`),
      contract_id: contractId,
      client: contract.client || contract.client_name || old?.client || `Client ${contractId.replace(/\D/g, "")}`,
      plate: String(gps?.plate || contract.plate || old?.plate || `2AB-${contractId.replace(/\D/g, "")}`),
      ...(() => {
        if (!roadCursorsByContract.has(contractId)) {
          roadCursorsByContract.set(contractId, initialRoadCursor(contractId));
        }
        if (isDemoContract(contractId)) {
          const start = KT2116_ROUTE[0];
          if (!kt2116Cursor.has(contractId)) {
            kt2116Cursor.set(contractId, { pointIndex: 1 });
          }
          return clampToDryBounds(old?.lat ?? start.lat, old?.lng ?? start.lng);
        }

        const cursor = roadCursorsByContract.get(contractId)!;
        const start = pointForCursor(cursor);
        return clampToDryBounds(old?.lat ?? start.lat, old?.lng ?? start.lng);
      })(),
      speed: isArmed || isSafeStopped ? 0 : isDemoContract(contractId) ? 50 : status === "COLLECTION_RISK" ? 24 : 45,
      heading: old?.heading ?? 0,
      status: isArmed ? "IMMOBILIZER_ARMED" : status
    };
  });

  loaded = true;
}

function move() {
  vehicles = vehicles.map((v) => {
    if (v.status === "IMMOBILIZER_ARMED") {
      return { ...v, status: "IMMOBILIZER_ARMED", speed: 0 };
    }
    if (demoSafeStoppedContracts.has(v.contract_id)) {
      return { ...v, speed: 0 };
    }

    let next;

    if (isDemoContract(v.contract_id)) {
      if (!kt2116Cursor.has(v.contract_id)) {
        kt2116Cursor.set(v.contract_id, { pointIndex: 1 });
      }

      const cinematic = kt2116Cursor.get(v.contract_id)!;
      const target = KT2116_ROUTE[Math.min(cinematic.pointIndex, KT2116_ROUTE.length - 1)];
      const step = 0.000085;

      const dLatToTarget = target.lat - v.lat;
      const dLngToTarget = target.lng - v.lng;
      const distance = Math.sqrt(dLatToTarget * dLatToTarget + dLngToTarget * dLngToTarget);

      if (distance < step) {
        cinematic.pointIndex += 1;

        if (cinematic.pointIndex >= KT2116_ROUTE.length) {
          cinematic.pointIndex = 1;
          next = clampToDryBounds(KT2116_ROUTE[0].lat, KT2116_ROUTE[0].lng);
        } else {
          const nextTarget = KT2116_ROUTE[cinematic.pointIndex];
          next = clampToDryBounds(nextTarget.lat, nextTarget.lng);
        }
      } else {
        next = clampToDryBounds(
          v.lat + (dLatToTarget / distance) * step,
          v.lng + (dLngToTarget / distance) * step
        );
      }
    } else {
      if (!roadCursorsByContract.has(v.contract_id)) {
        roadCursorsByContract.set(v.contract_id, initialRoadCursor(v.contract_id));
      }

      let cursor = roadCursorsByContract.get(v.contract_id)!;
      let target = pointForCursor(cursor);

      const step = v.status === "COLLECTION_RISK" ? 0.000009 : 0.000012;
      const dLatToTarget = target.lat - v.lat;
      const dLngToTarget = target.lng - v.lng;
      const distance = Math.sqrt(dLatToTarget * dLatToTarget + dLngToTarget * dLngToTarget);

      if (distance < step) {
        cursor = advanceCursor(v.contract_id, cursor);
        roadCursorsByContract.set(v.contract_id, cursor);
        target = pointForCursor(cursor);
        next = clampToDryBounds(target.lat, target.lng);
      } else {
        next = clampToDryBounds(
          v.lat + (dLatToTarget / distance) * step,
          v.lng + (dLngToTarget / distance) * step
        );
      }
    }

    const moved = Math.abs(next.lat - v.lat) > 0.000001 || Math.abs(next.lng - v.lng) > 0.000001;

    return {
      ...v,
      lat: next.lat,
      lng: next.lng,
      heading: moved ? headingBetween(v.lat, v.lng, next.lat, next.lng) : v.heading,
      speed: isDemoContract(v.contract_id) ? 50 : v.status === "COLLECTION_RISK" ? 24 : 45
    };
  });
}

export function subscribeGPS(callback: (vehicles: Vehicle[]) => void) {
  let stopped = false;

  async function tick() {
    if (stopped) return;

    await syncFromApi();
    if (loaded) {
      move();
      callback([...vehicles]);
    }
  }

  void tick();
  const interval = setInterval(() => void tick(), 250);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
