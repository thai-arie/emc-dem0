import { Link, useSearchParams } from "react-router-dom";
import Drawer from "../components/Drawer";
import MapPanel from "../components/MapPanel";
import StatusBadge from "../components/StatusBadge";
import { api, useApiData } from "../services/api";
import { formatDate } from "../lib/formatDate";

export default function Gps() {
  const [params, setParams] = useSearchParams();
  const { data } = useApiData(api.getGps);
  const vehicles = data?.vehicles ?? [];
  const gpsDevices = data?.gpsDevices ?? [];
  const selected = vehicles.find((vehicle) => vehicle.id === params.get("vehicle"));
  const gps = selected ? gpsDevices.find((item) => item.vehicle_id === selected.id) : undefined;
  return (
    <div className="screen">
      <h1 className="screen-title">GPS</h1>
      <MapPanel vehicles={vehicles} gpsDevices={gpsDevices} onPick={(vehicle) => setParams({ vehicle })} />
      {selected && gps ? (
        <Drawer title={selected.id} onClose={() => setParams({})}>
          <p>Plate: {selected.plate}</p>
          <p>Contract: <Link to={`/contracts/${selected.contract_id}`}>{selected.contract_id}</Link></p>
          <p>GPS status: <StatusBadge status={gps.status} /></p>
          <p>Last ping: {formatDate(gps.last_ping_at)}</p>
        </Drawer>
      ) : null}
    </div>
  );
}
