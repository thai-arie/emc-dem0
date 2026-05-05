import { Link } from "react-router-dom";
import { api, useApiData } from "../services/api";

export default function VoidedContracts() {
  const { data, error } = useApiData(api.getVoidedContracts);

  if (error) return <div className="screen">Error: {error}</div>;
  if (!data) return <div className="screen">Loading...</div>;

  return (
    <div className="screen">
      <div className="screen-header">
        <div>
          <h1 className="screen-title">Voided contracts</h1>
          <p className="screen-muted">Contracts that were voided and removed from active operations.</p>
        </div>
        <Link className="secondary-button" to="/contracts">
          Back to contracts
        </Link>
      </div>

      <table className="data-table">
        <thead>
          <tr>
            <th>Contract</th>
            <th>Client</th>
            <th>Phone</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {data.contracts.map((contract) => (
            <tr key={contract.id}>
              <td>
                <Link to={`/contracts/${contract.id}`}>{contract.id}</Link>
              </td>
              <td>{contract.client}</td>
              <td>{contract.phone}</td>
              <td>VOID</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
