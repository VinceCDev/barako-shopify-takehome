import { useEffect, useState, useCallback, useMemo } from 'react';
import { AlertCircleIcon, ClockIcon, CheckCircleIcon, SearchIcon } from '@shopify/polaris-icons';
import { apiFetch } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 5;
const STATUS_PILL = { unfulfilled: 'critical', in_progress: 'warning', fulfilled: 'success' };
const STATUS_OPTIONS = [
  { label: 'Unfulfilled', value: 'unfulfilled' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Fulfilled', value: 'fulfilled' },
];
const STATUS_FILTERS = [{ value: 'all', label: 'All statuses' }, ...STATUS_OPTIONS];
const TIER_FILTERS = [
  { value: 'all', label: 'All customer tiers' },
  { value: 'vip', label: 'VIP' },
  { value: 'regular', label: 'Regular' },
  { value: 'new', label: 'New' },
  { value: 'at_risk', label: 'At risk' },
];
const SORT_OPTIONS = [
  { value: 'priority_desc', label: 'Sort: Highest priority' },
  { value: 'total_desc', label: 'Sort: Order total' },
  { value: 'placed_asc', label: 'Sort: Oldest first' },
];

/*
 * DOCU: Module 3 — Order Fulfillment Priority Queue. Ranks open orders
 * by a computed priority score (order age + value + customer loyalty
 * tier — see server/services/fulfillmentLogic.js), so a merchant packs
 * the order that matters most next, not just the oldest or newest one.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sortBy, setSortBy] = useState('priority_desc');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await apiFetch('/api/orders'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unfulfilledCount = orders.filter((o) => o.fulfillmentStatus === 'unfulfilled').length;
  const inProgressCount = orders.filter((o) => o.fulfillmentStatus === 'in_progress').length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = orders.filter((order) => {
      if (statusFilter !== 'all' && order.fulfillmentStatus !== statusFilter) return false;
      if (tierFilter !== 'all' && order.customerTier !== tierFilter) return false;
      if (!term) return true;
      return (order.orderNumber || `#${order.id}`).toLowerCase().includes(term);
    });

    const sorted = [...rows];
    if (sortBy === 'priority_desc') sorted.sort((a, b) => b.priorityScore - a.priorityScore);
    else if (sortBy === 'total_desc') sorted.sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice));
    else if (sortBy === 'placed_asc') {
      sorted.sort((a, b) => new Date(a.shopifyCreatedAt) - new Date(b.shopifyCreatedAt));
    }

    return sorted;
  }, [orders, search, statusFilter, tierFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, tierFilter, sortBy]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleStatusChange(orderId, status) {
    setUpdatingId(orderId);
    try {
      await apiFetch(`/api/orders/${orderId}/status`, { method: 'PATCH', body: { status } });
      await load();
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <div className="bmt-page-header">
        <div>
          <h1 className="bmt-page-title">Fulfillment Queue</h1>
          <p className="bmt-page-subtitle">Priority-ranked by order age, value, and customer tier</p>
        </div>
      </div>

      {error && (
        <div className="bmt-banner">
          <strong>Something went wrong</strong>
          {error}
        </div>
      )}

      <div className="bmt-stat-grid">
        <StatCard icon={AlertCircleIcon} color="red" label="Unfulfilled" value={unfulfilledCount} loading={loading} />
        <StatCard icon={ClockIcon} color="orange" label="In progress" value={inProgressCount} loading={loading} />
        <StatCard icon={CheckCircleIcon} color="blue" label="Open orders" value={orders.length} loading={loading} />
      </div>

      <div className="bmt-toolbar">
        <div className="bmt-search">
          <SearchIcon className="bmt-search-icon" aria-hidden="true" />
          <label htmlFor="order-search" className="bmt-visually-hidden">
            Search order number
          </label>
          <input
            id="order-search"
            type="search"
            placeholder="Search order number…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="bmt-filter-group">
          <select
            className="bmt-select"
            aria-label="Filter by fulfillment status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="bmt-select"
            aria-label="Filter by customer tier"
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
            aria-label="Sort orders"
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
                <th>Order</th>
                <th>Placed</th>
                <th>Total</th>
                <th>Customer tier</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Update</th>
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
                    No orders match your search.
                  </td>
                </tr>
              ) : (
                pageRows.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div className="bmt-row-title">{order.orderNumber || `#${order.id}`}</div>
                    </td>
                    <td>{new Date(order.shopifyCreatedAt).toLocaleDateString()}</td>
                    <td>${Number(order.totalPrice).toFixed(2)}</td>
                    <td>
                      {order.customerTier ? (
                        <span className={`bmt-pill bmt-pill-${order.customerTier === 'vip' ? 'success' : 'info'}`}>
                          {order.customerTier}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{order.priorityScore.toFixed(1)}</td>
                    <td>
                      <span className={`bmt-pill bmt-pill-${STATUS_PILL[order.fulfillmentStatus]}`}>
                        {order.fulfillmentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <select
                        className="bmt-select-native"
                        value={order.fulfillmentStatus}
                        disabled={updatingId === order.id}
                        onChange={(event) => handleStatusChange(order.id, event.target.value)}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
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
    orange: { bg: '#FFF2E3', fg: '#B4650C' },
    blue: { bg: '#E8F1FF', fg: '#1F5FD1' },
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
