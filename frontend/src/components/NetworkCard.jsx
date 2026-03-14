import React, { useState } from 'react'
import { Network } from 'lucide-react'
import CardWrapper from './CardWrapper'
import MultiSparkLine from './MultiSparkLine'
import { useColumnSettings } from '../hooks/useColumnSettings'

const NET_METRICS = [
  { key: 'total_spark',  label: 'Total Rate Chart' },
  { key: 'show_mac',     label: 'MAC Address' },
  { key: 'show_ips',     label: 'IP Addresses' },
  { key: 'show_packets', label: 'Packet Counters' },
  { key: 'show_errors',  label: 'Errors / Drops' },
]

const fmtRate = (b) => {
  if (!b) return '0 B/s'
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB/s'
  if (b >= 1048576)    return (b / 1048576).toFixed(1) + ' MB/s'
  if (b >= 1024)       return (b / 1024).toFixed(0) + ' KB/s'
  return b.toFixed(0) + ' B/s'
}
const fmtBytes = (b) => {
  if (!b) return '0 B'
  if (b >= 1073741824) return (b / 1073741824).toFixed(1) + ' GB'
  if (b >= 1048576)    return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024)       return (b / 1024).toFixed(0) + ' KB'
  return b + ' B'
}

const SPARK_LINES = [
  { key: 'recv', label: '↓ Recv',   color: 'var(--accent)', gradientId: 'net-recv-grad', dataKey: pt => (pt?.network?.total_recv_rate ?? 0) / 1024, formatter: v => `↓ ${fmtRate(v * 1024)}` },
  { key: 'sent', label: '↑ Send',   color: '#22c55e',       gradientId: 'net-sent-grad', dataKey: pt => (pt?.network?.total_sent_rate ?? 0) / 1024, formatter: v => `↑ ${fmtRate(v * 1024)}` },
]

