import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import SiteDashboard from "./pages/SiteDashboard";

function RoleHomeRedirect() {
  const { profile } = useAuth();

  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to="/site" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/create-account" element={<SignupPage />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/access-denied" element={<AccessDeniedPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleHomeRedirect />
          </ProtectedRoute>
        }
      />

      <Route
        path="/site"
        element={
          <ProtectedRoute>
            <SiteDashboard />
          </ProtectedRoute>
        }
      />

      <Route path="/admin" element={<Navigate to="/site" replace />} />
      <Route path="/regional" element={<Navigate to="/site" replace />} />
      <Route path="/team" element={<Navigate to="/site" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
