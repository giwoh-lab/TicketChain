import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { loginUser } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password) {
      setError("Email and password are required.");
      return;
    }
    const result = loginUser({
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
    if (!result.success) {
      setError(result.error);
      return;
    }
    // Redirect to index; admin access is checked on the /admin page itself
    router.push("/");
  }

  return (
    <>
      <Head>
        <title>Login – Concert Ticket DApp</title>
      </Head>
      <div className="auth-page">
        <div className="auth-card">
          <h2>Log In</h2>
          <form onSubmit={handleSubmit} noValidate>
            {error && <p className="auth-error">{error}</p>}
            <label>
              Email
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn auth-btn">Log In</button>
            <p className="auth-link">
              Don&apos;t have an account? <a href="/register">Register</a>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
