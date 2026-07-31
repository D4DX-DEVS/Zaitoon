import React, { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import ActivityStats from "../components/ActivityStats";
import UserActivityTable from "../components/UserActivityTable";
import { getActivityStats, getAllUsersActivity } from "../services/activityService";

const DEFAULT_PAGE_SIZE = 50;

function Activity() {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(DEFAULT_PAGE_SIZE);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Use a ref so fetchPage always reads latest page/limit without stale closures
  const stateRef = useRef({ page, limit });
  useEffect(() => {
    stateRef.current = { page, limit };
  });

  const fetchPage = useCallback(async (targetPage) => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes] = await Promise.all([
        getActivityStats(),
        getAllUsersActivity({
          page: targetPage,
          limit: stateRef.current.limit,
        }),
      ]);
      if (statsRes.success && statsRes.data) setStats(statsRes.data);
      if (usersRes.success && usersRes.data?.users) {
        setUsers(usersRes.data.users);
        const pg = usersRes.data.pagination || {};
        setTotalUsers(pg.total ?? 0);
        setTotalPages(pg.totalPages ?? 1);
        setPage(pg.page ?? targetPage);
      } else if (!usersRes.success) {
        setError(usersRes.message || "Failed to load users.");
      }
    } catch (err) {
      setError(err.message || "Failed to load activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch whenever page changes (first load + navigation)
  useEffect(() => {
    fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  const handleNext = () => {
    if (page < totalPages) setPage((p) => p + 1);
  };

  const handleDeleteRefresh = () => {
    // After delete, reload current page (go to previous page if it would become empty)
    const safePageAfterDelete =
      users.length === 1 && page > 1 ? page - 1 : page;
    if (safePageAfterDelete !== page) {
      setPage(safePageAfterDelete); // triggers useEffect
    } else {
      fetchPage(page);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="flex-1 ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "Archivo Black" }}
            >
              Growth & Activity
            </h1>
            <p className="text-gray-400 mt-1">
              Reading streaks, books read, and achievements across users.
            </p>
          </div>

          <ActivityStats stats={stats} users={users} />

          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">User activity</h2>
          </div>

          {/* Pagination bar — always visible once data is loaded */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
            <span>
              {totalUsers > 0
                ? `Page ${page} of ${totalPages} (${totalUsers} users)`
                : loading
                ? "Loading…"
                : "No users"}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={loading || page <= 1}
                className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40 hover:bg-gray-600 transition-colors"
              >
                Previous
              </button>
              {/* Page number pills */}
              {totalPages > 1 && (
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    // Show pages around current
                    let p;
                    if (totalPages <= 7) {
                      p = i + 1;
                    } else if (page <= 4) {
                      p = i + 1;
                    } else if (page >= totalPages - 3) {
                      p = totalPages - 6 + i;
                    } else {
                      p = page - 3 + i;
                    }
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        disabled={loading}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 ${
                          p === page
                            ? "text-white"
                            : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                        }`}
                        style={p === page ? { backgroundColor: "#7C3AED" } : {}}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                onClick={handleNext}
                disabled={loading || page >= totalPages}
                className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40 hover:bg-gray-600 transition-colors"
              >
                Next
              </button>
            </div>
          </div>

          <UserActivityTable
            users={users}
            loading={loading}
            error={error}
            onDelete={handleDeleteRefresh}
          />

          {/* Bottom pagination for convenience on long tables */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-400">
              <span>
                Page {page} of {totalPages} ({totalUsers} users)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={loading || page <= 1}
                  className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40 hover:bg-gray-600 transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={loading || page >= totalPages}
                  className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-40 hover:bg-gray-600 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Activity;
