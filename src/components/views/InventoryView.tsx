import React, { useState } from 'react';
import { useNetOps } from '../../context/NetOpsContext';
import { Device, DeviceType, DeviceBrand, PollProtocol, NetworkZone } from '../../types/netops';
import {
  Server,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Download,
  Filter,
  CheckCircle,
  XCircle,
  Radio,
  Sliders,
  Sparkles,
} from 'lucide-react';

import { Pagination } from '../ui/Pagination';

interface InventoryViewProps {
  onSelectDevice: (device: Device) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onSelectDevice }) => {
  const { devices, latestPolls, addDevice, updateDevice, deleteDevice, pollDeviceNow } = useNetOps();

  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    ip: string;
    mac: string;
    vendor: string;
    type: DeviceType;
    brand: DeviceBrand;
    protocol: PollProtocol;
    location: string;
    zone: NetworkZone;
    upstream_id: string;
    pollInterval: number;
    tags: string;
  }>({
    name: '',
    ip: '',
    mac: '',
    vendor: '',
    type: 'switch',
    brand: 'ubiquiti',
    protocol: 'snmp',
    location: '',
    zone: 'access',
    upstream_id: '',
    pollInterval: 30,
    tags: '',
  });

  const handleOpenAdd = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      ip: '',
      mac: '',
      vendor: '',
      type: 'ap',
      brand: 'ubiquiti',
      protocol: 'icmp',
      location: ' 1',
      zone: 'access',
      upstream_id: devices[0]?.id || '',
      pollInterval: 30,
      tags: 'wifi, guest',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dev: Device) => {
    setEditingDevice(dev);
    setFormData({
      name: dev.name,
      ip: dev.ip,
      mac: dev.mac || '',
      vendor: dev.vendor || '',
      type: dev.type,
      brand: dev.brand,
      protocol: dev.protocol,
      location: dev.location,
      zone: dev.zone,
      upstream_id: dev.upstream_id || '',
      pollInterval: dev.pollInterval || 30,
      tags: dev.tags?.join(', ') || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagArray = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: Partial<Device> = {
      ...formData,
      tags: tagArray,
      upstream_id: formData.upstream_id || null,
    };

    if (editingDevice) {
      await updateDevice(editingDevice.id, payload);
    } else {
      await addDevice(payload);
    }

    setIsModalOpen(false);
  };

  const handlePromptDelete = (dev: Device) => {
    setDeviceToDelete(dev);
  };

  const handleConfirmDelete = async () => {
    if (!deviceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDevice(deviceToDelete.id);
      setDeviceToDelete(null);
    } catch (err) {
      console.error('Failed to delete device:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'IP', 'MAC', 'Type', 'Brand', 'Protocol', 'Zone', 'Location', 'Upstream'];
    const rows = devices.map((d) => [
      d.id,
      d.name,
      d.ip,
      d.mac || '',
      d.type,
      d.brand,
      d.protocol,
      d.zone,
      `"${d.location}"`,
      d.upstream_id || 'None',
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `netops-inventory-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = devices.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.ip.includes(search) ||
      d.location.toLowerCase().includes(search.toLowerCase());

    const matchesZone = zoneFilter === 'all' || d.zone === zoneFilter;
    const matchesBrand = brandFilter === 'all' || d.brand === brandFilter;

    return matchesSearch && matchesZone && matchesBrand;
  });

  const pageSize = 10;
  const paginatedDevices = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setZoneFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleBrandChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setBrandFilter(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#151d2e] p-3.5 rounded-xl border border-[#1e2d45]">
        <div>
          <h3 className="font-bold text-white text-sm">Device Inventory & Registry</h3>
          <p className="text-xs text-[#8892a4]">Manage monitored switches, APs, cameras, and core gateways</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1522] hover:bg-[#1a2438] text-[#8892a4] hover:text-white border border-[#1e2d45] rounded-lg text-xs font-medium transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#151d2e] p-3 rounded-xl border border-[#1e2d45]">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-[#8892a4] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, IP, location..."
            value={search}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-white placeholder-[#8892a4] focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Zone Dropdown */}
        <select
          value={zoneFilter}
          onChange={handleZoneChange}
          className="bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-[#8892a4] px-3 py-1.5 focus:outline-none focus:text-white"
        >
          <option value="all">All Network Zones</option>
          <option value="core">Core</option>
          <option value="distribution">Distribution</option>
          <option value="access">Access</option>
          <option value="cctv">CCTV</option>
          <option value="iot">IoT</option>
        </select>

        {/* Brand Dropdown */}
        <select
          value={brandFilter}
          onChange={handleBrandChange}
          className="bg-[#0f1522] border border-[#1e2d45] rounded-lg text-xs text-[#8892a4] px-3 py-1.5 focus:outline-none focus:text-white"
        >
          <option value="all">All Vendors / Brands</option>
          <option value="mikrotik">MikroTik</option>
          <option value="ubiquiti">Ubiquiti UniFi</option>
          <option value="cisco">Cisco Systems</option>
          <option value="tplink">TP-Link</option>
          <option value="hikvision">Hikvision</option>
          <option value="synology">Synology</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#151d2e] border border-[#1e2d45] rounded-xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f1522] border-b border-[#1e2d45] text-[#8892a4] font-medium">
              <tr>
                <th className="py-3 px-4">Device Name</th>
                <th className="py-3 px-4">IP / MAC</th>
                <th className="py-3 px-4">Type & Brand</th>
                <th className="py-3 px-4">Protocol</th>
                <th className="py-3 px-4">Zone & Location</th>
                <th className="py-3 px-4">Upstream Parent</th>
                <th className="py-3 px-4">Live Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2d45] text-[#e2e8f0]">
              {paginatedDevices.map((dev) => {
                const poll = latestPolls[dev.id];
                const status = poll?.status || 'unknown';
                const parent = devices.find((d) => d.id === dev.upstream_id);

                return (
                  <tr
                    key={dev.id}
                    onClick={() => onSelectDevice(dev)}
                    className="hover:bg-[#1a2438] transition cursor-pointer"
                  >
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{dev.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <div>{dev.ip}</div>
                      <div className="text-[10px] text-[#8892a4]">{dev.mac || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize font-medium text-white">{dev.brand}</span>
                      <span className="text-[10px] text-[#8892a4] block uppercase">
                        {dev.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono uppercase text-blue-400">
                      {dev.protocol}
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#0f1522] border border-[#1e2d45] text-[#8892a4]">
                        {dev.zone}
                      </span>
                      <div className="text-[11px] text-[#8892a4] mt-0.5">{dev.location}</div>
                    </td>
                    <td className="py-3 px-4 text-[11px]">
                      {parent ? (
                        <span className="text-[#8892a4] font-medium">{parent.name}</span>
                      ) : (
                        <span className="text-emerald-400 font-mono text-[10px]">ROOT (Gateway)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                          status === 'up'
                            ? 'bg-emerald-400'
                            : status === 'down'
                            ? 'bg-red-400'
                            : status === 'degraded'
                            ? 'bg-amber-400'
                            : 'bg-purple-400'
                        }`}
                      />
                      <span className="capitalize text-xs font-semibold">{status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => pollDeviceNow(dev.id)}
                          className="p-1.5 hover:bg-[#0f1522] rounded text-[#8892a4] hover:text-emerald-400 transition"
                          title="Poll now"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(dev)}
                          className="p-1.5 hover:bg-[#0f1522] rounded text-[#8892a4] hover:text-blue-400 transition"
                          title="Edit device"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handlePromptDelete(dev)}
                          className="p-1.5 hover:bg-[#0f1522] rounded text-[#8892a4] hover:text-red-400 transition"
                          title="Delete device"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedDevices.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#8892a4]">
                    No devices match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-[#151d2e] border border-[#2a3a52] rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1e2d45]">
              <h3 className="font-bold text-white text-base">
                {editingDevice ? `Edit ${editingDevice.name}` : 'Register New Device'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-[#8892a4] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8892a4] mb-1">Device Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white"
                    placeholder="e.g. SW-03-PoE"
                  />
                </div>
                <div>
                  <label className="block text-[#8892a4] mb-1">IP Address *</label>
                  <input
                    type="text"
                    required
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white font-mono"
                    placeholder="192.168.1.35"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8892a4] mb-1">MAC Address</label>
                  <input
                    type="text"
                    value={formData.mac}
                    onChange={(e) => setFormData({ ...formData, mac: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white font-mono"
                    placeholder="00:11:22:33:44:55"
                  />
                </div>
                <div>
                  <label className="block text-[#8892a4] mb-1">Brand / Vendor</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value as DeviceBrand })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white"
                  >
                    <option value="mikrotik">MikroTik</option>
                    <option value="ubiquiti">Ubiquiti UniFi</option>
                    <option value="cisco">Cisco Systems</option>
                    <option value="tplink">TP-Link</option>
                    <option value="hikvision">Hikvision</option>
                    <option value="synology">Synology</option>
                    <option value="generic">Generic / Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8892a4] mb-1">Device Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as DeviceType })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white"
                  >
                    <option value="router">Router / Gateway</option>
                    <option value="switch">Switch</option>
                    <option value="ap">Access Point</option>
                    <option value="camera">CCTV Camera</option>
                    <option value="nas">NAS Storage</option>
                    <option value="gateway">IoT Gateway</option>
                    <option value="other">Other Appliance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#8892a4] mb-1">Polling Protocol</label>
                  <select
                    value={formData.protocol}
                    onChange={(e) => setFormData({ ...formData, protocol: e.target.value as PollProtocol })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white font-mono"
                  >
                    <option value="icmp">ICMP (Ping)</option>
                    <option value="snmp">SNMP (v2c/v3)</option>
                    <option value="routeros">RouterOS API</option>
                    <option value="ssh">SSH Telemetry</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8892a4] mb-1">Zone</label>
                  <select
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value as NetworkZone })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white"
                  >
                    <option value="core">Core</option>
                    <option value="distribution">Distribution</option>
                    <option value="access">Access</option>
                    <option value="cctv">CCTV</option>
                    <option value="iot">IoT</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#8892a4] mb-1">Upstream Parent (for RCA)</label>
                  <select
                    value={formData.upstream_id}
                    onChange={(e) => setFormData({ ...formData, upstream_id: e.target.value })}
                    className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white"
                  >
                    <option value="">None (Top-Level Root Gateway)</option>
                    {devices
                      .filter((d) => !editingDevice || d.id !== editingDevice.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.ip})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#8892a4] mb-1">Physical Location</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-1.5 bg-[#0f1522] border border-[#1e2d45] rounded-lg text-white"
                  placeholder="e.g.  2 - Main Rack"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#1e2d45]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-[#0f1522] hover:bg-[#1a2438] text-[#8892a4] rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow"
                >
                  {editingDevice ? 'Save Changes' : 'Register Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Dialog Modal */}
      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="bg-[#151d2e] border border-[#2a3a52] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Delete Device from Inventory</h3>
                <p className="text-xs text-[#8892a4] mt-0.5">
                  This action cannot be undone. Are you sure you want to remove this node?
                </p>
              </div>
            </div>

            <div className="bg-[#0f1522] border border-[#1e2d45] rounded-xl p-3.5 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-[#8892a4]">Device Name:</span>
                <span className="text-white font-bold">{deviceToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8892a4]">IP Address:</span>
                <span className="text-emerald-400">{deviceToDelete.ip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8892a4]">Brand / Type:</span>
                <span className="text-cyan-400 capitalize">{deviceToDelete.brand} ({deviceToDelete.type})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8892a4]">Location:</span>
                <span className="text-[#8892a4]">{deviceToDelete.location}</span>
              </div>
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-300 space-y-1">
              <span className="font-bold block">Operational Warning:</span>
              <span>Removing this hardware node will stop live ICMP/SNMP polling, clear historical telemetry, and unbind downstream network dependencies.</span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#1e2d45]">
              <button
                type="button"
                onClick={() => setDeviceToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-[#0f1522] hover:bg-[#1a2438] text-[#8892a4] hover:text-white rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-red-950/40 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
