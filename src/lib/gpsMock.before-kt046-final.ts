
async function syncArmedStatusesFromBackend(vehicles: any[]) {
  try {
    const res = await fetch("http://127.0.0.1:4000/gps", { credentials: "include" });
    if (!res.ok) return vehicles;

    const data = await res.json();
    const backendVehicles = Array.isArray(data) ? data : (data.vehicles || data.liveVehicles || data.data || []);
    const byContract = new Map<string, any>();
    const byPlate = new Map<string, any>();
    const byGps = new Map<string, any>();

    for (const item of backendVehicles) {
      const contractId = item.contract_id || item.contractId || item.contract;
      const plate = item.plate || item.plate_number || item.license_plate;
      const gpsId = item.gps_id || item.gpsDeviceId || item.device_id || item.id;

      if (contractId) byContract.set(String(contractId), item);
      if (plate) byPlate.set(String(plate), item);
      if (gpsId) byGps.set(String(gpsId), item);
    }

    return vehicles.map((v: any) => {
      const backend =
        byContract.get(String(v.contract_id || v.contractId || v.contract || "")) ||
        byPlate.get(String(v.plate || v.plate_number || v.license_plate || "")) ||
        byGps.get(String(v.gps_id || v.gpsDeviceId || v.device_id || v.id || ""));

      const backendStatus = backend?.status || backend?.gps_status;
      if (backendStatus === "IMMOBILIZER_ARMED") {
        return {
          ...v,
          status: "IMMOBILIZER_ARMED",
          gps_status: "IMMOBILIZER_ARMED",
          speed: 0,
          ignition: false,
          isMoving: false
        };
      }

      return v;
    });
  } catch {
    return vehicles;
  }
}

import { api } from "../services/api";

export type Vehicle = {
  id: string;
  contract_id: string;
  client?: string;
  plate: string;
  lat: number;
  lng: number;
  speed?: number;
  status: "ONLINE" | "OVERDUE_WATCH" | "COLLECTION_RISK" | "IMMOBILIZER_ARMED";
};

const CENTER = { lat: 11.5564, lng: 104.9282 };

let vehicles: Vehicle[] = [];
let loaded = false;
let tick = 0;
const demoSafeStoppedContracts = new Set<string>();

export function markContractSafeStopped(contractId: string) {
  demoSafeStoppedContracts.add(String(contractId));
}

function isDemoSafeStopped(contractId: string) {
  return demoSafeStoppedContracts.has(String(contractId));
}

function isLocalDemoArmed(contractId: string) {
  try {
    return localStorage.getItem(`emc:armed:${contractId}`) === "1";
  } catch {
    return false;
  }
}

const headingById = new Map<string, number>();
const routeState = new Map<string, { routeIndex: number; pointIndex: number }>();

const SAFE_EAST_LNG = 104.9308;

const PHNOM_PENH_ROUTES: Array<Array<[number, number]>> = [
  [[11.5750, 104.9237], [11.5667, 104.9232], [11.5584, 104.9230], [11.5500, 104.9225], [11.5417, 104.9221]],
  [[11.5797, 104.9162], [11.5708, 104.9167], [11.5622, 104.9172], [11.5531, 104.9178], [11.5441, 104.9184]],
  [[11.5482, 104.8958], [11.5488, 104.9060], [11.5494, 104.9165], [11.5501, 104.9270]],
  [[11.5670, 104.8845], [11.5675, 104.8982], [11.5682, 104.9116], [11.5687, 104.9250]],
  [[11.5564, 104.9002], [11.5560, 104.9105], [11.5556, 104.9207], [11.5550, 104.9290]],
  [[11.5290, 104.8898], [11.5352, 104.8940], [11.5418, 104.8987], [11.5481, 104.9045], [11.5542, 104.9108]],
  [[11.5522, 104.9185], [11.5505, 104.9252], [11.5458, 104.9248], [11.5464, 104.9178], [11.5522, 104.9185]],
  [[11.5625, 104.9068], [11.5629, 104.9140], [11.5633, 104.9214], [11.5657, 104.9251], [11.5701, 104.9270]],
  [[11.5865, 104.8955], [11.5820, 104.9028], [11.5772, 104.9102], [11.5728, 104.9169], [11.5680, 104.9232]],
  [[11.5586, 104.9283], [11.5561, 104.9256], [11.5544, 104.9227], [11.5572, 104.9205], [11.5600, 104.9230], [11.5586, 104.9283]],
  [[11.5462, 104.9298], [11.5438, 104.9268], [11.5402, 104.9235], [11.5369, 104.9201], [11.5339, 104.9168]],
  [[11.5355, 104.9040], [11.5410, 104.9095], [11.5462, 104.9148], [11.5515, 104.9201], [11.5570, 104.9250]]
];

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function offset(seed: string, scale: number) {
  return ((hash(seed) % 2000) / 1000 - 1) * scale;
}

