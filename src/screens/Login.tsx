import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../services/api";
import { useAuth } from "../store/auth";
import { useNavigate } from "react-router-dom";
import { routeForRole } from "../app/roleAccess";

export default function Login() {
  const setUser = useAuth((state) => state.setUser);
  const navigate = useNavigate();
  const [email, setEmail] = useState("collections@emc.local");
  const [password, setPassword] = useState("123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const user = await api.login(email, password);
      setUser(user);
      navigate(routeForRole(user.role));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login">
      <form className="login-panel" onSubmit={submit}>
        <h1>Sign in</h1>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="primary-button" disabled={loading} type="submit">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
