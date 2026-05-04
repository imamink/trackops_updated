import React, { useMemo, useState } from "react";
import { ArrowLeft, Camera, Save, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MAX_IMAGE_SIZE = 350 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("We couldn't read that image. Try a different file."));
    reader.readAsDataURL(file);
  });
}

export default function ProfilePage() {
  const { profile, updateProfileSettings } = useAuth();
  const [username, setUsername] = useState(profile?.siteName || profile?.name || "");
  const [photoDataUrl, setPhotoDataUrl] = useState(profile?.photoDataUrl || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");

  const initials = useMemo(() => {
    const source = username.trim() || profile?.siteName || profile?.name || "TrackOps";
    return source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }, [profile?.name, profile?.siteName, username]);

  async function handleImageChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the profile picture.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Please choose an image smaller than 350 KB.");
      return;
    }

    try {
      const result = await readFileAsDataUrl(file);
      setPhotoDataUrl(result);
      setError("");
      setSuccess("");
      setWarning("");
    } catch (err) {
      setError(err.message || "Unable to load that image.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    setWarning("");

    try {
      const result = await updateProfileSettings({ username, photoDataUrl });
      setSuccess(result?.savedRemotely ? "Profile updated successfully." : "Profile updated.");
      if (result?.warning) {
        setWarning(result.warning);
      }
    } catch (err) {
      setError(err.message || "Unable to update your profile right now.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <div className="profile-header">
          <div>
            <span className="eyebrow">Account Settings</span>
            <h1>Profile</h1>
            <p>Update the username your team sees and choose the picture shown in the top-right account menu.</p>
          </div>
          <Link className="profile-back-link" to="/site">
            <ArrowLeft size={15} /> Back to Dashboard
          </Link>
        </div>

        <div className="profile-layout">
          <aside className="profile-preview-card">
            <div className="profile-avatar-large">
              {photoDataUrl ? (
                <img src={photoDataUrl} alt={`${username || "User"} profile`} />
              ) : (
                <span>{initials || <UserRound size={28} />}</span>
              )}
            </div>
            <h2>{username || "Site Username"}</h2>
            <p>{profile?.email}</p>
            <label className="profile-upload-btn">
              <Camera size={15} /> Change Picture
              <input type="file" accept="image/*" onChange={handleImageChange} />
            </label>
          </aside>

          <section className="panel form-page-panel profile-form-panel">
            <div className="section-title section-title-stack">
              <div>
                <h2>Edit Profile</h2>
                <span>Save changes to your shared site account.</span>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <label>Username</label>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your site username"
              />
              <p className="field-hint">This updates the name shown across the application and in future profile views.</p>

              <label>Profile Picture</label>
              <div className="profile-picture-note">
                <span>{photoDataUrl ? "Image selected and ready to save." : "No custom picture selected yet."}</span>
                {photoDataUrl && (
                  <button
                    className="task-link-btn"
                    type="button"
                    onClick={() => {
                      setPhotoDataUrl("");
                      setSuccess("");
                    }}
                  >
                    Remove Picture
                  </button>
                )}
              </div>

              {error && <p className="login-error">{error}</p>}
              {warning && <p className="field-hint">{warning}</p>}
              {success && <p className="login-success">{success}</p>}

              <div className="task-actions">
                <button className="primary-inline-btn" type="submit" disabled={isSaving}>
                  <Save size={15} /> {isSaving ? "Saving..." : "Save Profile"}
                </button>
                <Link className="task-link-btn" to="/site">
                  Cancel
                </Link>
              </div>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
