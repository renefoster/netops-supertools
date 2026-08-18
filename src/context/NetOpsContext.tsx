import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Device,
  PollResult,
  Alert,
  RCAResult,
  NetworkHealthSummary,
} from '../types/netops';

interface NetOpsContextType {
  devices: Device[];
  latestPolls: Record<string, PollResult>;
  alerts: Alert[];
  rcaResults: RCAResult[];
  summary: NetworkHealthSummary | null;
  selectedDevice: Device | null;
  setSelectedDevice: (d: Device | null) => void;
  isLoading: boolean;
  sseConnected: boolean;
  refreshData: () => Promise<void>;
  addDevice: (data: Partial<Device>) => Promise<Device>;
  updateDevice: (id: string, data: Partial<Device>) => Promise<Device>;
  deleteDevice: (id: string) => Promise<void>;
  pollDeviceNow: (id: string) => Promise<PollResult>;
  toggleSimFailure: (id: string, fail: boolean) => Promise<void>;
  acknowledgeAlert: (alertId: string | number) => Promise<void>;
  clearAlerts: () => Promise<void>;
}

const NetOpsContext = createContext<NetOpsContextType | undefined>(undefined);

export const NetOpsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [latestPolls, setLatestPolls] = useState<Record<string, PollResult>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rcaResults, setRcaResults] = useState<RCAResult[]>([]);
  const [summary, setSummary] = useState<NetworkHealthSummary | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [devRes, monRes, alertRes, rcaRes] = await Promise.all([
        fetch('/api/devices').then((r) => r.json()),
        fetch('/api/monitor/live').then((r) => r.json()),
        fetch('/api/monitor/alerts').then((r) => r.json()),
        fetch('/api/monitor/rca').then((r) => r.json()),
      ]);

      if (devRes.success) setDevices(devRes.data);
      if (monRes.success) {
        setLatestPolls(monRes.data.live || {});
        setSummary(monRes.data.summary);
      }
      if (alertRes.success) setAlerts(alertRes.data);
      if (rcaRes.success) setRcaResults(rcaRes.data);
    } catch (err) {
      console.error('[NetOps] refreshData error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize and connect SSE
  useEffect(() => {
    refreshData();

    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.addEventListener('snapshot', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.devices) setDevices(data.devices);
          if (data.alerts) setAlerts(data.alerts);
          if (data.summary) setSummary(data.summary);
          if (data.rca) setRcaResults(data.rca);
        } catch (err) {
          console.error('[SSE] snapshot parse error:', err);
        }
      });

      eventSource.addEventListener('poll:update', (e: MessageEvent) => {
        try {
          const poll: PollResult = JSON.parse(e.data);
          setLatestPolls((prev) => ({
            ...prev,
            [poll.device_id]: poll,
          }));
        } catch (err) {
          console.error('[SSE] poll:update parse error:', err);
        }
      });

      eventSource.addEventListener('alert:new', (e: MessageEvent) => {
        try {
          const alert: Alert = JSON.parse(e.data);
          setAlerts((prev) => [alert, ...prev.filter((a) => a.id !== alert.id)]);
          // Re-fetch RCA upon new alert
          fetch('/api/monitor/rca')
            .then((r) => r.json())
            .then((r) => {
              if (r.success) setRcaResults(r.data);
            });
        } catch (err) {
          console.error('[SSE] alert:new parse error:', err);
        }
      });

      eventSource.addEventListener('alert:resolved', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setAlerts((prev) =>
            prev.map((a) =>
              a.id === data.alert_id ? { ...a, resolved_at: Date.now() } : a
            )
          );
          fetch('/api/monitor/rca')
            .then((r) => r.json())
            .then((r) => {
              if (r.success) setRcaResults(r.data);
            });
        } catch (err) {
          console.error('[SSE] alert:resolved parse error:', err);
        }
      });

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource?.close();
        // Retry after 3s
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    // Fallback periodic sync every 10 seconds
    const interval = setInterval(refreshData, 10000);

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [refreshData]);

  const addDevice = async (data: Partial<Device>): Promise<Device> => {
    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json());

    if (!res.success) throw new Error(res.error || 'Failed to add device');
    await refreshData();
    return res.data;
  };

  const updateDevice = async (id: string, data: Partial<Device>): Promise<Device> => {
    const res = await fetch(`/api/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => r.json());

    if (!res.success) throw new Error(res.error || 'Failed to update device');
    await refreshData();
    return res.data;
  };

  const deleteDevice = async (id: string): Promise<void> => {
    const res = await fetch(`/api/devices/${id}`, { method: 'DELETE' }).then((r) => r.json());
    if (!res.success) throw new Error(res.error || 'Failed to delete device');
    await refreshData();
  };

  const pollDeviceNow = async (id: string): Promise<PollResult> => {
    const res = await fetch(`/api/devices/${id}/poll-now`, { method: 'POST' }).then((r) => r.json());
    if (!res.success) throw new Error(res.error || 'Failed to poll device');
    setLatestPolls((prev) => ({ ...prev, [id]: res.data }));
    return res.data;
  };

  const toggleSimFailure = async (id: string, fail: boolean): Promise<void> => {
    const res = await fetch(`/api/devices/${id}/simulate-failure`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fail }),
    }).then((r) => r.json());

    if (!res.success) throw new Error(res.error || 'Failed to toggle simulation');
    await refreshData();
  };

  const acknowledgeAlert = async (alertId: string | number): Promise<void> => {
    const res = await fetch(`/api/monitor/alerts/${alertId}/ack`, { method: 'POST' }).then((r) => r.json());
    if (res.success) {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
    }
  };

  const clearAlerts = async (): Promise<void> => {
    const res = await fetch('/api/monitor/alerts/clear', { method: 'POST' }).then((r) => r.json());
    if (res.success) {
      setAlerts([]);
    }
  };

  return (
    <NetOpsContext.Provider
      value={{
        devices,
        latestPolls,
        alerts,
        rcaResults,
        summary,
        selectedDevice,
        setSelectedDevice,
        isLoading,
        sseConnected,
        refreshData,
        addDevice,
        updateDevice,
        deleteDevice,
        pollDeviceNow,
        toggleSimFailure,
        acknowledgeAlert,
        clearAlerts,
      }}
    >
      {children}
    </NetOpsContext.Provider>
  );
};

export const useNetOps = () => {
  const context = useContext(NetOpsContext);
  if (!context) {
    throw new Error('useNetOps must be used within a NetOpsProvider');
  }
  return context;
};
