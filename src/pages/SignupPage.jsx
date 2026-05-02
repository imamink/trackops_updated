import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigError, firebaseConfigReady } from "../firebase";

export default function SignupPage() {
  const { user, profile, loading, signUp } = useAuth();
  const [form, setForm] = useState({
    siteName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!loading && user && profile) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="signin-page">
      <section className="signin-card">
        <img src="/trackops-logo.png" alt="TrackOps logo" className="login-logo" />
        <h1>Create Site Account</h1>
        <p>Create the shared site account your team will use for full TrackOps access at that location.</p>
        <p className="auth-note">Use the site name as the username so the team can sign in with either the site username or the account email.</p>

        {!firebaseConfigReady && <p className="login-error">{firebaseConfigError}</p>}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!firebaseConfigReady) return;
            setError("");
            setSuccess("");

            if (form.password.length < 8) {
              setError("Use a password with at least 8 characters.");
              return;
            }

            if (form.password !== form.confirmPassword) {
              setError("Passwords do not match.");
              return;
            }

            try {
              await signUp({
                siteName: form.siteName.trim(),
                email: form.email.trim(),
                password: form.password,
              });
              setSuccess("Account created. Check your email for verification.");
            } catch (err) {
              setError(err.message || "Unable to create account.");
            }
          }}
        >
          <label>Site Username</label>
          <input
            value={form.siteName}
            onChange={(e) => setForm((prev) => ({ ...prev, siteName: e.target.value }))}
            placeholder="Olympus Pines"
          />
          <p className="field-hint">This is the shared site login name.</p>

          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="site@yourdomain.com"
          />

          <label>Password</label>
          <input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Create password" />

          <label>Confirm Password</label>
          <input
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
            placeholder="Repeat password"
          />

          {error && <p className="login-error">{error}</p>}
          {success && <p className="login-success">{success}</p>}

          <button className="primary-btn" type="submit">Create Account</button>
        </form>

        <p className="switch-auth">
          Already have an account? <Link to="/login">Go to login</Link>.
        </p>
      </section>
    </main>
  );
}
