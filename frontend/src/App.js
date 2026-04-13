import { useState, useEffect, useCallback } from 'react';
import {
  createParty,
  getActiveContracts,
  submitApplication,
  withdrawApplication,
  reviewApplication,
  addPoints,
  redeemPoints,
} from './api';
import './App.css';

// ── helpers ───────────────────────────────────────────────────
const short = (id) => (id ? `${id.slice(0, 8)}…` : '—');
const toast = (set, msg, type = 'info') => {
  set({ msg, type });
  setTimeout(() => set(null), 3500);
};

// ── components ────────────────────────────────────────────────

function Toast({ data }) {
  if (!data) return null;
  return <div className={`toast toast-${data.type}`}>{data.msg}</div>;
}

function SetupScreen({ onReady }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    try {
      const [customer, airline] = await Promise.all([
        createParty('Customer'),
        createParty('Airline'),
      ]);
      onReady(customer, airline);
    } catch (e) {
      setError('Failed to connect to Canton. Is sandbox running on port 7575?');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="logo-mark">✦</div>
        <h1 className="setup-title">Canton Loyalty</h1>
        <p className="setup-sub">
          Customer loyalty program powered by<br />
          DAML smart contracts on Canton.
        </p>
        {error && <p className="setup-error">{error}</p>}
        <button className="btn-primary btn-lg" onClick={handleSetup} disabled={loading}>
          {loading ? <span className="spinner" /> : 'Initialise Ledger'}
        </button>
        <p className="setup-hint">
          Make sure <code>daml sandbox --json-api-port 7575</code> is running
        </p>
      </div>
    </div>
  );
}

function PartyBadge({ label, partyId, color }) {
  return (
    <div className="party-badge" style={{ '--badge-color': color }}>
      <span className="party-label">{label}</span>
      <span className="party-id" title={partyId}>{short(partyId)}</span>
    </div>
  );
}

function PointsBar({ points, max = 1000 }) {
  const pct = Math.min((points / max) * 100, 100);
  return (
    <div className="points-bar-wrap">
      <div className="points-bar">
        <div className="points-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="points-pct">{points} pts</span>
    </div>
  );
}

