import React, { useState } from "react";
import { deleteUserActivity } from "../services/activityService";
import StatusModal from "./SuccessModal";

const THEME = { primary: "#7C3AED" };

/**
 * Table of all users with name, avatar placeholder, streak, books read, achievements.
 */
function UserActivityTable({ users = [], loading = false, error = null, onDelete = null }) {
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null });

  const showModal = (type, message, onConfirm = null, onCancel = null) => {
    setModal({ isOpen: true, type, message, onConfirm, onCancel });
  };

  const closeModal = () => {
    setModal({ isOpen: false, type: 'success', message: '', onConfirm: null, onCancel: null });
  };

  const confirmDelete = async (user) => {
    const identifier = user.firebaseUid || user._id;
    if (!identifier) {
      setDeleteError("User identifier not found.");
      return;
    }

    setDeletingId(user._id);
    setDeleteError(null);

    try {
      await deleteUserActivity(identifier);
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      setDeleteError(err.message || "Failed to delete user activity.");
      console.error("Delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDelete = (user) => {
    showModal('confirmation', `Are you sure you want to delete growth activity for ${user.name || user.email}? This will permanently remove their streak, books read, and achievements data.`, () => confirmDelete(user), null);
  };
  if (loading) {
    return (
      <div className="rounded-xl border border-violet-500/30 bg-gray-900/80 backdrop-blur-sm p-8 text-center">
        <div
          className="animate-spin rounded-full h-10 w-10 border-2 border-t-transparent mx-auto"
          style={{ borderColor: THEME.primary }}
        />
        <p className="text-gray-400 mt-3">Loading activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-gray-900/80 backdrop-blur-sm p-6 text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="rounded-xl border border-violet-500/30 bg-gray-900/80 backdrop-blur-sm p-8 text-center">
        <p className="text-gray-400">No users found.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-500/30 bg-gray-900/80 backdrop-blur-sm overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr
              className="text-left text-sm font-medium text-gray-400 border-b border-violet-500/20"
              style={{ backgroundColor: `${THEME.primary}15` }}
            >
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">🏆 Streak</th>
              <th className="py-3 px-4">Longest</th>
              <th className="py-3 px-4">📚 Books read</th>
              <th className="py-3 px-4">🏅 Achievements</th>
              <th className="py-3 px-4">Last active</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const streak = u.readingStreak || {};
              const current = streak.current ?? 0;
              const longest = streak.longest ?? 0;
              const booksRead = u.booksRead ?? 0;
              const achievements = u.achievements || [];
              const lastActive = streak.lastActiveDate
                ? new Date(streak.lastActiveDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—";
              const initial = (u.name || "?").charAt(0).toUpperCase();
              return (
                <tr
                  key={u._id}
                  className="border-b border-gray-700/50 hover:bg-violet-500/5 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                        style={{ backgroundColor: THEME.primary }}
                        title="Avatar placeholder"
                      >
                        {initial}
                      </div>
                      <div>
                        <p className="text-white font-medium">{u.name || "—"}</p>
                        <p className="text-gray-500 text-xs">{u.email || "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="font-semibold"
                      style={{ color: THEME.primary }}
                    >
                      {current}
                    </span>
                    <span className="text-gray-500 text-sm ml-1">days</span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">{longest}</td>
                  <td className="py-3 px-4 text-gray-300">{booksRead}</td>
                  <td className="py-3 px-4">
                    {achievements.length > 0 ? (
                      <span className="text-gray-300 text-sm">
                        {achievements.length} badge
                        {achievements.length !== 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">
                    {lastActive}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u._id}
                      className="px-3 py-1.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-red-600"
                      style={{
                        backgroundColor: deletingId === u._id ? "#6B7280" : "#EF4444",
                      }}
                      title="Delete growth activity (streak, books read, achievements)"
                    >
                      {deletingId === u._id ? "Deleting..." : "Delete"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {deleteError && (
        <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30">
          <p className="text-red-400 text-sm">{deleteError}</p>
        </div>
      )}
      <StatusModal
        isOpen={modal.isOpen}
        type={modal.type}
        message={modal.message}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        onCancel={modal.onCancel}
      />
    </div>
  );
}

export default UserActivityTable;
