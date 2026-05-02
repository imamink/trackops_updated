import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigError, firebaseConfigReady } from "../firebase";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, profile, loading, error, login, resetPassword } = useAuth();
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [feedback, setFeedback] = useState("");
  const [localError, setLocalError] = useState("");

  if (!loading && user && profile) {
    return <Navigate to="/site" replace />;
  }

  return (
    <main className="signin-page">
      <section className="signin-card">
        <img src="/trackops-logo.png" alt="TrackOps logo" className="login-logo" />
        <h1>Site Login</h1>
        <p>Sign in with your shared site account. Use your site username or the account email, then enter the site password.</p>
        <p className="auth-note">Each site account has full access to the TrackOps workspace for that site.</p>

        {!firebaseConfigReady && <p className="login-error">{firebaseConfigError}</p>}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!firebaseConfigReady) return;
            setLocalError("");
            setFeedback("");
            try {
              await login(form.identifier, form.password);
            } catch (err) {
              setLocalError(err.message || "Login failed.");
            }
          }}
        >
          <label>Site Username or Email</label>
          <input
            value={form.identifier}
            onChange={(e) => setForm((prev) => ({ ...prev, identifier: e.target.value }))}
            placeholder="olympus-pines or you@example.com"
          />

          <label>Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="Enter password"
          />

          {(localError || error) && <p className="login-error">{localError || error}</p>}
          {feedback && <p className="login-success">{feedback}</p>}

          <button className="primary-btn" type="submit">Sign In</button>
        </form>

        <div className="auth-link-grid">
          <button className="ghost-btn" type="button" onClick={() => navigate("/create-account")}>
            Create Site Account
          </button>

          <button
            className="ghost-btn"
            type="button"
            onClick={async () => {
              if (!firebaseConfigReady) return;
              if (!form.identifier.includes("@")) {
                setLocalError("Enter the account email to send a password reset.");
                return;
              }
              setLocalError("");
              await resetPassword(form.identifier.trim());
              setFeedback("Password reset email sent.");
            }}
          >
            Reset Password
          </button>
        </div>

        <p className="switch-auth">
          Need a site account? <Link to="/create-account">Go to the create account page</Link>.
        </p>
      </section>
    </main>
  );
}
