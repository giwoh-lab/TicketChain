import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { registerUser } from "../lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);

  function validate() {
    const errs = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = "Invalid email format.";
    }
    if (!form.password) {
      errs.password = "Password is required.";
    } else if (form.password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }
    if (form.password !== form.confirmPassword) {
      errs.confirmPassword = "Passwords do not match.";
    }
    return errs;
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Clear field-level error on change
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: undefined });
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    const result = registerUser({
      username: form.username.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
    });
    if (!result.success) {
      setServerError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <>
      <Head>
        <title>Register – Concert Ticket DApp</title>
      </Head>
      <div className="auth-page">
        <div className="auth-card">
          <h2>Create Account</h2>
          {success ? (
            <p className="auth-success">Registration successful! Redirecting to login…</p>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {serverError && <p className="auth-error">{serverError}</p>}
              <label>
                Username
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                />
                {errors.username && <span className="field-error">{errors.username}</span>}
              </label>
              <label>
                Email
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
              </label>
              <label>
                Confirm Password
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                {errors.confirmPassword && <span className="field-error">{errors.confirmPassword}</span>}
              </label>
              <button type="submit" className="btn auth-btn">Register</button>
              <p className="auth-link">
                Already have an account? <a href="/login">Log in</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
