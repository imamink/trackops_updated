import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { firebaseConfigReady } from "../firebase";

export default function AccessDeniedPage() {
  const { error } = useAuth();

  return (
    <main className="status-page">
      <section className="status-card">
        <h1>Access Denied</h1>
        <p>{error || "Your account does not have permission to access this area."}</p>
        <Link className="primary-link" to={firebaseConfigReady ? "/login" : "/"}>Return</Link>
      </section>
    </main>
  );
}
