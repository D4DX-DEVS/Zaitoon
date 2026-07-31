import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import {
  getAnalyticsOverview,
  getVideoAnalytics,
  getStoryAnalytics,
  getQuizAnalytics,
  getPuzzleAnalytics,
  getKidsCornerAnalytics,
  getBookmarkAnalytics,
} from "../services/analyticsService";
import {
  ChartBarIcon,
  VideoCameraIcon,
  BookOpenIcon,
  AcademicCapIcon,
  PuzzlePieceIcon,
  UserGroupIcon,
  BookmarkIcon,
  ClockIcon,
  UsersIcon,
  ArrowTrendingUpIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function pct(val) {
  if (val == null) return "0%";
  return `${Math.round(val)}%`;
}

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color = "#7C3AED" }) {
  return (
    <div
      className="rounded-xl border border-violet-500/30 bg-gray-900/80 backdrop-blur-sm p-5 shadow-lg"
      style={{ borderColor: `${color}40` }}
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-gray-400 text-sm font-medium mb-1 truncate">{label}</p>
          <p className="text-2xl font-bold text-white" style={{ color }}>
            {value ?? "—"}
          </p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
        {Icon && <Icon className="w-8 h-8 flex-shrink-0 ml-2" style={{ color: `${color}80` }} />}
      </div>
    </div>
  );
}

// ─── Mini bar (inline spark) ─────────────────────────────────────────────────