function statusFrom(contract: any, kase: any, gps: any): Vehicle["status"] {
  // Correct rule:
  // OPEN = collection risk / warning
  // APPROVED = approved for immobilizer, but NOT immobilized yet
  // IMMOBILIZER_ARMED = actually immobilized / red / stopped
  // SOURCE OF TRUTH: GPS DEVICE
  if (gps?.status === "IMMOBILIZER_ARMED") return "IMMOBILIZER_ARMED";
  if (isLocalDemoArmed(String(contract?.id || contract?.contract_id || ""))) return "IMMOBILIZER_ARMED";
  if (contract?.status === "IMMOBILIZER_ARMED") return "IMMOBILIZER_ARMED";
  if (kase?.status === "APPROVED") return "COLLECTION_RISK";
  if (kase?.status === "OPEN") return "COLLECTION_RISK";
  if (kase?.status === "CURED" || kase?.status === "CLOSED") return "ONLINE";
  if (contract?.status === "OVERDUE" || contract?.status === "DELINQUENT") return "COLLECTION_RISK";

  return "ONLINE";
}

async function syncFromApi() {
  const data = await api.getGps();

  const contracts = data.contracts || [];
  const cases = data.cases || [];
  const gpsVehicles = data.vehicles || [];

  const previousByContract = new Map(vehicles.map((v) => [String(v.contract_id), v]));

  vehicles = contracts.map((contract: any, index: number) => {
    const contractId = String(contract.id || contract.contract_id);
    const old = previousByContract.get(contractId);
    const existingGps: any = gpsVehicles.find((v: any) =>
      String(v.contract_id || v.contractId || "") === contractId ||
      String(v.contract_id || v.contractId || "") === String(contract.id || contract.contract_id || "") ||
      String(v.vehicle_id || v.vehicleId || "") === String(contract.vehicle_id || contract.vehicleId || "") ||
      String(v.plate || v.plate_number || v.license_plate || "") === String(contract.plate || contract.vehicle_plate || "")
    );
    const kase = cases.find((c: any) => String(c.contract_id) === contractId);

    const id = String(
      old?.id ||
      existingGps?.id ||
      contract.vehicle_id ||
      contract.vehicleId ||
      `vehicle-${contractId}`
    );

    let status = statusFrom(contract, kase, existingGps);

    if (contractId === "KT-046") {
      const allObjects = [
        contract,
        kase,
        existingGps,
        ...gpsVehicles
      ].filter(Boolean);

      const armedSeen = allObjects.some((x: any) =>
        x.status === "IMMOBILIZER_ARMED" ||
        x.gps_status === "IMMOBILIZER_ARMED" ||
        x.gpsStatus === "IMMOBILIZER_ARMED" ||
        x.last_command_status === "ACKNOWLEDGED" ||
        x.lastCommandStatus === "ACKNOWLEDGED"
      );

      console.log("[KT-046 GPS DEBUG]", {
        contract,
        kase,
        existingGps,
        gpsVehicles,
        armedSeen,
        statusBefore: status
      });

      if (armedSeen) status = "IMMOBILIZER_ARMED";
    }

    return {
      id,
      contract_id: contractId,
      client: contract.client || contract.client_name || contract.customer_name || old?.client || "-",
      plate: String(existingGps?.plate || contract.plate || contract.vehicle_plate || old?.plate || `DEMO-${index + 1}`),

      // Critical: API is allowed to create initial point only.
      // After that, simulated coordinates must win.
      lat: old?.lat ?? existingGps?.lat ?? CENTER.lat + offset(contractId, 0.04),
      lng: old?.lng ?? existingGps?.lng ?? CENTER.lng + offset(contractId + "-lng", 0.04),

      speed: status === "IMMOBILIZER_ARMED" || isDemoSafeStopped(contractId) ? 0 : status === "COLLECTION_RISK" ? 12 : 25,
      status,
    };
  });

  loaded = true;
}

