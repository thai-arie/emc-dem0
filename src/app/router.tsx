import { Navigate, createBrowserRouter } from "react-router-dom";
import AppShell from "./layout/AppShell";
import Login from "../screens/Login";
import Overview from "../screens/Overview";
import ContractsList from "../screens/ContractsList";
import VoidedContracts from "../screens/VoidedContracts";
import ContractDetail from "../screens/ContractDetail";
import ClientProfile from "../screens/ClientProfile";
import Payments from "../screens/Payments";
import CollectionsWorkspace from "../screens/CollectionsWorkspace";
import CollectionsCaseDetail from "../screens/CollectionsCaseDetail";
import Gps from "../screens/Gps";
import Devices from "../screens/Devices";
import Notifications from "../screens/Notifications";
import Audit from "../screens/Audit";
import Reporting from "../screens/Reporting";
import Applications from "../screens/finance/Applications";
import VehicleCatalog from "../screens/finance/VehicleCatalog";
import PricingTiers from "../screens/finance/PricingTiers";
import FinancialPartners from "../screens/finance/FinancialPartners";
import InsurancePartners from "../screens/finance/InsurancePartners";
import BankAccounts from "../screens/finance/BankAccounts";

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Overview /> },
      { path: "contracts", element: <ContractsList /> },
      { path: "contracts/void", element: <VoidedContracts /> },
      { path: "contracts/:id", element: <ContractDetail /> },
      { path: "clients/:id", element: <ClientProfile /> },
      { path: "payments", element: <Payments /> },
      { path: "collections", element: <CollectionsWorkspace /> },
      { path: "collections/:id", element: <CollectionsCaseDetail /> },
      { path: "gps", element: <Gps /> },
      { path: "devices", element: <Devices /> },
      { path: "reporting", element: <Reporting /> },
      { path: "finance/applications", element: <Applications /> },
      { path: "finance/vehicle-catalog", element: <VehicleCatalog /> },
      { path: "finance/pricing-tiers", element: <PricingTiers /> },
      { path: "finance/financial-partners", element: <FinancialPartners /> },
      { path: "finance/insurance-partners", element: <InsurancePartners /> },
      { path: "finance/bank-accounts", element: <BankAccounts /> },
      { path: "notifications", element: <Notifications /> },
      { path: "audit", element: <Audit /> }
    ]
  }
]);
