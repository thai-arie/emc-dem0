
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
  if (gps?.gps_status === "IMMOBILIZER_ARMED" || gps?.status === "IMMOBILIZER_ARMED") return "IMMOBILIZER_ARMED";
  if (contract?.status === "IMMOBILIZER_ARMED") return "IMMOBILIZER_ARMED";
  if (kase?.gps_status === "IMMOBILIZER_ARMED") return "IMMOBILIZER_ARMED";

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
    const isArmed = status === "IMMOBILIZER_ARMED" || demoSafeStoppedContracts.has(contractId);

    return {
      id: String(gps?.id || gps?.vehicle_id || contract.vehicle_id || old?.id || `VEH-${contractId}`),
      contract_id: contractId,
      client: contract.client || contract.client_name || old?.client || `Client ${contractId.replace(/\D/g, "")}`,
      plate: String(gps?.plate || contract.plate || old?.plate || `2AB-${contractId.replace(/\D/g, "")}`),
      lat: old?.lat ?? CENTER.lat + offset(contractId, 0.035),
      lng: old?.lng ?? CENTER.lng + offset(contractId + "-lng", 0.035),
      speed: isArmed ? 0 : status === "COLLECTION_RISK" ? 12 : 25,
      status: isArmed ? "IMMOBILIZER_ARMED" : status
    };
  });

  loaded = true;
}

function move() {
  vehicles = vehicles.map((v) => {
    if (v.status === "IMMOBILIZER_ARMED" || demoSafeStoppedContracts.has(v.contract_id)) {
      return { ...v, status: "IMMOBILIZER_ARMED", speed: 0 };
    }

    const h = hash(v.id);
    const dLat = (((h % 7) - 3) * 0.00008);
    const dLng = ((((h >> 3) % 7) - 3) * 0.00008);

    return {
      ...v,
      lat: v.lat + dLat,
      lng: v.lng + dLng,
      speed: v.status === "COLLECTION_RISK" ? 12 : 25
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
  const interval = setInterval(() => void tick(), 2000);

  return () => {
    stopped = true;
    clearInterval(interval);
  };
}
