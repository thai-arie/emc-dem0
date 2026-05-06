import { useEffect, useState } from "react";
import MapPanel from "../components/MapPanel";
import { subscribeGPS } from "../lib/gpsMock";

export default function Gps() {
  const [liveVehicles, setLiveVehicles] = useState<any[]>([]);

  useEffect(() => {
    
    const unsubscribe = subscribeGPS(setLiveVehicles);
    return unsubscribe;
  }, []);

  return (
    <div style={{ height: "100vh", width: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 12, fontSize: 18, fontWeight: 600 }}>
        GPS ({liveVehicles.length})
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <MapPanel vehicles={liveVehicles} />
      </div>
    </div>
  );
}
