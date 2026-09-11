import React, { useState, useEffect } from 'react';
import type {
  RepoMindNotificationEvent,
  IntegrationItem,
  DeliveryLogItem,
  NotificationPreferences,
} from '../types';

const API_BASE_URL = 'http://127.0.0.1:8000';

interface NotificationsIntegrationsHubProps {
  repositoryUrl?: string;
  githubToken?: string;
}

export const NotificationsIntegrationsHub: React.FC<NotificationsIntegrationsHubProps> = ({
  repositoryUrl,
  githubToken,
}) => {
  const [activeTab, setActiveTab] = useState<'events' | 'integrations' | 'audit' | 'preferences'>('events');
  
  // Data states
  const [events, setEvents] = useState<RepoMindNotificationEvent[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogItem[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  
  // UI states
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  
  // New Integration Form state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newIntegName, setNewIntegName] = useState<string>('');
  const [newIntegType, setNewIntegType] = useState<string>('WEBHOOK');
  const [newIntegUrl, setNewIntegUrl] = useState<string>('');
  const [newIntegSecret, setNewIntegSecret] = useState<string>('');

  // Fetch Events
  const fetchEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE_URL}/api/notifications/events`;
      const params = new URLSearchParams();
      if (repositoryUrl) params.append('repository_url', repositoryUrl);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: githubToken ? { 'X-API-Key': githubToken } : {},
      });
      const data = await res.json();
      if (data.status === 'success') {
        setEvents(data.events || []);
      } else {
        setError(data.detail || 'Failed to load notification events');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching events');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Integrations
  const fetchIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations`, {
        headers: githubToken ? { 'X-API-Key': githubToken } : {},
      });
      const data = await res.json();
      if (data.status === 'success') {
        setIntegrations(data.integrations || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching integrations');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Delivery Logs
  const fetchDeliveryLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/delivery-logs`, {
        headers: githubToken ? { 'X-API-Key': githubToken } : {},
      });
      const data = await res.json();
      if (data.status === 'success') {
        setDeliveryLogs(data.delivery_logs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching delivery logs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Preferences
  const fetchPreferences = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
        headers: githubToken ? { 'X-API-Key': githubToken } : {},
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPreferences(data.preferences);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'events') fetchEvents();
    else if (activeTab === 'integrations') fetchIntegrations();
    else if (activeTab === 'audit') fetchDeliveryLogs();
    else if (activeTab === 'preferences') fetchPreferences();
  }, [activeTab, repositoryUrl, severityFilter]);

  // Create Integration
  const handleCreateIntegration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIntegName || !newIntegUrl) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubToken ? { 'X-API-Key': githubToken } : {}),
        },
        body: JSON.stringify({
          name: newIntegName,
          integration_type: newIntegType,
          url: newIntegUrl,
          secret: newIntegSecret || undefined,
        }),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSuccessMsg(`Created integration '${newIntegName}'`);
        setShowAddModal(false);
        setNewIntegName('');
        setNewIntegUrl('');
        setNewIntegSecret('');
        fetchIntegrations();
      } else {
        setError(data.detail || 'Failed to create integration');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating integration');
    } finally {
      setLoading(false);
    }
  };

  // Test Delivery
  const handleTestIntegration = async (integId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/${integId}/test`, {
        method: 'POST',
        headers: githubToken ? { 'X-API-Key': githubToken } : {},
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSuccessMsg(data.result?.message || 'Test notification dispatched successfully!');
        fetchDeliveryLogs();
      } else {
        setError(data.detail || 'Integration test failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error testing integration');
    } finally {
      setLoading(false);
    }
  };

  // Delete Integration
  const handleDeleteIntegration = async (integId: string) => {
    if (!window.confirm('Are you sure you want to delete this integration?')) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/integrations/${integId}`, {
        method: 'DELETE',
        headers: githubToken ? { 'X-API-Key': githubToken } : {},
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSuccessMsg('Integration deleted');
        fetchIntegrations();
      } else {
        setError(data.detail || 'Failed to delete integration');
      }
    } catch (err: any) {
      setError(err.message || 'Error deleting integration');
    } finally {
      setLoading(false);
    }
  };

  // Update Preferences
  const handleSavePreferences = async () => {
    if (!preferences) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(githubToken ? { 'X-API-Key': githubToken } : {}),
        },
        body: JSON.stringify(preferences),
      });
      const data = await res.json();
      if (data.status === 'success') {
        setSuccessMsg('Notification preferences updated!');
        setPreferences(data.preferences);
      } else {
        setError(data.detail || 'Failed to update preferences');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving preferences');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'badge-danger';
      case 'HIGH': return 'badge-warning';
      case 'MEDIUM': return 'badge-info';
      default: return 'badge-secondary';
    }
  };

  return (
    <div className="card notifications-hub-card">
      <div className="card-header flex-header">
        <div>
          <h2 className="card-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px', verticalAlign: 'bottom' }}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            Notifications &amp; Integrations Hub
          </h2>
          <p className="card-subtitle">
            Real-time event reaction engine, multi-channel webhook dispatching, HMAC security, and delivery audit history.
          </p>
        </div>

        <div className="sub-nav-tabs">
          <button
            className={`sub-nav-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Live Events ({events.length})
          </button>
          <button
            className={`sub-nav-btn ${activeTab === 'integrations' ? 'active' : ''}`}
            onClick={() => setActiveTab('integrations')}
          >
            Integrations ({integrations.length})
          </button>
          <button
            className={`sub-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            Delivery Audit Log
          </button>
          <button
            className={`sub-nav-btn ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            Preferences
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-danger" style={{ margin: '16px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ margin: '16px' }}>
          {successMsg}
        </div>
      )}

      {/* TAB 1: LIVE EVENTS */}
      {activeTab === 'events' && (
        <div className="card-body">
          <div className="toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Filter Severity:</label>
              <select
                className="input-select"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{ width: '140px', padding: '4px 8px' }}
              >
                <option value="ALL">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low / Info</option>
              </select>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={fetchEvents} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh SSoT Events'}
            </button>
          </div>

          {events.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
              <p>No active notification events for the selected criteria.</p>
            </div>
          ) : (
            <div className="events-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events.map((evt) => (
                <div
                  key={evt.event_id}
                  className="event-card-item"
                  style={{
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`badge ${getSeverityBadgeClass(evt.severity)}`}>
                        {evt.severity}
                      </span>
                      <span className="badge badge-outline" style={{ fontFamily: 'monospace' }}>
                        {evt.event_type}
                      </span>
                      <strong style={{ fontSize: '1rem', color: '#f8fafc' }}>{evt.title}</strong>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {new Date(evt.created_at).toLocaleString()}
                    </span>
                  </div>

                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e1' }}>{evt.summary}</p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    <span>Source Engine: <code style={{ color: '#38bdf8' }}>{evt.source_engine}</code></span>
                    <span>Dedup Hash: <code style={{ color: '#94a3b8' }}>{evt.dedup_hash.slice(0, 16)}...</code></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INTEGRATIONS */}
      {activeTab === 'integrations' && (
        <div className="card-body">
          <div className="toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
              Configured dispatch targets for automated notifications. Integration secrets are automatically masked (`wh_sec_****`).
            </p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(!showAddModal)}>
              {showAddModal ? 'Cancel' : '+ Add Integration'}
            </button>
          </div>

          {/* Add Integration Form */}
          {showAddModal && (
            <form onSubmit={handleCreateIntegration} style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#38bdf8' }}>Add New Integration Target</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Integration Name *</label>
                  <input
                    type="text"
                    className="input-text"
                    placeholder="e.g. Production Slack Webhook"
                    value={newIntegName}
                    onChange={(e) => setNewIntegName(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Type *</label>
                  <select
                    className="input-select"
                    value={newIntegType}
                    onChange={(e) => setNewIntegType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="WEBHOOK">Generic Webhook (HTTP POST)</option>
                    <option value="SLACK">Slack Webhook</option>
                    <option value="TEAMS">Microsoft Teams Webhook</option>
                    <option value="EMAIL">Email Alert Dispatch</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>Endpoint URL *</label>
                  <input
                    type="url"
                    className="input-text"
                    placeholder="https://example.com/webhook/... or https://api.internal/hooks"
                    value={newIntegUrl}
                    onChange={(e) => setNewIntegUrl(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>HMAC Secret Token (Optional)</label>
                  <input
                    type="password"
                    className="input-text"
                    placeholder="Auto-generated if empty"
                    value={newIntegSecret}
                    onChange={(e) => setNewIntegSecret(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                  {loading ? 'Creating...' : 'Save Integration'}
                </button>
              </div>
            </form>
          )}

          {/* Integrations Table */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name &amp; Type</th>
                  <th>Target URL</th>
                  <th>Secret (Masked)</th>
                  <th>Status</th>
                  <th>Events</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((integ) => (
                  <tr key={integ.id}>
                    <td>
                      <strong style={{ color: '#f8fafc' }}>{integ.name}</strong>
                      <br />
                      <span className="badge badge-outline" style={{ fontSize: '0.7rem' }}>{integ.integration_type}</span>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#38bdf8' }}>{integ.url}</code>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.8rem', color: '#a855f7' }}>{integ.secret}</code>
                    </td>
                    <td>
                      <span className={`badge ${integ.is_enabled ? 'badge-success' : 'badge-secondary'}`}>
                        {integ.is_enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {integ.events_subscribed?.length || 0} subscribed
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTestIntegration(integ.id)}
                          disabled={loading}
                          title="Trigger HMAC Test Ping"
                        >
                          Test Ping
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteIntegration(integ.id)}
                          disabled={loading}
                          title="Delete Integration"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DELIVERY AUDIT LOG */}
      {activeTab === 'audit' && (
        <div className="card-body">
          <div className="toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
              Historical audit log of notification dispatch events with `X-RepoMind-Signature` headers.
            </p>
            <button className="btn btn-secondary btn-sm" onClick={fetchDeliveryLogs} disabled={loading}>
              Refresh Logs
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Integration</th>
                  <th>Event Type</th>
                  <th>HTTP Status</th>
                  <th>HMAC Signature Header</th>
                  <th>Payload Snippet</th>
                </tr>
              </thead>
              <tbody>
                {deliveryLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8' }}>No delivery audit records found.</td>
                  </tr>
                ) : (
                  deliveryLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <strong>{log.integration_name || log.integration_id}</strong>
                      </td>
                      <td>
                        <span className="badge badge-outline" style={{ fontSize: '0.75rem' }}>{log.event_type}</span>
                      </td>
                      <td>
                        <span className={`badge ${log.http_status_code === 200 ? 'badge-success' : 'badge-danger'}`}>
                          {log.http_status_code} ({log.status})
                        </span>
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem', color: '#a855f7' }}>
                          {log.signature_header ? log.signature_header.slice(0, 24) + '...' : 'N/A'}
                        </code>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                          {log.payload_snippet}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PREFERENCES */}
      {activeTab === 'preferences' && preferences && (
        <div className="card-body">
          <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, color: '#38bdf8' }}>User Notification Preferences</h4>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="pref_email"
                checked={preferences.email_notifications_enabled}
                onChange={(e) => setPreferences({ ...preferences, email_notifications_enabled: e.target.checked })}
              />
              <label htmlFor="pref_email" style={{ color: '#f8fafc', cursor: 'pointer' }}>
                Enable Email Notifications
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="checkbox"
                id="pref_webhook"
                checked={preferences.webhook_notifications_enabled}
                onChange={(e) => setPreferences({ ...preferences, webhook_notifications_enabled: e.target.checked })}
              />
              <label htmlFor="pref_webhook" style={{ color: '#f8fafc', cursor: 'pointer' }}>
                Enable Webhook / Slack Notifications
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>
                Minimum Alert Severity Threshold
              </label>
              <select
                className="input-select"
                value={preferences.min_severity}
                onChange={(e) => setPreferences({ ...preferences, min_severity: e.target.value })}
                style={{ width: '200px' }}
              >
                <option value="CRITICAL">Critical Only</option>
                <option value="HIGH">High and Critical</option>
                <option value="MEDIUM">Medium, High, and Critical</option>
                <option value="LOW">All Alerts (Low/Info)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>
                Digest Frequency
              </label>
              <select
                className="input-select"
                value={preferences.digest_frequency}
                onChange={(e) => setPreferences({ ...preferences, digest_frequency: e.target.value })}
                style={{ width: '200px' }}
              >
                <option value="REALTIME">Realtime Instant Dispatch</option>
                <option value="HOURLY">Hourly Summary Digest</option>
                <option value="DAILY">Daily Summary Digest</option>
                <option value="NEVER">Never (Mute All)</option>
              </select>
            </div>

            <button className="btn btn-primary" onClick={handleSavePreferences} disabled={loading} style={{ marginTop: '12px', width: 'fit-content' }}>
              {loading ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
