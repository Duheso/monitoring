import React from 'react'
import { Server } from 'lucide-react'
import CardWrapper from './CardWrapper'
import { useColumnSettings } from '../hooks/useColumnSettings'

const SYS_METRICS = [
  { key: 'cpu_model',     label: 'CPU Model' },
  { key: 'hostname',      label: 'Hostname' },
  { key: 'uptime',        label: 'Uptime' },
  { key: 'cpu_cores',     label: 'CPU Cores' },
  { key: 'load_1',        label: 'Load Avg 1m' },
  { key: 'load_5',        label: 'Load Avg 5m' },
  { key: 'load_15',       label: 'Load Avg 15m' },
  { key: 'cpu_freq',      label: 'CPU Frequency' },
  // OS
  { key: 'os_info',       label: 'OS Info' },
  // NVIDIA
  { key: 'nv_driver',     label: 'NVIDIA Driver' },
  { key: 'nv_cuda',       label: 'CUDA Version' },
  { key: 'nv_smi',        label: 'NVIDIA-SMI Version' },
  // DGX
  { key: 'dgx_name',      label: 'DGX Pretty Name' },
  { key: 'dgx_platform',  label: 'DGX Platform' },
  { key: 'dgx_serial',    label: 'DGX Serial Number' },
  { key: 'dgx_sw',        label: 'DGX SW Build' },
  { key: 'dgx_ota',       label: 'DGX OTA Version' },
  // Chassis
  { key: 'chassis_prod',  label: 'Product Name' },
  { key: 'chassis_sn',    label: 'Chassis Serial' },
  { key: 'bios',          label: 'BIOS' },
]

function fmtUptime(sec) {
  if (!sec) return '—'
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function Row({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="sysinfo-item">
      <div className="lbl">{label}</div>
      <div className="val tabnum" style={accent ? { color: accent } : {}}>{value}</div>
    </div>
  )
}

export default function SystemInfoCard({ data }) {
  const { settings, toggleVisible } = useColumnSettings('sys-metrics', SYS_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  const s = data ?? {}
  const loadColor = (v) => v >= s.cpu_count_logical ? '#ef4444' : v >= s.cpu_count_logical * 0.7 ? '#f59e0b' : '#22c55e'

  return (
    <CardWrapper title="System" icon={<Server size={14} />} columns={SYS_METRICS} colSettings={settings} onToggleCol={toggleVisible}>
      {vis('cpu_model') && s.cpu_model && (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, borderLeft: '2px solid var(--accent)' }}>
          {s.cpu_model}
        </div>
      )}

      <div className="sysinfo-grid">
        {vis('hostname')     && <Row label="Hostname"       value={s.hostname} />}
        {vis('uptime')       && <Row label="Uptime"         value={fmtUptime(s.uptime)} />}
        {vis('cpu_cores')    && <Row label="CPU Cores"      value={s.cpu_count_physical ? `${s.cpu_count_physical} phys / ${s.cpu_count_logical} logical` : undefined} />}
        {vis('load_1')       && <Row label="Load Avg 1m"    value={s.load_avg_1}  accent={s.load_avg_1 ? loadColor(s.load_avg_1) : undefined} />}
        {vis('load_5')       && <Row label="Load Avg 5m"    value={s.load_avg_5} />}
        {vis('load_15')      && <Row label="Load Avg 15m"   value={s.load_avg_15} />}
        {vis('cpu_freq')  && s.cpu_freq_mhz && <Row label="CPU Freq" value={`${(s.cpu_freq_mhz/1000).toFixed(2)} GHz${s.cpu_freq_max_mhz ? ` / ${(s.cpu_freq_max_mhz/1000).toFixed(2)} max` : ''}`} />}

        {/* OS */}
        {vis('os_info') && s.os_description && <Row label="OS" value={s.os_description} />}
        {vis('os_info') && s.os_codename && s.os_codename !== s.os_description && <Row label="Codename" value={s.os_codename} />}

        {/* NVIDIA */}
        {vis('nv_driver') && s.driver_version     && <Row label="NVIDIA Driver"   value={s.driver_version}      accent="var(--accent)" />}
        {vis('nv_cuda')   && s.cuda_version        && <Row label="CUDA Version"    value={s.cuda_version}         accent="var(--accent2)" />}
        {vis('nv_smi')    && s.nvidia_smi_version  && <Row label="NVIDIA-SMI"      value={s.nvidia_smi_version} />}

        {/* DGX */}
        {vis('dgx_name')     && s.dgx_pretty_name    && <Row label="DGX"            value={s.dgx_pretty_name} />}
        {vis('dgx_platform') && s.dgx_platform        && <Row label="DGX Platform"  value={s.dgx_platform} />}
        {vis('dgx_serial')   && s.dgx_serial_number   && <Row label="DGX Serial"    value={s.dgx_serial_number} />}
        {vis('dgx_sw')       && s.dgx_swbuild_version && <Row label="SW Build"       value={`${s.dgx_swbuild_version} (${s.dgx_swbuild_date})`} />}
        {vis('dgx_ota')      && s.dgx_ota_version     && <Row label="OTA Version"   value={`${s.dgx_ota_version} (${s.dgx_ota_date})`} />}

        {/* Chassis */}
        {vis('chassis_prod') && s.product_name     && <Row label="Product"        value={s.product_name} />}
        {vis('chassis_sn')   && s.chassis_serial   && <Row label="Chassis SN"     value={s.chassis_serial} />}
        {vis('bios')         && s.bios_version     && <Row label="BIOS"           value={`${s.bios_version} (${s.bios_date})`} />}
      </div>
    </CardWrapper>
  )
}