function MiniBar({ data = [], dataKey = "activeUsers", height = 48 }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d[dataKey] || 0), 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((d, i) => {
        const val = d[dataKey] || 0;
        const h = Math.max(2, (val / max) * height);
        return (
          <div
            key={i}
            title={`${d.date}: ${val}`}
            className="bg-purple-500/70 hover:bg-purple-400 rounded-t-sm transition-colors cursor-default"
            style={{ width: Math.max(4, Math.floor(200 / data.length)), height: h }}
          />
        );
      })}
    </div>
  );
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, color = "#7C3AED" }) {
  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gray-900/60 backdrop-blur-sm p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-5 h-5" style={{ color }} />}
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── Top content table ───────────────────────────────────────────────────────

function TopContentTable({ items = [], label = "Content" }) {
  if (!items.length)
    return <p className="text-gray-500 text-sm">No data for this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700/50">
            <th className="text-left py-2 font-medium">#</th>
            <th className="text-left py-2 font-medium">{label}</th>
            <th className="text-right py-2 font-medium">Views</th>
            <th className="text-right py-2 font-medium">Watch Time</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-b border-gray-800/40 hover:bg-violet-900/10">
              <td className="py-2 text-gray-500">{i + 1}</td>
              <td className="py-2 text-white truncate max-w-[200px]">
                {item.title || item.contentTitle || item._id || "Untitled"}
              </td>
              <td className="py-2 text-right text-gray-300">{item.views ?? item.count ?? 0}</td>
              <td className="py-2 text-right text-gray-300">
                {formatDuration(item.totalWatchTime || item.watchTime || 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── Page Component ──────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

export default function Analytics() {
  const defaults = getDefaultDates();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data
  const [overview, setOverview] = useState(null);
  const [videos, setVideos] = useState(null);
  const [stories, setStories] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [puzzle, setPuzzle] = useState(null);
  const [kidsCorner, setKidsCorner] = useState(null);
  const [bookmarks, setBookmarks] = useState(null);

  // Active tab
  const [tab, setTab] = useState("overview");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ovRes, vidRes, stRes, qzRes, pzRes, kcRes, bkRes] = await Promise.all([
        getAnalyticsOverview(from, to),
        getVideoAnalytics(from, to),
        getStoryAnalytics(from, to),
        getQuizAnalytics(from, to),
        getPuzzleAnalytics(from, to),
        getKidsCornerAnalytics(from, to),
        getBookmarkAnalytics(from, to),
      ]);
      if (ovRes.success) setOverview(ovRes.data);
      if (vidRes.success) setVideos(vidRes.data);
      if (stRes.success) setStories(stRes.data);
      if (qzRes.success) setQuiz(qzRes.data);
      if (pzRes.success) setPuzzle(pzRes.data);
      if (kcRes.success) setKidsCorner(kcRes.data);
      if (bkRes.success) setBookmarks(bkRes.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const tabs = [
    { key: "overview", label: "Overview", icon: ChartBarIcon },
    { key: "videos", label: "Videos", icon: VideoCameraIcon },
    { key: "stories", label: "Stories", icon: BookOpenIcon },
    { key: "quiz", label: "Quiz", icon: AcademicCapIcon },
    { key: "puzzle", label: "Puzzle", icon: PuzzlePieceIcon },
    { key: "kids", label: "Kids Corner", icon: UserGroupIcon },
    { key: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  ];

  const summary = overview?.summary || {};
  const featureUsage = overview?.featureUsage || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <Sidebar />
      <div className="flex-1 ml-56">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Archivo Black" }}>
                Analytics
              </h1>
              <p className="text-gray-400 mt-1">
                App usage, engagement &amp; content performance
              </p>
            </div>
            {/* Date range */}
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
              />
              <span className="text-gray-500 text-sm">to</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5 text-sm focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-1 mb-6 bg-gray-800/50 rounded-xl p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-purple-600 text-white shadow-md"
                    : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/40 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
            </div>
          )}

          {/* Content */}
          {!loading && (
            <>
              {/* ══════════ OVERVIEW TAB ══════════ */}
              {tab === "overview" && (
                <div className="space-y-6">
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={UsersIcon}
                      label="Active Users"
                      value={summary.totalActiveUsers ?? 0}
                      sub={`${summary.newUsers ?? 0} new users`}
                    />
                    <StatCard
                      icon={ArrowTrendingUpIcon}
                      label="Total Sessions"
                      value={summary.totalSessions ?? 0}
                      color="#10B981"
                    />
                    <StatCard
                      icon={ClockIcon}
                      label="Avg Session"
                      value={formatDuration(summary.avgSessionDuration)}
                      color="#F59E0B"
                    />
                    <StatCard
                      icon={ClockIcon}
                      label="Avg / User / Day"
                      value={formatDuration(summary.avgTimePerUserPerDay)}
                      color="#3B82F6"
                    />
                  </div>

                  {/* Daily trend */}
                  {overview?.dailyTrend?.length > 0 && (
                    <Section title="Daily Active Users" icon={ChartBarIcon}>
                      <MiniBar data={overview.dailyTrend} dataKey="activeUsers" height={64} />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{overview.dailyTrend[0]?.date}</span>
                        <span>{overview.dailyTrend[overview.dailyTrend.length - 1]?.date}</span>
                      </div>
                    </Section>
                  )}

                  {/* Feature usage */}
                  <Section title="Feature Usage" icon={ChartBarIcon}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: "video", label: "Videos", icon: "🎬" },
                        { key: "story", label: "Stories", icon: "📖" },
                        { key: "single_story", label: "Single Stories", icon: "📝" },
                        { key: "brightbox", label: "BrightBox", icon: "✨" },
                        { key: "quiz", label: "Quizzes", icon: "🧠" },
                        { key: "puzzle", label: "Puzzles", icon: "🧩" },
                        { key: "kids_corner", label: "Kids Corner", icon: "🎨" },
                        { key: "bookmark", label: "Bookmarks", icon: "🔖" },
                      ].map((f) => {
                        const usage = featureUsage[f.key] || {};
                        return (
                          <div
                            key={f.key}
                            className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{f.icon}</span>
                              <span className="text-sm text-gray-300 font-medium">{f.label}</span>
                            </div>
                            <p className="text-xl font-bold text-white">{usage.count ?? 0}</p>
                            <p className="text-xs text-gray-500">
                              {usage.uniqueUsers ?? 0} unique users
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </Section>
                </div>
              )}

              {/* ══════════ VIDEOS TAB ══════════ */}
              {tab === "videos" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={VideoCameraIcon}
                      label="Total Views"
                      value={videos?.summary?.totalViews ?? 0}
                    />
                    <StatCard
                      icon={UsersIcon}
                      label="Unique Viewers"
                      value={videos?.summary?.uniqueViewers ?? 0}
                      color="#10B981"
                    />
                    <StatCard
                      icon={ClockIcon}
                      label="Total Watch Time"
                      value={formatDuration(videos?.summary?.totalWatchTime)}
                      color="#F59E0B"
                    />
                    <StatCard
                      icon={ClockIcon}
                      label="Avg Watch Time"
                      value={formatDuration(videos?.summary?.avgWatchTime)}
                      color="#3B82F6"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard
                      label="Completion Rate"
                      value={pct(videos?.summary?.completionRate)}
                      color="#8B5CF6"
                    />
                    <StatCard
                      label="Completions"
                      value={videos?.summary?.completions ?? 0}
                      color="#EC4899"
                    />
                  </div>
                  {videos?.topVideos?.length > 0 && (
                    <Section title="Top Videos" icon={VideoCameraIcon}>
                      <TopContentTable items={videos.topVideos} label="Video" />
                    </Section>
                  )}
                  {videos?.dailyTrend?.length > 0 && (
                    <Section title="Daily Views" icon={ChartBarIcon}>
                      <MiniBar data={videos.dailyTrend} dataKey="views" height={56} />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{videos.dailyTrend[0]?.date}</span>
                        <span>{videos.dailyTrend[videos.dailyTrend.length - 1]?.date}</span>
                      </div>
                    </Section>
                  )}
                </div>
              )}

              {/* ══════════ STORIES TAB ══════════ */}
              {tab === "stories" && (
                <div className="space-y-6">
                  {/* All Stories */}
                  <Section title="All Stories (Series)" icon={BookOpenIcon}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard label="Opens" value={stories?.allStories?.opens ?? 0} />
                      <StatCard label="Completes" value={stories?.allStories?.completes ?? 0} color="#10B981" />
                      <StatCard label="Unique Readers" value={stories?.allStories?.uniqueReaders ?? 0} color="#3B82F6" />
                      <StatCard label="Completion Rate" value={pct(stories?.allStories?.completionRate)} color="#F59E0B" />
                    </div>
                  </Section>
                  {/* Single Stories */}
                  <Section title="Single Stories" icon={BookOpenIcon} color="#EC4899">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <StatCard label="Opens" value={stories?.singleStories?.opens ?? 0} />
                      <StatCard label="Completes" value={stories?.singleStories?.completes ?? 0} color="#10B981" />
                      <StatCard label="Unique Readers" value={stories?.singleStories?.uniqueReaders ?? 0} color="#3B82F6" />
                    </div>
                  </Section>
                  {/* BrightBox */}
                  <Section title="BrightBox" icon={BookOpenIcon} color="#F59E0B">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <StatCard label="Opens" value={stories?.brightbox?.opens ?? 0} />
                      <StatCard label="Completes" value={stories?.brightbox?.completes ?? 0} color="#10B981" />
                      <StatCard label="Unique Readers" value={stories?.brightbox?.uniqueReaders ?? 0} color="#3B82F6" />
                    </div>
                  </Section>
                  {/* Top Stories */}
                  {stories?.topStories?.length > 0 && (
                    <Section title="Top Stories" icon={BookOpenIcon}>
                      <TopContentTable items={stories.topStories} label="Story" />
                    </Section>
                  )}
                  {/* Read Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard
                      icon={ClockIcon}
                      label="Total Read Time"
                      value={formatDuration(stories?.totalReadTime)}
                      color="#8B5CF6"
                    />
                    <StatCard
                      icon={ClockIcon}
                      label="Avg Read Time"
                      value={formatDuration(stories?.avgReadTime)}
                      color="#6366F1"
                    />
                  </div>
                </div>
              )}

              {/* ══════════ QUIZ TAB ══════════ */}
              {tab === "quiz" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={AcademicCapIcon}
                      label="Total Attempts"
                      value={quiz?.summary?.totalAttempts ?? 0}
                    />
                    <StatCard
                      icon={UsersIcon}
                      label="Unique Players"
                      value={quiz?.summary?.uniqueParticipants ?? 0}
                      color="#10B981"
                    />
                    <StatCard
                      label="Avg Score"
                      value={quiz?.summary?.avgScore != null ? Math.round(quiz.summary.avgScore) : "—"}
                      sub="out of 100"
                      color="#F59E0B"
                    />
                    <StatCard
                      label="Completion Rate"
                      value={pct(quiz?.summary?.completionRate)}
                      color="#3B82F6"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard
                      icon={ClockIcon}
                      label="Avg Duration"
                      value={formatDuration(quiz?.summary?.avgDuration)}
                      color="#8B5CF6"
                    />
                    <StatCard
                      label="Abandons"
                      value={quiz?.summary?.abandons ?? 0}
                      color="#EF4444"
                    />
                  </div>
                  {quiz?.topQuizzes?.length > 0 && (
                    <Section title="Top Quizzes" icon={AcademicCapIcon}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-700/50">
                              <th className="text-left py-2 font-medium">#</th>
                              <th className="text-left py-2 font-medium">Quiz</th>
                              <th className="text-right py-2 font-medium">Attempts</th>
                              <th className="text-right py-2 font-medium">Avg Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {quiz.topQuizzes.map((q, i) => (
                              <tr key={i} className="border-b border-gray-800/40 hover:bg-violet-900/10">
                                <td className="py-2 text-gray-500">{i + 1}</td>
                                <td className="py-2 text-white truncate max-w-[200px]">
                                  {q.title || q.contentTitle || q._id || "Untitled"}
                                </td>
                                <td className="py-2 text-right text-gray-300">{q.attempts ?? q.count ?? 0}</td>
                                <td className="py-2 text-right text-gray-300">
                                  {q.avgScore != null ? Math.round(q.avgScore) : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  )}
                  {quiz?.dailyTrend?.length > 0 && (
                    <Section title="Daily Attempts" icon={ChartBarIcon}>
                      <MiniBar data={quiz.dailyTrend} dataKey="attempts" height={56} />
                    </Section>
                  )}
                </div>
              )}

              {/* ══════════ PUZZLE TAB ══════════ */}
              {tab === "puzzle" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      icon={PuzzlePieceIcon}
                      label="Total Attempts"
                      value={puzzle?.summary?.totalAttempts ?? 0}
                    />
                    <StatCard
                      icon={UsersIcon}
                      label="Unique Players"
                      value={puzzle?.summary?.uniqueParticipants ?? 0}
                      color="#10B981"
                    />
                    <StatCard
                      icon={ClockIcon}
                      label="Avg Time"
                      value={formatDuration(puzzle?.summary?.avgTimeTaken)}
                      color="#F59E0B"
                    />
                    <StatCard
                      label="Completion Rate"
                      value={pct(puzzle?.summary?.completionRate)}
                      color="#3B82F6"
                    />
                  </div>
                  {puzzle?.topPuzzles?.length > 0 && (
                    <Section title="Top Puzzles" icon={PuzzlePieceIcon}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-700/50">
                              <th className="text-left py-2 font-medium">#</th>
                              <th className="text-left py-2 font-medium">Puzzle</th>
                              <th className="text-right py-2 font-medium">Attempts</th>
                              <th className="text-right py-2 font-medium">Avg Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {puzzle.topPuzzles.map((p, i) => (
                              <tr key={i} className="border-b border-gray-800/40 hover:bg-violet-900/10">
                                <td className="py-2 text-gray-500">{i + 1}</td>
                                <td className="py-2 text-white truncate max-w-[200px]">
                                  {p.title || p.contentTitle || p._id || "Untitled"}
                                </td>
                                <td className="py-2 text-right text-gray-300">{p.attempts ?? p.count ?? 0}</td>
                                <td className="py-2 text-right text-gray-300">{formatDuration(p.avgTime || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  )}
                  {puzzle?.dailyTrend?.length > 0 && (
                    <Section title="Daily Attempts" icon={ChartBarIcon}>
                      <MiniBar data={puzzle.dailyTrend} dataKey="attempts" height={56} />
                    </Section>
                  )}
                </div>
              )}

              {/* ══════════ KIDS CORNER TAB ══════════ */}
              {tab === "kids" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={UserGroupIcon} label="Total Views" value={kidsCorner?.summary?.totalViews ?? 0} />
                    <StatCard label="Unique Viewers" value={kidsCorner?.summary?.uniqueViewers ?? 0} color="#10B981" />
                    <StatCard label="Total Submissions" value={kidsCorner?.summary?.totalSubmissions ?? 0} color="#F59E0B" />
                    <StatCard label="Unique Submitters" value={kidsCorner?.summary?.uniqueSubmitters ?? 0} color="#3B82F6" />
                  </div>
                  {/* Submission types */}
                  {kidsCorner?.submissions && (
                    <Section title="Submissions by Type" icon={UserGroupIcon}>
                      <div className="grid grid-cols-3 gap-4">
                        <StatCard label="Stories" value={kidsCorner.submissions.stories ?? 0} color="#8B5CF6" />
                        <StatCard label="Poems" value={kidsCorner.submissions.poems ?? 0} color="#EC4899" />
                        <StatCard label="Drawings" value={kidsCorner.submissions.drawings ?? 0} color="#F97316" />
                      </div>
                    </Section>
                  )}
                  {kidsCorner?.dailyTrend?.length > 0 && (
                    <Section title="Daily Views" icon={ChartBarIcon}>
                      <MiniBar data={kidsCorner.dailyTrend} dataKey="views" height={56} />
                    </Section>
                  )}
                </div>
              )}

              {/* ══════════ BOOKMARKS TAB ══════════ */}
              {tab === "bookmarks" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard icon={BookmarkIcon} label="Added" value={bookmarks?.summary?.added ?? 0} />
                    <StatCard label="Removed" value={bookmarks?.summary?.removed ?? 0} color="#EF4444" />
                    <StatCard label="Net Bookmarks" value={(bookmarks?.summary?.added ?? 0) - (bookmarks?.summary?.removed ?? 0)} color="#10B981" />
                    <StatCard label="Unique Users" value={bookmarks?.summary?.uniqueUsers ?? 0} color="#3B82F6" />
                  </div>
                  {bookmarks?.topBookmarked?.length > 0 && (
                    <Section title="Most Bookmarked" icon={BookmarkIcon}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-700/50">
                              <th className="text-left py-2 font-medium">#</th>
                              <th className="text-left py-2 font-medium">Content</th>
                              <th className="text-left py-2 font-medium">Type</th>
                              <th className="text-right py-2 font-medium">Count</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookmarks.topBookmarked.map((b, i) => (
                              <tr key={i} className="border-b border-gray-800/40 hover:bg-violet-900/10">
                                <td className="py-2 text-gray-500">{i + 1}</td>
                                <td className="py-2 text-white truncate max-w-[200px]">
                                  {b.title || b.contentTitle || b._id || "Untitled"}
                                </td>
                                <td className="py-2 text-gray-400 capitalize">{b.contentType || "—"}</td>
                                <td className="py-2 text-right text-gray-300">{b.count ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  )}
                  {bookmarks?.dailyTrend?.length > 0 && (
                    <Section title="Daily Bookmarks" icon={ChartBarIcon}>
                      <MiniBar data={bookmarks.dailyTrend} dataKey="added" height={56} />
                    </Section>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
