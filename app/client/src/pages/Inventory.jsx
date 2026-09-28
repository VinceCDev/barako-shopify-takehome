import { useEffect, useState, useCallback, useMemo } from 'react';
import { Modal, TextField, BlockStack } from '@shopify/polaris';
import { AlertCircleIcon, AlertTriangleIcon, CheckCircleIcon, SearchIcon } from '@shopify/polaris-icons';
import { apiFetch } from '../api/client.js';
import Pagination from '../components/Pagination.jsx';

const PAGE_SIZE = 5;
const ALERT_PILL = { critical: 'critical', low: 'warning', ok: 'success' };
const ALERT_FILTERS = [
  { value: 'all', label: 'All levels' },
  { value: 'critical', label: 'Critical' },
  { value: 'low', label: 'Low' },
  { value: 'ok', label: 'OK' },
];
const REORDER_FILTERS = [
  { value: 'all', label: 'All products' },
  { value: 'needed', label: 'Reorder needed' },
  { value: 'not_needed', label: 'No reorder needed' },
];
const SORT_OPTIONS = [
  { value: 'stock_asc', label: 'Sort: Stock (low to high)' },
  { value: 'stockout_asc', label: 'Sort: Days until stockout' },
  { value: 'velocity_desc', label: 'Sort: Fastest-selling' },
  { value: 'name_asc', label: 'Sort: Name (A–Z)' },
];

