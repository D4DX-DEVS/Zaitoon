import React from "react";

const THEME = { primary: "#7C3AED" };

/**
 * Dashboard overview cards for Growth & Activity.
 * Uses stats from API when provided; otherwise derives from users array (legacy).
 */
function ActivityStats({ stats: statsProp, users = [] }) {
  const fromStats = statsProp && typeof statsProp.totalCurrentStreaks === "number";
  const totalStreakCurrent = fromStats
    ? statsProp.totalCurrentStreaks
    : users.reduce((sum, u) => sum + (u.readingStreak?.current ?? 0), 0);
  const totalBooksRead = fromStats
    ? statsProp.totalBooksRead
    : users.reduce((sum, u) => sum + (u.booksRead ?? 0), 0);
  const totalAchievements = fromStats
    ? statsProp.totalAchievements
    : users.reduce((sum, u) => sum + (u.achievements?.length ?? 0), 0);
  const activeStreakUsers = fromStats && statsProp.activeStreakUsers != null
    ? statsProp.activeStreakUsers
    : users.filter((u) => (u.readingStreak?.current ?? 0) > 0).length;

  const cards = [
    {
      label: "Total current streaks",
      value: totalStreakCurrent,
      sub: `${activeStreakUsers} users with active streak`,
      icon: "🏆",
      color: THEME.primary,
    },
    {
      label: "Books read (all users)",
      value: totalBooksRead,
      sub: "Completed books",
      icon: "📚",
      color: THEME.primary,
    },
    {
      label: "Achievements",
      value: totalAchievements,
      sub: "Placeholder for future badges",
      icon: "🏅",
      color: THEME.primary,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-violet-500/30 bg-gray-900/80 backdrop-blur-sm p-5 shadow-lg"
          style={{ borderColor: `${card.color}40` }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">
                {card.label}
              </p>
              <p className="text-2xl font-bold text-white" style={{ color: card.color }}>
                {card.value}
              </p>
              {card.sub && (
                <p className="text-gray-500 text-xs mt-1">{card.sub}</p>
              )}
            </div>
            <span className="text-3xl" aria-hidden>
              {card.icon}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityStats;
