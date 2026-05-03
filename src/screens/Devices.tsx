import { useEffect, useState } from "react";
import DataTable from "../components/DataTable";
import Drawer from "../components/Drawer";
import StatusBadge from "../components/StatusBadge";
import { api, useApiData, type DeviceDetailResponse, type DeviceManagementRow } from "../services/api";
import { formatDate } from "../lib/formatDate";

export default function Devices() {
  const { data } = useApiData(api.getDevices);
  const devices = data?.devices ?? [];
  const [selected, setSelected] = useState<DeviceManagementRow | null>(null);
  const [detail, setDetail] = useState<DeviceDetailResponse | null>(null);

  useEffect(() => {
    let alive = true;
    if (!selected) {
      setDetail(null);
      return () => {
        alive = false;
      };
    }
    api.getDevice(selected.device_id).then((next) => {
      if (alive) setDetail(next);
    });
    return () => {
      alive = false;
    };
  }, [selected]);

  const selectedDevice = detail?.device ?? selected;
  const commandHistory = detail?.command_history ?? [];

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Devices</h1>
          <p className="screen-muted">Read-only GPS device visibility and command history</p>
        </div>
      </div>

      <DataTable
        rows={devices}
        rowKey={(row) => row.device_id}
        onRowClick={(row) => setSelected(row)}
        searchKey={(row) => `${row.device_id} ${row.vehicle_id} ${row.contract_id} ${row.client_name} ${row.imei} ${row.sim} ${row.provider} ${row.computed_device_status}`}
        columns={[
          { key: "device_id", header: "Device ID" },
          { key: "vehicle_id", header: "Vehicle" },
          { key: "contract_id", header: "Contract" },
          { key: "client_name", header: "Client" },
          { key: "imei", header: "IMEI", render: (row) => row.imei || "-" },
          { key: "sim", header: "SIM", render: (row) => row.sim || "-" },
          { key: "provider", header: "Provider", render: (row) => row.provider || "-" },
          { key: "computed_device_status", header: "Status", render: (row) => <StatusBadge status={row.computed_device_status} /> },
          { key: "latest_acknowledged_command_type", header: "Last command", render: (row) => row.latest_acknowledged_command_type || "-" },
          { key: "last_seen_at", header: "Last seen", render: (row) => formatDate(row.last_seen_at) },
          { key: "battery", header: "Battery", render: (row) => `${row.battery}%`, sortValue: (row) => row.battery },
          { key: "ignition", header: "Ignition" },
          {
            key: "can_send_command",
            header: "Safety",
            render: (row) => row.can_send_command ? <StatusBadge status="ONLINE" /> : <StatusBadge status="WARNING" />
          }
        ]}
      />

      {selectedDevice ? (
        <Drawer title={`Device · ${selectedDevice.device_id}`} onClose={() => setSelected(null)}>
          <section className="screen-panel">
            <h2>Device Identity</h2>
            <div className="screen-grid">
              <div><strong>IMEI</strong><p>{selectedDevice.imei || "-"}</p></div>
              <div><strong>SIM</strong><p>{selectedDevice.sim || "-"}</p></div>
              <div><strong>Provider</strong><p>{selectedDevice.provider || "-"}</p></div>
              <div><strong>Safety</strong><p>{selectedDevice.missing_identity_reason || "Ready"}</p></div>
            </div>
          </section>

          <section className="screen-panel">
            <h2>Linked Asset</h2>
            <div className="screen-grid">
              <div><strong>Vehicle ID</strong><p>{selectedDevice.vehicle_id}</p></div>
              <div><strong>Contract ID</strong><p>{selectedDevice.contract_id}</p></div>
              <div><strong>Client name</strong><p>{selectedDevice.client_name}</p></div>
            </div>
          </section>

          <section className="screen-panel">
            <h2>Current State</h2>
            <div className="screen-grid">
              <div><strong>Computed status</strong><p><StatusBadge status={selectedDevice.computed_device_status} /></p></div>
              <div><strong>Last acknowledged command</strong><p>{selectedDevice.latest_acknowledged_command_type || "-"}</p></div>
              <div><strong>Last seen</strong><p>{formatDate(selectedDevice.last_seen_at)}</p></div>
              <div><strong>Battery</strong><p>{selectedDevice.battery}%</p></div>
              <div><strong>Ignition</strong><p>{selectedDevice.ignition}</p></div>
              {selectedDevice.device_health_alert ? <div><strong>Health alert</strong><p><StatusBadge status={selectedDevice.device_health_alert} /></p></div> : null}
            </div>
          </section>

          <section className="screen-panel">
            <h2>Command History</h2>
            <DataTable
              rows={commandHistory}
              rowKey={(row) => row.id}
              columns={[
                { key: "command_type", header: "Command type" },
                { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
                { key: "requested_by", header: "Requested by", render: (row) => row.requested_by || "-" },
                { key: "approved_by", header: "Approved by", render: (row) => row.approved_by || "-" },
                { key: "provider_response", header: "Provider response", render: (row) => row.provider_response || "-" },
                { key: "created_at", header: "Created at", render: (row) => formatDate(row.created_at) },
                { key: "executed_at", header: "Executed at", render: (row) => formatDate(row.executed_at) }
              ]}
            />
          </section>
        </Drawer>
      ) : null}
    </div>
  );
}
