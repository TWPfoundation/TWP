"use client";

import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { Users, CheckCircle, XCircle, Clock, MessageSquare } from "lucide-react";

interface DashboardStats {
  totalSubmissions: number;
  accepted: number;
  rejected: number;
  pendingReview: number;
  totalSessions: number;
  avgSpecificity: number;
  avgCounterfactual: number;
  avgRelational: number;
  topTags: Array<{ name: string; count: number }>;
  recentActivity: Array<{ action: string; time: string; meta: Record<string, unknown> }>;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6", "#ec4899"];

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function StatCard({ icon: Icon, label, value, accent }: {
  icon: typeof Users; label: string; value: number | string; accent?: string;
}) {
  return (
    <motion.div
      {...fadeIn}
      className="border border-border/10 bg-white/[0.02] p-5 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${accent || "text-muted-foreground/40"}`} />
        <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-2xl font-light text-foreground/80 tracking-wide">{value}</p>
    </motion.div>
  );
}

export function AdminDashboardClient({ stats }: { stats: DashboardStats }) {
  const pieData = [
    { name: "Accepted", value: stats.accepted },
    { name: "Rejected", value: stats.rejected },
    { name: "Pending", value: stats.pendingReview },
    { name: "Processing", value: Math.max(0, stats.totalSubmissions - stats.accepted - stats.rejected - stats.pendingReview) },
  ].filter(d => d.value > 0);

  const radarData = [
    { axis: "Specificity", value: stats.avgSpecificity },
    { axis: "Counterfactual", value: stats.avgCounterfactual },
    { axis: "Relational", value: stats.avgRelational },
  ];

  const PIE_COLORS = ["#22c55e", "#ef4444", "#eab308", "#6b7280"];

  return (
    <div className="pt-24 pb-16 px-8 space-y-10 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div {...fadeIn} className="text-center space-y-2">
        <h1 className="text-2xl font-light tracking-widest text-foreground text-glow uppercase">
          Administrative Dashboard
        </h1>
        <p className="text-xs text-muted-foreground/40 font-mono tracking-wide">
          Corpus Health · Pipeline Metrics · System Activity
        </p>
      </motion.div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Users} label="Total Submissions" value={stats.totalSubmissions} />
        <StatCard icon={CheckCircle} label="Accepted" value={stats.accepted} accent="text-emerald-500/60" />
        <StatCard icon={XCircle} label="Rejected" value={stats.rejected} accent="text-red-500/60" />
        <StatCard icon={Clock} label="Pending Review" value={stats.pendingReview} accent="text-amber-500/60" />
        <StatCard icon={MessageSquare} label="Inquisitor Sessions" value={stats.totalSessions} accent="text-cyan-500/60" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Pipeline Funnel (Pie) */}
        <motion.div {...fadeIn} className="border border-border/10 bg-white/[0.02] p-6 space-y-4">
          <h3 className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            Pipeline Funnel
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.7} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", color: "#888", fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground/30">
              No data yet
            </div>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length], opacity: 0.7 }} />
                <span className="text-[9px] font-mono text-muted-foreground/40">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quality Radar */}
        <motion.div {...fadeIn} className="border border-border/10 bg-white/[0.02] p-6 space-y-4">
          <h3 className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            Avg Quality Dimensions
          </h3>
          {radarData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#222" />
                <PolarAngleAxis dataKey="axis" tick={{ fill: "#666", fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 10]} tick={{ fill: "#444", fontSize: 9 }} />
                <Radar
                  name="Average"
                  dataKey="value"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", color: "#888", fontSize: 11 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground/30">
              No scored assessments yet
            </div>
          )}
        </motion.div>

        {/* Top Tags Bar Chart */}
        <motion.div {...fadeIn} className="border border-border/10 bg-white/[0.02] p-6 space-y-4">
          <h3 className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
            Top Taxonomy Tags
          </h3>
          {stats.topTags.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.topTags} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" tick={{ fill: "#444", fontSize: 9 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#666", fontSize: 8 }}
                  width={75}
                />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #222", color: "#888", fontSize: 11 }}
                />
                <Bar dataKey="count" radius={[0, 2, 2, 0]}>
                  {stats.topTags.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.6} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground/30">
              No tags extracted yet
            </div>
          )}
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div {...fadeIn} className="border border-border/10 bg-white/[0.02] p-6 space-y-4">
        <h3 className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-widest">
          Recent Activity
        </h3>
        {stats.recentActivity.length > 0 ? (
          <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {stats.recentActivity.map((entry, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/5 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    entry.action.includes("accept") ? "bg-emerald-500/60" :
                    entry.action.includes("reject") ? "bg-red-500/60" :
                    "bg-muted-foreground/20"
                  }`} />
                  <span className="text-xs font-mono text-foreground/50">{entry.action}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/30 font-mono">
                  {new Date(entry.time).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground/30 text-center py-8">No activity recorded yet</p>
        )}
      </motion.div>
    </div>
  );
}
