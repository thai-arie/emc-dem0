import type { Role } from "../entities/types";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";

const roles: { label: string; value: Role }[] = [
  { label: "CEO", value: "CEO" },
  { label: "Collections officer", value: "COLLECTIONS" },
  { label: "Ops", value: "OPS" }
];

export default function Login() {
  const login = useAuth((state) => state.login);
  const navigate = useNavigate();
  const pick = (role: Role) => {
    login(role);
    navigate("/");
  };
  return (
    <div className="login">
      <section className="login-panel">
        <h1>Pick role</h1>
        <div className="role-grid">
          {roles.map((role) => (
            <button className="primary-button" key={role.value} onClick={() => pick(role.value)}>
              {role.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