function ApplicationCard({ contract, actions }) {
  const args = contract.createArgument || {};
  return (
    <div className="card">
      <div className="card-header">
        <span className="pill pill-pending">Pending Review</span>
        <span className="contract-id">{short(contract.contractId)}</span>
      </div>
      <div className="card-body">
        <div className="card-name">{args.customerName}</div>
        <div className="card-meta-row">
          <span className="meta-label">ID</span>
          <code>{args.customerId}</code>
        </div>
        <div className="card-meta-row">
          <span className="meta-label">Email</span>
          <span className="meta-val">{args.email}</span>
        </div>
      </div>
      {actions?.length > 0 && (
        <div className="card-actions">
          {actions.map(a => (
            <button
              key={a.label}
              className={`btn-action ${a.danger ? 'btn-danger' : a.success ? 'btn-success' : 'btn-accent'}`}
              onClick={() => a.onClick(contract.contractId)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountCard({ contract, actions, addPointsModal }) {
  const args = contract.createArgument || {};
  return (
    <div className="card card-account">
      <div className="card-header">
        <span className="pill pill-approved">Active Member</span>
        <span className="contract-id">{short(contract.contractId)}</span>
      </div>
      <div className="card-body">
        <div className="card-name">{args.customerName}</div>
        <div className="card-meta-row">
          <span className="meta-label">Member ID</span>
          <code>{args.customerId}</code>
        </div>
        <div className="card-meta-row">
          <span className="meta-label">Email</span>
          <span className="meta-val">{args.email}</span>
        </div>
        <PointsBar points={args.points || 0} />
      </div>
      {actions?.length > 0 && (
        <div className="card-actions">
          {actions.map(a => (
            <button
              key={a.label}
              className={`btn-action ${a.danger ? 'btn-danger' : a.success ? 'btn-success' : 'btn-accent'}`}
              onClick={() => a.onClick(contract.contractId, args.points)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPointsModal({ contractId, onAdd, onClose }) {
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!points) return;
    setLoading(true);
    try { await onAdd(contractId, parseInt(points)); onClose(); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Add Points</h3>
        <input className="field-input" type="number" min="1" placeholder="Points to add" value={points} onChange={e => setPoints(e.target.value)} />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handle} disabled={loading || !points}>
            {loading ? <span className="spinner" /> : 'Add Points'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RedeemModal({ contractId, currentPoints, onRedeem, onClose }) {
  const [points, setPoints] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!points) return;
    setLoading(true);
    try { await onRedeem(contractId, parseInt(points)); onClose(); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3 className="modal-title">Redeem Points</h3>
        <p className="modal-sub">You have <strong>{currentPoints}</strong> points available</p>
        <input className="field-input" type="number" min="1" max={currentPoints} placeholder="Points to redeem" value={points} onChange={e => setPoints(e.target.value)} />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handle} disabled={loading || !points || parseInt(points) > currentPoints}>
            {loading ? <span className="spinner" /> : 'Redeem'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ApplyForm({ customer, airline, onCreated, setToast }) {
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerId || !customerName || !email) return;
    setLoading(true);
    try {
      await submitApplication(customer, airline, customerId, customerName, email);
      toast(setToast, 'Application submitted!', 'success');
      setCustomerId(''); setCustomerName(''); setEmail('');
      onCreated();
    } catch (err) {
      toast(setToast, 'Failed to submit application', 'error');
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <form className="create-form" onSubmit={handleSubmit}>
      <h3 className="form-title">✦ Apply for Loyalty Membership</h3>
      <div className="field-row">
        <input className="field-input" placeholder="Member ID (e.g. CUS001)" value={customerId} onChange={e => setCustomerId(e.target.value)} />
        <input className="field-input" placeholder="Full name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
        <input className="field-input" placeholder="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="btn-primary" type="submit" disabled={loading || !customerId || !customerName || !email}>
          {loading ? <span className="spinner" /> : 'Apply →'}
        </button>
      </div>
    </form>
  );
}

function CustomerView({ customer, airline, setToast }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [redeemModal, setRedeemModal] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getActiveContracts(customer, [airline]);
      setContracts(all);
    } catch (e) { toast(setToast, 'Failed to fetch contracts', 'error'); }
    finally { setLoading(false); }
  }, [customer, airline, setToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const applications = contracts.filter(c => c.templateId?.includes('CLPApplication'));
  const accounts = contracts.filter(c => c.templateId?.includes('CLPAccount'));

  const handleWithdraw = async (contractId) => {
    try {
      await withdrawApplication(customer, contractId);
      toast(setToast, 'Application withdrawn', 'info');
      refresh();
    } catch (e) { toast(setToast, 'Failed to withdraw', 'error'); console.error(e); }
  };

  const handleRedeem = async (contractId, pointsToRedeem) => {
    try {
      await redeemPoints(customer, airline, contractId, pointsToRedeem);
      toast(setToast, `${pointsToRedeem} points redeemed! 🎉`, 'success');
      refresh();
    } catch (e) { toast(setToast, 'Failed to redeem points', 'error'); console.error(e); }
  };

  return (
    <div className="view">
      <ApplyForm customer={customer} airline={airline} onCreated={refresh} setToast={setToast} />

      {redeemModal && (
        <RedeemModal
          contractId={redeemModal.contractId}
          currentPoints={redeemModal.points}
          onRedeem={handleRedeem}
          onClose={() => setRedeemModal(null)}
        />
      )}

      <div className="section-header">
        <h3>My Membership <span className="count">{accounts.length}</span></h3>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
      </div>
      <div className="cards-grid">
        {accounts.length === 0 && <p className="empty-state">No active membership. Apply above or wait for airline approval.</p>}
        {accounts.map(c => (
          <AccountCard
            key={c.contractId}
            contract={c}
            actions={[{
              label: '✦ Redeem Points',
              success: true,
              onClick: (contractId, points) => setRedeemModal({ contractId, points })
            }]}
          />
        ))}
      </div>

      <div className="section-header">
        <h3>Pending Applications <span className="count">{applications.length}</span></h3>
      </div>
      <div className="cards-grid">
        {applications.length === 0 && <p className="empty-state">No pending applications.</p>}
        {applications.map(c => (
          <ApplicationCard
            key={c.contractId}
            contract={c}
            actions={[{ label: '✗ Withdraw', danger: true, onClick: handleWithdraw }]}
          />
        ))}
      </div>
    </div>
  );
}

function AirlineView({ customer, airline, setToast }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [addModal, setAddModal] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getActiveContracts(airline, [customer]);
      setContracts(all);
    } catch (e) { toast(setToast, 'Failed to fetch contracts', 'error'); }
    finally { setLoading(false); }
  }, [airline, customer, setToast]);

  useEffect(() => { refresh(); }, [refresh]);

  const applications = contracts.filter(c => c.templateId?.includes('CLPApplication'));
  const accounts = contracts.filter(c => c.templateId?.includes('CLPAccount'));

  const handleApprove = async (contractId) => {
    try {
      await reviewApplication(airline, customer, contractId);
      toast(setToast, 'Application approved! Member account created.', 'success');
      refresh();
    } catch (e) { toast(setToast, 'Failed to approve', 'error'); console.error(e); }
  };

  const handleAddPoints = async (contractId, pointsToAdd) => {
    try {
      await addPoints(airline, customer, contractId, pointsToAdd);
      toast(setToast, `${pointsToAdd} points added!`, 'success');
      refresh();
    } catch (e) { toast(setToast, 'Failed to add points', 'error'); console.error(e); }
  };

  return (
    <div className="view">
      {addModal && (
        <AddPointsModal
          contractId={addModal}
          onAdd={handleAddPoints}
          onClose={() => setAddModal(null)}
        />
      )}

      <div className="info-banner">
        <span className="info-icon">✦</span>
        <span>You are the <strong>Airline</strong> — approve applications and manage member points.</span>
      </div>

      <div className="section-header">
        <h3>Applications to Review <span className="count">{applications.length}</span></h3>
        <button className="btn-ghost" onClick={refresh} disabled={loading}>{loading ? '…' : '↻ Refresh'}</button>
      </div>
      <div className="cards-grid">
        {applications.length === 0 && <p className="empty-state">No pending applications.</p>}
        {applications.map(c => (
          <ApplicationCard
            key={c.contractId}
            contract={c}
            actions={[{ label: '✓ Approve', success: true, onClick: handleApprove }]}
          />
        ))}
      </div>

      <div className="section-header">
        <h3>Active Members <span className="count">{accounts.length}</span></h3>
      </div>
      <div className="cards-grid">
        {accounts.length === 0 && <p className="empty-state">No active members yet.</p>}
        {accounts.map(c => (
          <AccountCard
            key={c.contractId}
            contract={c}
            actions={[{ label: '+ Add Points', onClick: (contractId) => setAddModal(contractId) }]}
          />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [airline, setAirline] = useState(null);
  const [activeView, setActiveView] = useState('customer');
  const [toastData, setToastData] = useState(null);

  const handleReady = (c, a) => { setCustomer(c); setAirline(a); setReady(true); };

  if (!ready) return <SetupScreen onReady={handleReady} />;

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">✦</span>
          <span className="header-title">Canton Loyalty</span>
          <span className="header-network">LocalNet</span>
        </div>
        <div className="header-center">
          <button className={`tab ${activeView === 'customer' ? 'tab-active' : ''}`} onClick={() => setActiveView('customer')}>Customer</button>
          <button className={`tab ${activeView === 'airline' ? 'tab-active' : ''}`} onClick={() => setActiveView('airline')}>Airline</button>
        </div>
        <div className="header-right">
          <PartyBadge label="Customer" partyId={customer} color="#f472b6" />
          <PartyBadge label="Airline" partyId={airline} color="#38bdf8" />
        </div>
      </header>

      <main className="main">
        {activeView === 'customer'
          ? <CustomerView customer={customer} airline={airline} setToast={setToastData} />
          : <AirlineView customer={customer} airline={airline} setToast={setToastData} />
        }
      </main>

      <Toast data={toastData} />
    </div>
  );
}