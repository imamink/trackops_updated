import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const { user, profile, loading, error } = useAuth();

  if (loading) {
    return <main className="status-page">Loading TrackOps...</main>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error || !profile) {
    return <Navigate to="/access-denied" replace />;
  }

  if (allowedRoles.length && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
}
