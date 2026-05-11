import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import DataTable from "../../components/DataTable";
import Drawer from "../../components/Drawer";
import StatusBadge from "../../components/StatusBadge";
import type { Role } from "../../entities/types";
import { formatDate } from "../../lib/formatDate";
import { api, type ManagedUser, type UserPayload, type UserStatus } from "../../services/api";
import { useAuth } from "../../store/auth";
import { useUi } from "../../store/ui";
import financeStyles from "../finance/FinanceReference.module.css";

const roles: Role[] = ["ADMIN", "SALES", "FINANCE", "COLLECTIONS_AGENT", "OPS", "CONTROLLER", "VIEWER"];
const statuses: UserStatus[] = ["ACTIVE", "DISABLED"];

type UserForm = {
  full_name: string;
  email: string;
  role: Role;
  status: UserStatus;
  password: string;
};

const blankForm: UserForm = {
  full_name: "",
  email: "",
  role: "VIEWER",
  status: "ACTIVE",
  password: ""
};

function formFromUser(user: ManagedUser): UserForm {
  return {
    full_name: user.full_name,
    email: user.email,
    role: user.role,
    status: user.status,
    password: ""
  };
}

function payloadFromForm(form: UserForm): UserPayload {
  return {
    full_name: form.full_name.trim(),
    email: form.email.trim().toLowerCase(),
    role: form.role,
    status: form.status,
    password: form.password || undefined
  };
}

export default function UserManagement() {
  const currentUser = useAuth((state) => state.user);
  const toast = useUi((state) => state.addToast);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState<UserForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const result = await api.getUsers();
      setUsers(result.users);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load users";
      setError(message);
      toast(message);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const summary = useMemo(() => {
    const active = users.filter((user) => user.status === "ACTIVE").length;
    const disabled = users.filter((user) => user.status === "DISABLED").length;
    return { active, disabled };
  }, [users]);

  if (currentUser?.role !== "ADMIN") return <Navigate to="/" replace />;

  const openCreate = () => {
    setSelected(null);
    setForm(blankForm);
    setError(null);
    setDrawerOpen(true);
  };

  const openEdit = (user: ManagedUser) => {
    setSelected(user);
    setForm(formFromUser(user));
    setError(null);
    setDrawerOpen(true);
  };

  const updateForm = (key: keyof UserForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveUser = async () => {
    const payload = payloadFromForm(form);
    if (!payload.full_name) return setError("Full name is required");
    if (!payload.email.includes("@")) return setError("Valid email is required");
    if (!selected && !payload.password) return setError("Password is required");
    setSaving(true);
    try {
      if (selected) {
        await api.updateUser(selected.id, payload);
        toast("User updated");
      } else {
        await api.createUser(payload);
        toast("User created");
      }
      await loadUsers();
      setDrawerOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "User save failed";
      setError(message);
      toast(message);
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async () => {
    if (!selected) return;
    if (!form.password || form.password.length < 6) {
      setError("Enter a new password of at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      await api.resetUserPassword(selected.id, form.password);
      toast("Password reset");
      setForm((current) => ({ ...current, password: "" }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Password reset failed";
      setError(message);
      toast(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1 className="screen-title">User Management</h1>
          <p className="screen-muted">Lightweight role and account control for the hosted pilot.</p>
        </div>
        <button className="primary-button" onClick={openCreate}>+ Create User</button>
      </header>
      {error ? <p className={financeStyles.note}>{error}</p> : null}
      <section className="screen-panel">
        <div className="screen-grid">
          <div><strong>Users</strong><p>{users.length}</p></div>
          <div><strong>Active</strong><p>{summary.active}</p></div>
          <div><strong>Disabled</strong><p>{summary.disabled}</p></div>
        </div>
      </section>
      <section className="screen-panel">
        <DataTable
          rows={users}
          rowKey={(row) => row.id}
          onRowClick={openEdit}
          searchKey={(row) => `${row.full_name} ${row.email} ${row.role} ${row.status}`}
          filters={[
            { label: "Active", predicate: (row) => row.status === "ACTIVE" },
            { label: "Disabled", predicate: (row) => row.status === "DISABLED" },
            { label: "Admin", predicate: (row) => row.role === "ADMIN" },
            { label: "Sales", predicate: (row) => row.role === "SALES" },
            { label: "Ops", predicate: (row) => row.role === "OPS" }
          ]}
          columns={[
            { key: "full_name", header: "Name" },
            { key: "email", header: "Email" },
            { key: "role", header: "Role" },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "last_login_at", header: "Last login", render: (row) => row.last_login_at ? formatDate(row.last_login_at) : "-" },
            { key: "updated_at", header: "Updated", render: (row) => formatDate(row.updated_at) }
          ]}
        />
      </section>
      {drawerOpen ? (
        <Drawer title={selected ? `Edit ${selected.email}` : "Create User"} onClose={() => setDrawerOpen(false)}>
          <div className={financeStyles.drawerStack}>
            <section className={financeStyles.drawerSection}>
              <h3>Account</h3>
              <div className={financeStyles.controlGrid}>
                <label>
                  <span>Full name</span>
                  <input value={form.full_name} onChange={(event) => updateForm("full_name", event.target.value)} />
                </label>
                <label>
                  <span>Email</span>
                  <input value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
                </label>
                <label>
                  <span>Role</span>
                  <select value={form.role} onChange={(event) => updateForm("role", event.target.value as Role)}>
                    {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label>
                  <span>Status</span>
                  <select value={form.status} onChange={(event) => updateForm("status", event.target.value as UserStatus)}>
                    {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  <span>{selected ? "New password" : "Password"}</span>
                  <input type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} />
                </label>
              </div>
            </section>
            {error ? <p className={financeStyles.note}>{error}</p> : null}
            <div className={financeStyles.saveBar}>
              <span>No delete. Disabled users cannot log in.</span>
              <div>
                {selected ? <button className="secondary-button" disabled={saving} onClick={resetPassword}>Reset password</button> : null}
                <button className="secondary-button" disabled={saving} onClick={() => setDrawerOpen(false)}>Cancel</button>
                <button className="primary-button" disabled={saving} onClick={saveUser}>{saving ? "Saving..." : "Save user"}</button>
              </div>
            </div>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}
