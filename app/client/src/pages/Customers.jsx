import { useEffect, useState, useCallback, useMemo } from 'react';
import { StarIcon, PersonIcon, AlertCircleIcon, SearchIcon } from '@shopify/polaris-icons';
import { apiFetch } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 5;
const TIER_PILL = { vip: 'success', regular: 'info', at_risk: 'critical', new: 'subdued' };
const TIER_LABEL = { vip: 'VIP', regular: 'Regular', at_risk: 'At risk', new: 'New' };
const TIER_FILTERS = [
  { value: 'all', label: 'All tiers' },
  { value: 'vip', label: 'VIP' },
  { value: 'regular', label: 'Regular' },
  { value: 'new', label: 'New' },
  { value: 'at_risk', label: 'At risk' },
];
const ORDER_HISTORY_FILTERS = [
  { value: 'all', label: 'All customers' },
  { value: 'has_ordered', label: 'Has ordered' },
  { value: 'no_orders', label: 'No orders yet' },
];
const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Sort: Highest score' },
  { value: 'spent_desc', label: 'Sort: Total spent' },
  { value: 'recent_desc', label: 'Sort: Most recent order' },
  { value: 'name_asc', label: 'Sort: Name (A–Z)' },
];

/*
 * DOCU: Module 2 — Customer Loyalty Scoring. Ranks every customer by an
 * RFM-style loyalty score (see server/services/loyaltyLogic.js) and
 * tier, so a merchant can spot who to reward (VIP) and who to win back
 * (at risk) without digging through raw order history.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recomputingId, setRecomputingId] = useState(null);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('score_desc');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await apiFetch('/api/customers'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const vipCount = customers.filter((c) => c.loyaltyTier === 'vip').length;
  const atRiskCount = customers.filter((c) => c.loyaltyTier === 'at_risk').length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = customers.filter((customer) => {
      if (tierFilter !== 'all' && customer.loyaltyTier !== tierFilter) return false;
      if (historyFilter === 'has_ordered' && !(customer.orderCount > 0)) return false;
      if (historyFilter === 'no_orders' && customer.orderCount > 0) return false;
      if (!term) return true;
      const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').toLowerCase();
      return name.includes(term) || (customer.email || '').toLowerCase().includes(term);
    });

    const sorted = [...rows];
    if (sortBy === 'score_desc') sorted.sort((a, b) => b.loyaltyScore - a.loyaltyScore);
    else if (sortBy === 'spent_desc') sorted.sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent));
    else if (sortBy === 'recent_desc') {
      sorted.sort((a, b) => new Date(b.lastOrderAt || 0) - new Date(a.lastOrderAt || 0));
    } else if (sortBy === 'name_asc') {
      sorted.sort((a, b) =>
        [a.firstName, a.lastName].join(' ').localeCompare([b.firstName, b.lastName].join(' '))
      );
    }

    return sorted;
  }, [customers, search, tierFilter, historyFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, tierFilter, historyFilter, sortBy]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleRecompute(customerId) {
    setRecomputingId(customerId);
    try {
      await apiFetch(`/api/customers/${customerId}/recompute`, { method: 'POST' });
      await load();
    } finally {
      setRecomputingId(null);
    }
  }

  return (
    <div>
      <div className="bmt-page-header">
        <div>
          <h1 className="bmt-page-title">Customer Loyalty</h1>
          <p className="bmt-page-subtitle">RFM-style scoring — recency, frequency, and spend</p>
        </div>
      </div>

      {error && (
        <div className="bmt-banner">
          <strong>Something went wrong</strong>
          {error}
        </div>
      )}

      <div className="bmt-stat-grid">
        <StatCard icon={StarIcon} color="green" label="VIP" value={vipCount} loading={loading} />
        <StatCard icon={AlertCircleIcon} color="red" label="At risk" value={atRiskCount} loading={loading} />
        <StatCard icon={PersonIcon} color="purple" label="Customers tracked" value={customers.length} loading={loading} />
      </div>

      <div className="bmt-toolbar">
        <div className="bmt-search">
          <SearchIcon className="bmt-search-icon" aria-hidden="true" />
          <label htmlFor="customer-search" className="bmt-visually-hidden">
            Search customers
          </label>
          <input
            id="customer-search"
            type="search"
            placeholder="Search customers…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="bmt-filter-group">
          <select
            className="bmt-select"
            aria-label="Filter by loyalty tier"
            value={tierFilter}
            onChange={(event) => setTierFilter(event.target.value)}
          >
            {TIER_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="bmt-select"
            aria-label="Filter by order history"
            value={historyFilter}
            onChange={(event) => setHistoryFilter(event.target.value)}
          >
            {ORDER_HISTORY_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="bmt-select"
            aria-label="Sort customers"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bmt-table-card">
        <div className="bmt-table-scroll">
          <table className="bmt-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>Last order</th>
                <th>Score</th>
                <th>Tier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="bmt-table-empty">
                    Loading…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="bmt-table-empty">
                    No customers match your search.
                  </td>
                </tr>
              ) : (
                pageRows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <div className="bmt-row-title">
                        {[customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'Unnamed customer'}
                      </div>
                      <div className="bmt-row-subtitle">{customer.email || 'No email on file'}</div>
                    </td>
                    <td>{customer.orderCount}</td>
                    <td>${Number(customer.totalSpent).toFixed(2)}</td>
                    <td>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString() : 'Never'}</td>
                    <td>{customer.loyaltyScore.toFixed(1)}</td>
                    <td>
                      <span className={`bmt-pill bmt-pill-${TIER_PILL[customer.loyaltyTier]}`}>
                        {TIER_LABEL[customer.loyaltyTier]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="bmt-btn-ghost"
                        disabled={recomputingId === customer.id}
                        onClick={() => handleRecompute(customer.id)}
                      >
                        {recomputingId === customer.id ? 'Recomputing…' : 'Recompute'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, loading }) {
  const palette = {
    red: { bg: '#FCE9E9', fg: '#C22A2A' },
    green: { bg: '#E3F9EA', fg: '#1F9254' },
    purple: { bg: '#F1ECFD', fg: '#6B3FA0' },
  }[color];

  return (
    <div className="bmt-card bmt-stat-card">
      <div>
        <p className="bmt-stat-label">{label}</p>
        <p className="bmt-stat-value">{loading ? '…' : value}</p>
      </div>
      <div className="bmt-icon-badge" style={{ background: palette.bg }}>
        <Icon style={{ fill: palette.fg }} />
      </div>
    </div>
  );
}
