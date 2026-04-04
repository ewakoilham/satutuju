"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { SkeletonCard } from "@/components/ui/Skeleton";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to change password");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  }

  const PasswordField = ({
    label,
    value,
    onChange,
    showKey,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    showKey: keyof typeof show;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show[showKey] ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="input-field w-full pr-12"
        />
        <button
          type="button"
          onClick={() => setShow((s) => ({ ...s, [showKey]: !s[showKey] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <Icon name={show[showKey] ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-heading)]">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account settings</p>
      </div>

      <div className="card rounded-2xl p-6">
        <h2 className="text-base font-semibold mb-4">Change Password</h2>

        {success && (
          <div className="bg-success-light text-green-700 text-sm px-4 py-2 rounded-lg mb-4 animate-slide-in-up">
            Password changed successfully.
          </div>
        )}
        {error && (
          <div className="bg-danger-light text-red-600 text-sm px-4 py-2 rounded-lg mb-4 animate-slide-in-up">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            showKey="current"
          />
          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            showKey="new"
          />
          <PasswordField
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            showKey="confirm"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
