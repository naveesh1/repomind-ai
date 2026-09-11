import React, { useState, useMemo } from 'react';

interface DependencyGraphProps {
  dependencyGraph: Record<string, string[]>;
  searchTerm?: string;
  onTriggerImpact?: (filePath: string) => void;
}

export const DependencyGraph: React.FC<DependencyGraphProps> = ({
  dependencyGraph,
  searchTerm = '',
  onTriggerImpact,
}) => {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'interactive' | 'list'>('interactive');

  // Extract all unique nodes and edges from real API data
  const { nodes, edges, inDegreeMap, outDegreeMap, hubNodes } = useMemo(() => {
    const nodeSet = new Set<string>();
    const edgeList: { source: string; target: string }[] = [];
    const inDeg: Record<string, number> = {};
    const outDeg: Record<string, number> = {};

    Object.entries(dependencyGraph || {}).forEach(([source, targets]) => {
      nodeSet.add(source);
      outDeg[source] = (outDeg[source] || 0) + (targets?.length || 0);

      (targets || []).forEach((target) => {
        nodeSet.add(target);
        inDeg[target] = (inDeg[target] || 0) + 1;
        edgeList.push({ source, target });
      });
    });

    const allNodes = Array.from(nodeSet).sort();

    // Identify top hub nodes (highest total degree)
    const hubs = [...allNodes]
      .map((n) => ({
        node: n,
        totalDegree: (inDeg[n] || 0) + (outDeg[n] || 0),
        inDegree: inDeg[n] || 0,
        outDegree: outDeg[n] || 0,
      }))
      .sort((a, b) => b.totalDegree - a.totalDegree)
      .slice(0, 10);

    return {
      nodes: allNodes,
      edges: edgeList,
      inDegreeMap: inDeg,
      outDegreeMap: outDeg,
      hubNodes: hubs,
    };
  }, [dependencyGraph]);

  // Filter nodes based on search term
  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) return nodes;
    const term = searchTerm.toLowerCase();
    return nodes.filter((n) => n.toLowerCase().includes(term));
  }, [nodes, searchTerm]);

  // Filter edges based on selected node or search term
  const activeEdges = useMemo(() => {
    if (selectedNode) {
      return edges.filter((e) => e.source === selectedNode || e.target === selectedNode);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      return edges.filter(
        (e) => e.source.toLowerCase().includes(term) || e.target.toLowerCase().includes(term)
      );
    }
    return edges;
  }, [edges, selectedNode, searchTerm]);

  // Active node connections
  const selectedDependencies = useMemo(() => {
    if (!selectedNode) return [];
    return dependencyGraph[selectedNode] || [];
  }, [dependencyGraph, selectedNode]);

  const selectedDependents = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter((e) => e.target === selectedNode).map((e) => e.source);
  }, [edges, selectedNode]);

  // Handle initial auto-selection
  const activeSelected = selectedNode || (filteredNodes.length > 0 ? filteredNodes[0] : null);

  return (
    <div className="dep-graph-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Toolbar */}
      <div
        className="dep-graph-toolbar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '1rem 1.25rem',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Total Modules</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{nodes.length}</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '1.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Dependency Edges</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#a855f7' }}>{edges.length}</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.1)', paddingLeft: '1.5rem' }}>
            <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>Filtered Connections</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981' }}>{activeEdges.length}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn-secondary ${viewMode === 'interactive' ? 'active' : ''}`}
            onClick={() => setViewMode('interactive')}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              background: viewMode === 'interactive' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              borderColor: viewMode === 'interactive' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
              color: viewMode === 'interactive' ? '#38bdf8' : '#94a3b8',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            🕸️ Interactive Graph
          </button>
          <button
            type="button"
            className={`btn-secondary ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            style={{
              padding: '6px 12px',
              fontSize: '0.8rem',
              background: viewMode === 'list' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              borderColor: viewMode === 'list' ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
              color: viewMode === 'list' ? '#38bdf8' : '#94a3b8',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            📜 Matrix &amp; Hub View
          </button>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#0f172a', borderRadius: '12px', color: '#94a3b8' }}>
          No dependency connections found for this repository.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem' }}>
          {/* Module Selector Sidebar */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '10px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '620px',
              overflow: 'hidden',
            }}
          >
            <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f8fafc' }}>
                Modules ({filteredNodes.length})
              </span>
              {selectedNode && (
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredNodes.map((node) => {
                const isSelected = activeSelected === node;
                const inCount = inDegreeMap[node] || 0;
                const outCount = outDegreeMap[node] || 0;

                return (
                  <button
                    key={node}
                    type="button"
                    onClick={() => setSelectedNode(node)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '8px 10px',
                      background: isSelected ? 'rgba(56, 189, 248, 0.15)' : 'rgba(7, 9, 14, 0.4)',
                      border: isSelected ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '6px',
                      color: isSelected ? '#38bdf8' : '#cbd5e1',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '190px',
                        fontFamily: 'monospace',
                      }}
                      title={node}
                    >
                      {node}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'flex', gap: '4px' }}>
                      <span title="Incoming dependents" style={{ color: '#10b981' }}>↓{inCount}</span>
                      <span title="Outgoing imports" style={{ color: '#a855f7' }}>↑{outCount}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Visual Graph & Node Inspector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {viewMode === 'interactive' ? (
              <div
                style={{
                  background: '#07090e',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  minHeight: '400px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Visual SVG Network Map */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                      {activeSelected ? `Dependency Radial Graph: ${activeSelected}` : 'Dependency Network Topography'}
                    </span>
                    {activeSelected && onTriggerImpact && (
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => onTriggerImpact(activeSelected)}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      >
                        Analyze Impact &rarr;
                      </button>
                    )}
                  </div>

                  {activeSelected ? (
                    <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '1rem' }}>
                      <svg width="100%" height="240" viewBox="0 0 700 240" style={{ overflow: 'visible' }}>
                        <defs>
                          <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
                          </marker>
                          <marker id="arrow-in" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                          </marker>
                        </defs>

                        {/* Central Target Node */}
                        <g transform="translate(350, 120)">
                          <circle r="36" fill="#0f172a" stroke="#38bdf8" strokeWidth="3" />
                          <text textAnchor="middle" dy="4" fill="#38bdf8" fontSize="10" fontWeight="bold" fontFamily="monospace">
                            {activeSelected.split('/').pop() || activeSelected}
                          </text>
                        </g>

                        {/* Left: Incoming Callers (Dependents) */}
                        {selectedDependents.slice(0, 5).map((dep, idx, arr) => {
                          const total = arr.length;
                          const startY = 120 - ((total - 1) * 35) / 2;
                          const y = startY + idx * 35;
                          const x = 120;
                          return (
                            <g key={`in-${dep}-${idx}`}>
                              <line x1={x + 70} y1={y} x2={314} y2={120} stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" markerEnd="url(#arrow-in)" />
                              <rect x={x - 60} y={y - 12} width="130" height="24" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1" />
                              <text x={x} y={y + 4} textAnchor="middle" fill="#34d399" fontSize="9" fontFamily="monospace">
                                {dep.split('/').pop() || dep}
                              </text>
                            </g>
                          );
                        })}

                        {/* Right: Outgoing Dependencies (Imports) */}
                        {selectedDependencies.slice(0, 5).map((imp, idx, arr) => {
                          const total = arr.length;
                          const startY = 120 - ((total - 1) * 35) / 2;
                          const y = startY + idx * 35;
                          const x = 580;
                          return (
                            <g key={`out-${imp}-${idx}`}>
                              <line x1={386} y1={120} x2={x - 70} y2={y} stroke="#38bdf8" strokeWidth="1.5" markerEnd="url(#arrow)" />
                              <rect x={x - 60} y={y - 12} width="130" height="24" rx="4" fill="#0f172a" stroke="#38bdf8" strokeWidth="1" />
                              <text x={x} y={y + 4} textAnchor="middle" fill="#38bdf8" fontSize="9" fontFamily="monospace">
                                {imp.split('/').pop() || imp}
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                        <span>← Incoming Callers ({selectedDependents.length})</span>
                        <span style={{ color: '#38bdf8', fontWeight: 600 }}>Selected: {activeSelected}</span>
                        <span>Outgoing Imports ({selectedDependencies.length}) →</span>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Node Details Inspection Tabs */}
                {activeSelected && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8', marginBottom: '6px' }}>
                        Imports / Downstream Dependencies ({selectedDependencies.length})
                      </div>
                      {selectedDependencies.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No outgoing module imports</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                          {selectedDependencies.map((dep) => (
                            <button
                              key={dep}
                              type="button"
                              onClick={() => setSelectedNode(dep)}
                              style={{ textAlign: 'left', background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}
                            >
                              &rarr; {dep}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#34d399', marginBottom: '6px' }}>
                        Callers / Dependent Modules ({selectedDependents.length})
                      </div>
                      {selectedDependents.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No incoming dependent callers</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto' }}>
                          {selectedDependents.map((dep) => (
                            <button
                              key={dep}
                              type="button"
                              onClick={() => setSelectedNode(dep)}
                              style={{ textAlign: 'left', background: 'none', border: 'none', color: '#cbd5e1', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'monospace' }}
                            >
                              &larr; {dep}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Hub Modules Leaderboard */
              <div
                style={{
                  background: '#07090e',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '1.25rem',
                }}
              >
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: '#f8fafc' }}>
                  Top Central Hub Modules (Highest Coupling Density)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {hubNodes.map((h, idx) => (
                    <div
                      key={h.node}
                      onClick={() => {
                        setSelectedNode(h.node);
                        setViewMode('interactive');
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b' }}>#{idx + 1}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', fontFamily: 'monospace' }}>
                          {h.node}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#34d399' }}>Dependents: <strong>{h.inDegree}</strong></span>
                        <span style={{ color: '#a855f7' }}>Imports: <strong>{h.outDegree}</strong></span>
                        <span style={{ color: '#f8fafc', fontWeight: 700 }}>Total Connections: {h.totalDegree}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
