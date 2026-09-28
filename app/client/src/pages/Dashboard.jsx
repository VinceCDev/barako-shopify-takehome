import { useEffect, useState } from 'react';
import {
  AlertCircleIcon,
  PersonIcon,
  OrderIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ProductIcon,
  ClockIcon,
} from '@shopify/polaris-icons';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { apiFetch } from '../api/client.js';

const INVENTORY_COLORS = { Critical: '#C22A2A', Low: '#B4650C', OK: '#1F9254' };
const TIER_COLORS = { VIP: '#1F9254', Regular: '#1F5FD1', New: '#6B3FA0', 'At risk': '#C22A2A' };
const STATUS_COLORS = { Unfulfilled: '#C22A2A', 'In progress': '#B4650C', Fulfilled: '#1F9254' };
const SNAPSHOT_KEY = 'barako:lastDashboardSummary';

/*
 * DOCU: The app's landing page. Top row: four at-a-glance totals
 * (products, customers, open orders, logged activity). Middle row:
 * one colored-icon card per module with its key stats and a real
 * "since last visit" trend (compared against the last summary this
 * browser saw, stored in localStorage — never fabricated). Bottom:
 * four charts covering all three modules' current state. A "Refresh"
 * button re-syncs from Shopify and recomputes everything in one call.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function Dashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [previous, setPrevious] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/dashboard/summary');
      let priorSnapshot = null;
      try {
        priorSnapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
      } catch {
        priorSnapshot = null;
      }
      setPrevious(priorSnapshot);
      setSummary(data);
      try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data));
      } catch {
        // Private browsing / storage disabled — trend just won't persist.
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await apiFetch('/api/sync', { method: 'POST' });
      await loadSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  const inventoryChartData = summary
    ? [
        { level: 'Critical', count: summary.inventory.critical },
        { level: 'Low', count: summary.inventory.low },
        { level: 'OK', count: summary.inventory.ok },
      ]
    : [];

  const loyaltyChartData = summary
    ? [
        { tier: 'VIP', count: summary.loyalty.vip },
        { tier: 'Regular', count: summary.loyalty.regular },
        { tier: 'New', count: summary.loyalty.new },
        { tier: 'At risk', count: summary.loyalty.atRisk },
      ].filter((row) => row.count > 0)
    : [];

  const statusChartData = summary
    ? [
        { status: 'Unfulfilled', count: summary.fulfillment.unfulfilled },
        { status: 'In progress', count: summary.fulfillment.inProgress },
        { status: 'Fulfilled', count: summary.fulfillment.fulfilled },
      ].filter((row) => row.count > 0)
    : [];

  const topProductsData = summary?.topProducts || [];

  return (
    <div>
      <div className="bmt-page-header">
        <div>
          <h1 className="bmt-page-title">Dashboard</h1>
          <p className="bmt-page-subtitle">Barako Merchant Tools — inventory, loyalty, and fulfillment at a glance</p>
        </div>
        <button className="bmt-btn-primary" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Refreshing…' : 'Refresh from Shopify'}
        </button>
      </div>

      {error && (
        <div className="bmt-banner">
          <strong>Something went wrong</strong>
          {error}
        </div>
      )}

      <div className="bmt-stat-grid">
        <QuickStat icon={ProductIcon} color="blue" label="Products tracked" value={summary?.inventory.total} loading={loading} />
        <QuickStat icon={PersonIcon} color="purple" label="Customers tracked" value={summary?.loyalty.total} loading={loading} />
        <QuickStat icon={OrderIcon} color="green" label="Open orders" value={summary?.fulfillment.total} loading={loading} />
        <QuickStat icon={ClockIcon} color="pink" label="Activity logged" value={summary?.activity.total} loading={loading} />
      </div>

      <div className="bmt-stat-grid">
        <ModuleCard
          title="Inventory Alerts"
          icon={AlertCircleIcon}
          color="orange"
          loading={loading}
          trend={trendFor(previous?.inventory?.total, summary?.inventory.total)}
          stats={[
            { label: 'Critical', value: summary?.inventory.critical, tone: 'critical' },
            { label: 'Low', value: summary?.inventory.low, tone: 'warning' },
            { label: 'Products tracked', value: summary?.inventory.total },
          ]}
          onView={() => navigate('/inventory')}
        />
        <ModuleCard
          title="Customer Loyalty"
          icon={PersonIcon}
          color="purple"
          loading={loading}
          trend={trendFor(previous?.loyalty?.total, summary?.loyalty.total)}
          stats={[
            { label: 'VIP', value: summary?.loyalty.vip, tone: 'success' },
            { label: 'At risk', value: summary?.loyalty.atRisk, tone: 'critical' },
            { label: 'Customers tracked', value: summary?.loyalty.total },
          ]}
          onView={() => navigate('/customers')}
        />
        <ModuleCard
          title="Fulfillment Queue"
          icon={OrderIcon}
          color="blue"
          loading={loading}
          trend={trendFor(previous?.fulfillment?.total, summary?.fulfillment.total)}
          stats={[
            { label: 'Unfulfilled', value: summary?.fulfillment.unfulfilled, tone: 'critical' },
            { label: 'In progress', value: summary?.fulfillment.inProgress, tone: 'warning' },
            { label: 'Open orders', value: summary?.fulfillment.total },
          ]}
          onView={() => navigate('/orders')}
        />
      </div>

      <div className="bmt-chart-grid">
        <ChartCard title="Inventory alerts by level" loading={loading} empty={summary && summary.inventory.total === 0}>
          <ResponsiveContainer>
            <BarChart data={inventoryChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="level" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
              <Tooltip />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {inventoryChartData.map((row) => (
                  <Cell key={row.level} fill={INVENTORY_COLORS[row.level]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Loyalty tier distribution" loading={loading} empty={loyaltyChartData.length === 0}>
          <PieChart>
            <Pie data={loyaltyChartData} dataKey="count" nameKey="tier" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {loyaltyChartData.map((row) => (
                <Cell key={row.tier} fill={TIER_COLORS[row.tier]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>
      </div>

      <div className="bmt-chart-grid">
        <ChartCard title="Top 5 fastest-selling products" loading={loading} empty={topProductsData.length === 0}>
          <BarChart data={topProductsData} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" allowDecimals tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="title" width={140} tickLine={false} axisLine={false} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => [`${value}/day`, 'Sales velocity']} />
            <Bar dataKey="salesVelocity" fill="#8a4b0f" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Fulfillment status" loading={loading} empty={statusChartData.length === 0}>
          <PieChart>
            <Pie data={statusChartData} dataKey="count" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
              {statusChartData.map((row) => (
                <Cell key={row.status} fill={STATUS_COLORS[row.status]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>
      </div>
    </div>
  );
}

/*
 * DOCU: Wraps a recharts chart in the standard card shell — title,
 * loading state, and an empty-state message when there's nothing to
 * plot yet (e.g. before the first sync) rather than an empty axis.
 * @param {Object} props
 * @param {string} props.title
 * @param {boolean} props.loading
 * @param {boolean} props.empty
 * @param {JSX.Element} props.children - A single recharts chart element.
 * @returns {JSX.Element}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
function ChartCard({ title, loading, empty, children }) {
  return (
    <div className="bmt-card">
      <h2 className="bmt-chart-title">{title}</h2>
      {loading ? (
        <div className="bmt-chart-empty">Loading…</div>
      ) : empty ? (
        <div className="bmt-chart-empty">No data yet — click Refresh from Shopify.</div>
      ) : (
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/*
 * DOCU: Compares this load's total against the last summary this
 * browser saw (from localStorage) so the module cards can show a real
 * "since last visit" delta instead of a fabricated one.
 * @param {number|undefined} previousTotal
 * @param {number|undefined} currentTotal
 * @returns {{direction: 'up'|'down'|'flat', delta: number}|null}
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
function trendFor(previousTotal, currentTotal) {
  if (previousTotal == null || currentTotal == null) return null;
  const delta = currentTotal - previousTotal;
  if (delta > 0) return { direction: 'up', delta };
  if (delta < 0) return { direction: 'down', delta };
  return { direction: 'flat', delta: 0 };
}

const QUICK_STAT_PALETTE = {
  blue: { bg: '#E8F1FF', fg: '#1F5FD1' },
  purple: { bg: '#F1ECFD', fg: '#6B3FA0' },
  green: { bg: '#E3F9EA', fg: '#1F9254' },
  pink: { bg: '#FDEEF4', fg: '#C0397B' },
};

function QuickStat({ icon: Icon, color, label, value, loading }) {
  const palette = QUICK_STAT_PALETTE[color];
  return (
    <div className="bmt-card bmt-stat-card">
      <div>
        <p className="bmt-stat-label">{label}</p>
        <p className="bmt-stat-value">{loading ? '…' : value ?? 0}</p>
      </div>
      <div className="bmt-icon-badge" style={{ background: palette.bg }}>
        <Icon style={{ fill: palette.fg }} />
      </div>
    </div>
  );
}

const MODULE_PALETTE = {
  orange: { bg: '#FFF2E3', fg: '#B4650C' },
  purple: { bg: '#F1ECFD', fg: '#6B3FA0' },
  blue: { bg: '#E8F1FF', fg: '#1F5FD1' },
};

function ModuleCard({ title, icon: Icon, color, stats, loading, trend, onView }) {
  const palette = MODULE_PALETTE[color];

  return (
    <div className="bmt-card">
      <div className="bmt-module-card-header">
        <div>
          <h2 className="bmt-module-card-title">{title}</h2>
          {trend && !loading && <TrendLine trend={trend} />}
        </div>
        <div className="bmt-icon-badge" style={{ background: palette.bg }}>
          <Icon style={{ fill: palette.fg }} />
        </div>
      </div>
      {stats.map((stat) => (
        <div key={stat.label} className="bmt-module-stat-row">
          <span style={{ color: '#6d7175' }}>{stat.label}</span>
          {stat.tone ? (
            <span
              className={`bmt-pill bmt-pill-${
                stat.tone === 'critical' ? 'critical' : stat.tone === 'warning' ? 'warning' : stat.tone === 'success' ? 'success' : 'subdued'
              }`}
            >
              {loading ? '…' : stat.value ?? 0}
            </span>
          ) : (
            <span style={{ fontWeight: 600 }}>{loading ? '…' : stat.value ?? 0}</span>
          )}
        </div>
      ))}
      <div style={{ marginTop: '0.75rem' }}>
        <button className="bmt-link" onClick={onView}>
          View details
        </button>
      </div>
    </div>
  );
}

function TrendLine({ trend }) {
  if (trend.direction === 'flat') {
    return <div className="bmt-stat-trend flat">No change since last visit</div>;
  }
  const Icon = trend.direction === 'up' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <div className={`bmt-stat-trend ${trend.direction}`}>
      <Icon style={{ width: 12, height: 12, fill: 'currentColor' }} />
      {Math.abs(trend.delta)} since last visit
    </div>
  );
}
