import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CollectionsCase, Contract, GPSDevice, Vehicle } from "../entities/types";
import styles from "./MapPanel.module.css";

type MapPanelProps = {
  vehicles: Vehicle[];
  gpsDevices: GPSDevice[];
  contracts: Array<Contract & { client?: string }>;
  cases: CollectionsCase[];
  onPick: (vehicleId: string) => void;
};

const markerColors = {
  online: "#2dd4bf",
  warning: "#facc15",
  armed: "#ff4d4d"
};

type MarkerState = "ONLINE" | "COLLECTION_RISK" | "IMMOBILIZER_ARMED";

function getMarkerState({
  contract,
  gpsDevice,
  collectionsCase
}: {
  contract: (Contract & { client?: string }) | undefined;
  gpsDevice: GPSDevice;
  collectionsCase: CollectionsCase | undefined;
}): MarkerState {
  if (gpsDevice.status === "IMMOBILIZER_ARMED") return "IMMOBILIZER_ARMED";
  const hasCollectionRisk =
    contract?.status === "OVERDUE" ||
    Boolean(collectionsCase && collectionsCase.status !== "CLOSED" && collectionsCase.status !== "CURED") ||
    ["SEND_REMINDER", "CALL_ATTEMPT", "ARM_IMMOBILIZER"].includes(collectionsCase?.next_action_type ?? "");
  if (hasCollectionRisk) return "COLLECTION_RISK";
  return "ONLINE";
}

function markerColor(state: MarkerState) {
  if (state === "IMMOBILIZER_ARMED") return markerColors.armed;
  if (state === "COLLECTION_RISK") return markerColors.warning;
  return markerColors.online;
}

function markerClassName(state: MarkerState) {
  if (state === "IMMOBILIZER_ARMED") return styles.markerRed;
  if (state === "COLLECTION_RISK") return styles.markerYellow;
  return styles.markerGreen;
}

function markerTooltip(vehicle: Vehicle, gps: GPSDevice, contract: (Contract & { client?: string }) | undefined, collectionsCase: CollectionsCase | undefined, state: MarkerState) {
  return [
    `<strong>${vehicle.contract_id}</strong>`,
    `Client: ${contract?.client ?? "-"}`,
    `Contract: ${contract?.status ?? "-"}`,
    `Case: ${collectionsCase ? `${collectionsCase.id} / ${collectionsCase.status}` : "-"}`,
    `GPS: ${gps.status}`,
    `Display state: ${state}`
  ].join("<br />");
}

export default function MapPanel({ vehicles, gpsDevices, contracts, cases, onPick }: MapPanelProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  useEffect(() => {
    if (!host.current) return;
    if (!mapRef.current) {
      mapRef.current = L.map(host.current).setView([11.5564, 104.9282], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "" }).addTo(mapRef.current);
    }
    const group = L.layerGroup().addTo(mapRef.current);
    vehicles.forEach((vehicle) => {
      const gps = gpsDevices.find((item) => item.vehicle_id === vehicle.id);
      if (!gps) return;
      const contract = contracts.find((item) => item.id === vehicle.contract_id);
      const collectionsCase = cases.find((item) => item.contract_id === vehicle.contract_id && item.status !== "CLOSED" && item.status !== "CURED");
      const state = getMarkerState({ contract, gpsDevice: gps, collectionsCase });
      const color = markerColor(state);
      const marker = L.circleMarker([gps.last_position.lat, gps.last_position.lng], {
        radius: state === "ONLINE" ? 8 : 12,
        color,
        fillColor: color,
        fillOpacity: 0.96,
        weight: state === "ONLINE" ? 3 : 5,
        opacity: 1,
        className: markerClassName(state)
      })
        .bindTooltip(markerTooltip(vehicle, gps, contract, collectionsCase, state))
        .bindPopup(markerTooltip(vehicle, gps, contract, collectionsCase, state))
        .on("click", () => onPick(vehicle.id))
        .addTo(group);
      if (state !== "ONLINE") marker.bringToFront();
    });
    return () => {
      group.remove();
    };
  }, [cases, contracts, gpsDevices, onPick, vehicles]);
  return (
    <div className={styles.frame}>
      <div className={styles.map} ref={host} />
      <div className={styles.legend} aria-label="GPS risk legend">
        <span><i style={{ background: markerColors.online }} />online</span>
        <span><i style={{ background: markerColors.warning }} />collection risk</span>
        <span><i style={{ background: markerColors.armed }} />immobilizer armed</span>
      </div>
    </div>
  );
}
