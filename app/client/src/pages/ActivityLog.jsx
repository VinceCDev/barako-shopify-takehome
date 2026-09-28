import { useEffect, useState } from 'react';
import { AlertCircleIcon, PersonIcon, OrderIcon, SettingsIcon } from '@shopify/polaris-icons';
import { apiFetch } from '../api/client.js';

const MODULE_PILL = { inventory: 'warning', loyalty: 'success', fulfillment: 'info', system: 'subdued' };
const MODULE_LABEL = { inventory: 'Inventory', loyalty: 'Loyalty', fulfillment: 'Fulfillment', system: 'System' };
const MODULE_ICON = { inventory: AlertCircleIcon, loyalty: PersonIcon, fulfillment: OrderIcon, system: SettingsIcon };
const MODULE_COLOR = {
  inventory: { bg: '#FFF2E3', fg: '#B4650C' },
  loyalty: { bg: '#F1ECFD', fg: '#6B3FA0' },
  fulfillment: { bg: '#E8F1FF', fg: '#1F5FD1' },
  system: { bg: '#F1F1F1', fg: '#5C5F62' },
};

/*
 * DOCU: The unified Activity/history feed — every event logged by any of
 * the three modules (plus install/uninstall), newest first. One shared
 * table (activity_logs) and one page, rather than a separate history
 * view per module, so a merchant has a single place to see "what has
 * this app actually done."
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function ActivityLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch('/api/activity')
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="bmt-page-header">
        <div>
          <h1 className="bmt-page-title">Activity</h1>
          <p className="bmt-page-subtitle">A unified history of everything this app has logged</p>
        </div>
      </div>

      {error && (
        <div className="bmt-banner">
          <strong>Something went wrong</strong>
          {error}
        </div>
      )}

      <div className="bmt-table-card">
        {loading ? (
          <div className="bmt-table-empty">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="bmt-table-empty">No activity logged yet.</div>
        ) : (
          entries.map((entry) => {
            const Icon = MODULE_ICON[entry.module];
            const palette = MODULE_COLOR[entry.module];
            return (
              <div className="bmt-activity-item" key={entry.id}>
                <div className="bmt-activity-left">
                  <div className="bmt-activity-icon" style={{ background: palette.bg }}>
                    <Icon style={{ fill: palette.fg }} />
                  </div>
                  <div>
                    <span className={`bmt-pill bmt-pill-${MODULE_PILL[entry.module]}`} style={{ marginRight: '0.5rem' }}>
                      {MODULE_LABEL[entry.module]}
                    </span>
                    <span className="bmt-activity-message">{entry.message}</span>
                  </div>
                </div>
                <span className="bmt-activity-time">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
