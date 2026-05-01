import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GPSDevice, Vehicle } from "../entities/types";
import styles from "./MapPanel.module.css";

export default function MapPanel({ vehicles, gpsDevices, onPick }: { vehicles: Vehicle[]; gpsDevices: GPSDevice[]; onPick: (vehicleId: string) => void }) {
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
      const color = gps.status === "IMMOBILIZER_ARMED" ? "#d94f54" : "#3fb9a8";
      L.circleMarker([gps.last_position.lat, gps.last_position.lng], { radius: 8, color, fillColor: color, fillOpacity: 0.9 })
        .on("click", () => onPick(vehicle.id))
        .addTo(group);
    });
    return () => {
      group.remove();
    };
  }, [gpsDevices, onPick, vehicles]);
  return <div className={styles.map} ref={host} />;
}