function moveTowardPoint(lat: number, lng: number, targetLat: number, targetLng: number, step: number) {
  const dLat = targetLat - lat;
  const dLng = targetLng - lng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);

  if (dist <= step) {
    return { lat: targetLat, lng: targetLng, arrived: true };
  }

  return {
    lat: lat + (dLat / dist) * step,
    lng: lng + (dLng / dist) * step,
    arrived: false,
  };
}

function forceMove() {
  tick++;

  vehicles = vehicles.map((v, index) => {
    if (v.status === "IMMOBILIZER_ARMED" || isDemoSafeStopped(v.contract_id)) {
      return { ...v, speed: 0 };
    }

    const routeIndex = Math.abs(hash(v.id)) % PHNOM_PENH_ROUTES.length;
    const route = PHNOM_PENH_ROUTES[routeIndex];

    let state = routeState.get(v.id);
    if (!state) {
      state = {
        routeIndex,
        pointIndex: Math.abs(hash(v.contract_id)) % route.length,
      };

      // Put vehicle directly on its assigned street route the first time.
      const startPoint = route[state.pointIndex];
      v = {
        ...v,
        lat: startPoint[0],
        lng: startPoint[1],
      };

      routeState.set(v.id, state);
    }

    const nextPointIndex = (state.pointIndex + 1) % route.length;
    const target = route[nextPointIndex];

    const step = v.status === "COLLECTION_RISK" ? 0.00035 : 0.00055;
    const moved = moveTowardPoint(v.lat, v.lng, target[0], Math.min(target[1], SAFE_EAST_LNG), step);

    if (moved.lng > SAFE_EAST_LNG) {
      const resetPoint = route[state.pointIndex];
      return {
        ...v,
        lat: resetPoint[0],
        lng: Math.min(resetPoint[1], SAFE_EAST_LNG),
        speed: v.status === "COLLECTION_RISK" ? 12 : 25,
      };
    }

    if (moved.arrived) {
      state.pointIndex = nextPointIndex;
    }

    return {
      ...v,
      lat: moved.lat,
      lng: moved.lng,
      speed: v.status === "COLLECTION_RISK" ? 12 : 25,
    };
  });

  if (tick % 5 === 0) {
    const counts = vehicles.reduce((acc: any, v) => {
      acc[v.status] = (acc[v.status] || 0) + 1;
      return acc;
    }, {});

    console.log("[GPS ROUTE MOVE]", {
      tick,
      total: vehicles.length,
      counts,
      sample: vehicles.slice(0, 3).map((v) => ({
        id: v.id,
        contract_id: v.contract_id,
        status: v.status,
        lat: v.lat,
        lng: v.lng,
        speed: v.speed,
      })),
    });
  }
}
export function subscribeGPS(cb: (v: Vehicle[]) => void) {
  let cancelled = false;

  syncFromApi()
    .then(() => {
      if (!cancelled) cb([...vehicles]);
    })
    .catch((e) => {
      console.error("GPS initial sync failed", e);
    });

  const moveTimer = window.setInterval(async () => {
    if (cancelled || !loaded) return;
    forceMove();
    cb([...vehicles]);
  }, 1000);

  const syncTimer = window.setInterval(async () => {
    if (cancelled) return;

    syncFromApi()
      .then(() => {
        if (!cancelled) cb([...vehicles]);
      })
      .catch((e) => {
        console.error("GPS API sync failed", e);
      });
  }, 10000);

  return () => {
    cancelled = true;
    window.clearInterval(moveTimer);
    window.clearInterval(syncTimer);
  };
}