/*
 * DOCU: Module 1 — Low-Stock & Reorder Alerts. Lists every product with
 * its live-computed alert level and recommended reorder quantity, and
 * lets a merchant either tune the per-product reorder settings the
 * recommendation is based on, or log that they've placed a reorder.
 * Includes a search box and an alert-level filter — both client-side,
 * since a merchant's product catalog here is small enough that a
 * round trip to the server for filtering would be wasted latency.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [reorderingProduct, setReorderingProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [reorderFilter, setReorderFilter] = useState('all');
  const [sortBy, setSortBy] = useState('stock_asc');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await apiFetch('/api/inventory'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const criticalCount = products.filter((p) => p.alertLevel === 'critical').length;
  const lowCount = products.filter((p) => p.alertLevel === 'low').length;
  const okCount = products.filter((p) => p.alertLevel === 'ok').length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = products.filter((product) => {
      if (levelFilter !== 'all' && product.alertLevel !== levelFilter) return false;
      if (reorderFilter === 'needed' && !(product.recommendedReorderQty > 0)) return false;
      if (reorderFilter === 'not_needed' && product.recommendedReorderQty > 0) return false;
      if (!term) return true;
      return product.title.toLowerCase().includes(term) || (product.sku || '').toLowerCase().includes(term);
    });

    const sorted = [...rows];
    if (sortBy === 'stock_asc') sorted.sort((a, b) => a.currentStock - b.currentStock);
    else if (sortBy === 'stockout_asc') {
      sorted.sort((a, b) => (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity));
    } else if (sortBy === 'velocity_desc') sorted.sort((a, b) => b.salesVelocity - a.salesVelocity);
    else if (sortBy === 'name_asc') sorted.sort((a, b) => a.title.localeCompare(b.title));

    return sorted;
  }, [products, search, levelFilter, reorderFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, levelFilter, reorderFilter, sortBy]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <div className="bmt-page-header">
        <div>
          <h1 className="bmt-page-title">Inventory Alerts</h1>
          <p className="bmt-page-subtitle">Sales-velocity-based reorder recommendations</p>
        </div>
      </div>

      {error && (
        <div className="bmt-banner">
          <strong>Something went wrong</strong>
          {error}
        </div>
      )}

      <div className="bmt-stat-grid">
        <StatCard icon={AlertCircleIcon} color="red" label="Critical" value={criticalCount} loading={loading} />
        <StatCard icon={AlertTriangleIcon} color="orange" label="Low" value={lowCount} loading={loading} />
        <StatCard icon={CheckCircleIcon} color="green" label="OK" value={okCount} loading={loading} />
      </div>

      <div className="bmt-toolbar">
        <div className="bmt-search">
          <SearchIcon className="bmt-search-icon" aria-hidden="true" />
          <label htmlFor="inventory-search" className="bmt-visually-hidden">
            Search products or SKU
          </label>
          <input
            id="inventory-search"
            type="search"
            placeholder="Search products or SKU…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="bmt-filter-group">
          <select
            className="bmt-select"
            aria-label="Filter by alert level"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
          >
            {ALERT_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="bmt-select"
            aria-label="Filter by reorder status"
            value={reorderFilter}
            onChange={(event) => setReorderFilter(event.target.value)}
          >
            {REORDER_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="bmt-select"
            aria-label="Sort products"
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
                <th>Product</th>
                <th>In stock</th>
                <th>Sales velocity</th>
                <th>Days until stockout</th>
                <th>Alert</th>
                <th>Recommended reorder</th>
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
                    No products match your search.
                  </td>
                </tr>
              ) : (
                pageRows.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="bmt-row-title">{product.title}</div>
                      <div className="bmt-row-subtitle">{product.sku || 'No SKU'}</div>
                    </td>
                    <td>{product.currentStock}</td>
                    <td>{product.salesVelocity.toFixed(2)}/day</td>
                    <td>{product.daysUntilStockout != null ? `${product.daysUntilStockout.toFixed(1)} days` : '—'}</td>
                    <td>
                      <span className={`bmt-pill bmt-pill-${ALERT_PILL[product.alertLevel]}`}>
                        {product.alertLevel.toUpperCase()}
                      </span>
                    </td>
                    <td>{product.recommendedReorderQty || '—'}</td>
                    <td>
                      <div className="bmt-table-actions">
                        <button className="bmt-btn-ghost" onClick={() => setEditingProduct(product)}>
                          Settings
                        </button>
                        {product.recommendedReorderQty > 0 && (
                          <button className="bmt-btn-ghost" onClick={() => setReorderingProduct(product)}>
                            Log reorder
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} />
      </div>

      {editingProduct && (
        <SettingsModal product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={load} />
      )}
      {reorderingProduct && (
        <ReorderModal product={reorderingProduct} onClose={() => setReorderingProduct(null)} onLogged={load} />
      )}
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, loading }) {
  const palette = {
    red: { bg: '#FCE9E9', fg: '#C22A2A' },
    orange: { bg: '#FFF2E3', fg: '#B4650C' },
    green: { bg: '#E3F9EA', fg: '#1F9254' },
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

function SettingsModal({ product, onClose, onSaved }) {
  const [reorderThreshold, setReorderThreshold] = useState(String(product.reorderThreshold));
  const [leadTimeDays, setLeadTimeDays] = useState(String(product.leadTimeDays));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch(`/api/inventory/${product.id}`, {
        method: 'PATCH',
        body: { reorderThreshold: Number(reorderThreshold), leadTimeDays: Number(leadTimeDays) },
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reorder settings — ${product.title}`}
      primaryAction={{ content: 'Save', onAction: handleSave, loading: saving }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          <TextField
            label="Low-stock threshold (days of stock)"
            type="number"
            value={reorderThreshold}
            onChange={setReorderThreshold}
            helpText="Below this many days of stock left, the product is flagged Low."
            autoComplete="off"
          />
          <TextField
            label="Supplier lead time (days)"
            type="number"
            value={leadTimeDays}
            onChange={setLeadTimeDays}
            helpText="How many days it takes a reorder to arrive — the recommended quantity covers this much demand."
            autoComplete="off"
          />
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

function ReorderModal({ product, onClose, onLogged }) {
  const [quantity, setQuantity] = useState(String(product.recommendedReorderQty));
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    setSaving(true);
    try {
      await apiFetch(`/api/inventory/${product.id}/reorder`, {
        method: 'POST',
        body: { quantity: Number(quantity) },
      });
      onLogged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Log a reorder — ${product.title}`}
      primaryAction={{ content: 'Log reorder', onAction: handleConfirm, loading: saving }}
      secondaryActions={[{ content: 'Cancel', onAction: onClose }]}
    >
      <Modal.Section>
        <TextField
          label="Quantity ordered"
          type="number"
          value={quantity}
          onChange={setQuantity}
          autoComplete="off"
        />
      </Modal.Section>
    </Modal>
  );
}
