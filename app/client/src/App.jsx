import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, AlertCircleIcon, PersonIcon, OrderIcon, ClockIcon } from '@shopify/polaris-icons';
import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import Customers from './pages/Customers.jsx';
import Orders from './pages/Orders.jsx';
import ActivityLog from './pages/ActivityLog.jsx';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: HomeIcon, bg: '#E8F1FF', fg: '#1F5FD1' },
  { label: 'Inventory Alerts', path: '/inventory', icon: AlertCircleIcon, bg: '#FFF2E3', fg: '#B4650C' },
  { label: 'Customer Loyalty', path: '/customers', icon: PersonIcon, bg: '#F1ECFD', fg: '#6B3FA0' },
  { label: 'Fulfillment Queue', path: '/orders', icon: OrderIcon, bg: '#E3F9EA', fg: '#1F9254' },
  { label: 'Activity', path: '/activity', icon: ClockIcon, bg: '#FDEEF4', fg: '#C0397B' },
];

/*
 * DOCU: The app's shell — a fixed left sidebar (brand + nav) and a
 * scrollable content area on the right where each route renders. Built
 * as plain flex/CSS (see styles.css) rather than Polaris's Frame +
 * Navigation, so the sidebar can carry the app's own colored icon
 * badges and match the rest of the custom dashboard styling.
 *
 * Last Updated: 2026-09-28
 * Author: Vince Allen
 * Last Updated By: Vince Allen
 */
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="bmt-shell">
      <aside className="bmt-sidebar">
        <div className="bmt-sidebar-brand">
          <span className="bmt-sidebar-brand-icon">B</span>
          <span>Barako Tools</span>
        </div>
        <div className="bmt-sidebar-section-label">Main</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              className={`bmt-nav-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(item.path)}
            >
              <Icon className="bmt-nav-icon" style={{ background: item.bg, fill: item.fg }} />
              {item.label}
            </button>
          );
        })}
      </aside>
      <main className="bmt-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/activity" element={<ActivityLog />} />
        </Routes>
      </main>
    </div>
  );
}