export default function NetworkCard({ data, history }) {
  const { settings, toggleVisible } = useColumnSettings('net-metrics', NET_METRICS)
  const vis = (key) => settings?.[key]?.visible !== false

  const interfaces = data?.interfaces ?? {}
  const allIfaces  = Object.entries(interfaces)
  const upIfaces   = allIfaces.filter(([, v]) => v.is_up)

  // Interface visibility filter (per interface name)
  const [hiddenIfaces, setHiddenIfaces] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dgx_net_hidden') || '[]')) } catch { return new Set() }
  })
  const toggleIface = (name) => {
    setHiddenIfaces(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      localStorage.setItem('dgx_net_hidden', JSON.stringify([...next]))
      return next
    })
  }

  // IP version filter
  const [ipFilter, setIpFilter] = useState(() => localStorage.getItem('dgx_net_ipfilter') || 'all')
  const setAndSaveIpFilter = (v) => { setIpFilter(v); localStorage.setItem('dgx_net_ipfilter', v) }

  const filteredIfaces = upIfaces.filter(([name]) => !hiddenIfaces.has(name))

  return (
    <CardWrapper
      title="Network"
      icon={<Network size={14} />}
      columns={NET_METRICS}
      colSettings={settings}
      onToggleCol={toggleVisible}
    >
      {/* Total rates */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 4, fontSize: 12 }}>
        <div><span className="text-muted">↑ Total </span><span className="font-600 tabnum" style={{ color: '#22c55e' }}>{fmtRate(data?.total_sent_rate)}</span></div>
        <div><span className="text-muted">↓ Total </span><span className="font-600 tabnum text-accent">{fmtRate(data?.total_recv_rate)}</span></div>
      </div>

      {vis('total_spark') && <MultiSparkLine data={history} lines={SPARK_LINES} height={50} />}
      {vis('total_spark') && (
        <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)', marginBottom: 6, marginTop: 2 }}>
          <span style={{ color: 'var(--accent)' }}>— ↓ Download</span>
          <span style={{ color: '#22c55e' }}>— ↑ Upload</span>
        </div>
      )}

      {/* Interface filter controls */}
      {upIfaces.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--muted)', marginRight: 2 }}>Interfaces:</span>
          {upIfaces.map(([name]) => (
            <button key={name} onClick={() => toggleIface(name)}
              style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                background: hiddenIfaces.has(name) ? 'rgba(255,255,255,0.03)' : 'rgba(59,130,246,0.15)',
                border: `1px solid ${hiddenIfaces.has(name) ? 'var(--border)' : 'rgba(59,130,246,0.4)'}`,
                color: hiddenIfaces.has(name) ? 'var(--muted)' : 'var(--accent2)',
              }}>{name}</button>
          ))}

          {/* IP version filter */}
          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>IP:</span>
          {['all','ipv4','ipv6'].map(f => (
            <button key={f} onClick={() => setAndSaveIpFilter(f)}
              style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 4, cursor: 'pointer',
                background: ipFilter === f ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${ipFilter === f ? 'rgba(59,130,246,0.4)' : 'var(--border)'}`,
                color: ipFilter === f ? 'var(--accent2)' : 'var(--muted)',
              }}>{f}</button>
          ))}
        </div>
      )}

      {/* Per-interface */}
      {filteredIfaces.map(([name, iface]) => {
        const filteredAddrs = (iface.addrs || []).filter(a =>
          ipFilter === 'all' ? true : ipFilter === 'ipv4' ? a.version === 4 : a.version === 6
        )
        return (
          <div key={name} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="net-iface-name">{name}</span>
                {iface.speed_mbps > 0 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{iface.speed_mbps} Mbps</span>}
              </div>
              <div className="net-rates">
                <div className="net-rate"><span className="lbl">↑ </span><span className="val up tabnum">{fmtRate(iface.bytes_sent_rate)}</span></div>
                <div className="net-rate"><span className="lbl">↓ </span><span className="val dn tabnum">{fmtRate(iface.bytes_recv_rate)}</span></div>
              </div>
            </div>

            {/* MAC */}
            {vis('show_mac') && iface.mac && (
              <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)', marginTop: 2 }}>
                MAC: <span style={{ color: 'var(--text2)' }}>{iface.mac}</span>
              </div>
            )}

            {/* IPs */}
            {vis('show_ips') && filteredAddrs.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 6px', marginTop: 3 }}>
                {filteredAddrs.map((a, i) => (
                  <span key={i} style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: a.version === 4 ? 'var(--accent2)' : 'var(--muted)', background: 'rgba(255,255,255,0.04)', borderRadius: 3, padding: '1px 5px' }}>
                    {a.version === 4 ? '4' : '6'} {a.addr}
                  </span>
                ))}
              </div>
            )}

            {/* Packets */}
            {vis('show_packets') && (
              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                <span>Pkts ↑ {iface.packets_sent?.toLocaleString()}</span>
                <span>Pkts ↓ {iface.packets_recv?.toLocaleString()}</span>
                <span>Total ↑ {fmtBytes(iface.bytes_sent)}</span>
                <span>Total ↓ {fmtBytes(iface.bytes_recv)}</span>
              </div>
            )}

            {/* Errors */}
            {vis('show_errors') && (iface.errin > 0 || iface.errout > 0 || iface.dropin > 0 || iface.dropout > 0) && (
              <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 2 }}>
                {iface.errin > 0 && <span>Err↓:{iface.errin} </span>}
                {iface.errout > 0 && <span>Err↑:{iface.errout} </span>}
                {iface.dropin > 0 && <span>Drop↓:{iface.dropin} </span>}
                {iface.dropout > 0 && <span>Drop↑:{iface.dropout}</span>}
              </div>
            )}
          </div>
        )
      })}

      {filteredIfaces.length === 0 && <div className="text-muted" style={{ padding: '8px 0' }}>No active interfaces shown.</div>}
    </CardWrapper>
  )
}
