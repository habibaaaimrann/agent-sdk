'use client';

import React, { useEffect, useRef, useState } from 'react';

import {
  type PortalAgent,
  type PortalVoice,
  createAgent,
  getAgents,
  getVoices,
  updateAgent,
} from '@/lib/portalApi';

export default function AgentsPage() {
  const [agents, setAgents] = useState<PortalAgent[]>([]);
  const [voices, setVoices] = useState<PortalVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState('v_meklc281');
  const [searchQuery, setSearchQuery] = useState('');
  const [genderFilter, setGenderFilter] = useState('All');
  const [agentName, setAgentName] = useState('Customer Care Agent');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a polite Urdu customer support voice assistant.',
  );
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [agentsData, voicesData] = await Promise.all([getAgents(), getVoices()]);
        setAgents(agentsData);
        setVoices(voicesData);

        if (agentsData.length > 0) {
          const first = agentsData[0];
          setEditingAgentId(first.id);
          setAgentName(first.name);
          setSystemPrompt(first.prompt);
          setSelectedVoice(first.voice_id);
        } else if (voicesData.length > 0) {
          setSelectedVoice(voicesData[0].id);
        }

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setLoading(false);
      }
    }

    void load();

    return () => {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      }
      for (const audio of Array.from(audioCacheRef.current.values())) {
        audio.pause();
        audio.src = '';
      }
      audioCacheRef.current.clear();
    };
  }, []);

  const filteredVoices = voices.filter((voice) => {
    const matchesSearch =
      voice.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      voice.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender =
      genderFilter === 'All' ||
      voice.gender.toLowerCase() === genderFilter.toLowerCase();
    return matchesSearch && matchesGender;
  });

  const handlePlayAudio = async (voice: PortalVoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewError(null);

    if (!voice.previewUrl) {
      setPreviewError(`No preview is available yet for ${voice.displayName}.`);
      return;
    }

    try {
      if (activeAudioRef.current && playingVoice && playingVoice !== voice.id) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      }

      let audio = audioCacheRef.current.get(voice.id);
      if (!audio) {
        audio = new Audio(voice.previewUrl);
        audio.preload = 'auto';
        audioCacheRef.current.set(voice.id, audio);
      }

      if (playingVoice === voice.id) {
        audio.pause();
        audio.currentTime = 0;
        activeAudioRef.current = null;
        setPlayingVoice(null);
        return;
      }

      audio.onended = () => {
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        setPlayingVoice((current) => (current === voice.id ? null : current));
      };
      audio.onerror = () => {
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        setPlayingVoice((current) => (current === voice.id ? null : current));
        setPreviewError(`Preview playback failed for ${voice.displayName}.`);
      };

      audio.currentTime = 0;
      activeAudioRef.current = audio;
      setPlayingVoice(voice.id);
      await audio.play();
    } catch (err) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current = null;
      }
      setPlayingVoice(null);
      setPreviewError(
        err instanceof Error
          ? err.message
          : `Preview playback failed for ${voice.displayName}.`,
      );
    }
  };

  const openCreateModal = () => {
    setEditingAgentId(null);
    setAgentName('New Portal Agent');
    setSystemPrompt('You are a polite Urdu customer support voice assistant.');
    setSelectedVoice(voices[0]?.id ?? 'v_meklc281');
    setPreviewError(null);
    setShowModal(true);
  };

  const openEditModal = (agent: PortalAgent) => {
    setEditingAgentId(agent.id);
    setAgentName(agent.name);
    setSystemPrompt(agent.prompt);
    setSelectedVoice(agent.voice_id);
    setPreviewError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (editingAgentId) {
        const updated = await updateAgent(editingAgentId, {
          name: agentName,
          prompt: systemPrompt,
          voice_id: selectedVoice,
        });
        setAgents((prev) =>
          prev.map((agent) =>
            agent.id === updated.id ? { ...agent, ...updated } : agent,
          ),
        );
      } else {
        const created = await createAgent({
          name: agentName,
          prompt: systemPrompt,
          voice_id: selectedVoice,
        });
        setAgents((prev) => [created, ...prev]);
        setEditingAgentId(created.id);
      }

      setShowModal(false);
      setSaveSuccessMessage(true);
      setError(null);
      setTimeout(() => setSaveSuccessMessage(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {error && (
        <div
          style={{
            background: 'rgba(248, 113, 113, 0.15)',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            color: '#fca5a5',
            padding: '0.9rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
          }}
        >
          <strong>Backend connection error:</strong> {error}
        </div>
      )}

      {saveSuccessMessage && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid var(--primary)',
            color: '#34d399',
            padding: '0.9rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span>OK</span> Agent configuration updated successfully.
        </div>
      )}

      {previewError && (
        <div
          style={{
            background: 'rgba(248, 113, 113, 0.15)',
            border: '1px solid rgba(248, 113, 113, 0.35)',
            color: '#fca5a5',
            padding: '0.9rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1.5rem',
          }}
        >
          <strong>Voice preview:</strong> {previewError}
        </div>
      )}

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h2>Manage Agent Configurations</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Configure system instructions and assign published Urdu voices.
            </p>
          </div>
          <button onClick={openCreateModal} className="btn-primary">
            + Configure Agent
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Agent ID</th>
              <th>Agent Name</th>
              <th>Assigned Voice</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5}>Loading agents...</td>
              </tr>
            )}
            {!loading && agents.length === 0 && (
              <tr>
                <td colSpan={5}>No agents found yet. Create one to begin.</td>
              </tr>
            )}
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td
                  style={{
                    fontFamily: 'monospace',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  {agent.id}
                </td>
                <td style={{ fontWeight: 600 }}>{agent.name}</td>
                <td>
                  <span className="badge badge-green">{agent.voice_id}</span>
                </td>
                <td>
                  <span className="badge badge-green">Active</span>
                </td>
                <td>
                  <button
                    onClick={() => openEditModal(agent)}
                    className="btn-secondary"
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    Edit Settings & Voice
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h2>
              Complete Uplift Urdu Voice Catalogue ({voices.length}{' '}
              Published Voices)
            </h2>
            <p
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.95rem',
                marginTop: '0.2rem',
              }}
            >
              Select an Urdu voice entry for your AI agent and preview it before saving.
            </p>
          </div>
          <div className="badge badge-purple" style={{ padding: '0.4rem 0.8rem' }}>
            Voice Picker
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            marginBottom: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            placeholder="Search voices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              minWidth: '240px',
              padding: '0.75rem 1rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-card)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '0.95rem',
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['All', 'Male', 'Female', 'Unspecified'].map((gender) => (
              <button
                key={gender}
                onClick={() => setGenderFilter(gender)}
                className={genderFilter === gender ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.6rem 1rem', fontSize: '0.85rem' }}
              >
                {gender}
              </button>
            ))}
          </div>
        </div>

        <div
          className="voice-grid"
          style={{ maxHeight: '520px', overflowY: 'auto', paddingRight: '0.5rem' }}
        >
          {filteredVoices.map((voice) => {
            const isSelected = selectedVoice === voice.id;
            const isPlaying = playingVoice === voice.id;
            const previewAvailable = Boolean(voice.previewUrl);

            return (
              <div
                key={voice.id}
                className={`voice-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedVoice(voice.id)}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <div className="voice-title">{voice.displayName}</div>
                    <span
                      className={`badge ${
                        voice.gender.toLowerCase() === 'female'
                          ? 'badge-purple'
                          : voice.gender.toLowerCase() === 'male'
                            ? 'badge-blue'
                            : 'badge-green'
                      }`}
                    >
                      {voice.gender}
                    </span>
                  </div>
                  <div
                    className="voice-meta"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: 'var(--accent-cyan)',
                    }}
                  >
                    ID: {voice.id}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '1rem',
                    gap: '0.75rem',
                  }}
                >
                  <button
                    onClick={(event) => void handlePlayAudio(voice, event)}
                    className="btn-secondary"
                    disabled={!previewAvailable}
                    style={{
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      opacity: previewAvailable ? 1 : 0.55,
                      cursor: previewAvailable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {!previewAvailable
                      ? 'No Preview'
                      : isPlaying
                        ? 'Stop Preview'
                        : 'Play Sample'}
                  </button>

                  {isSelected && (
                    <span
                      style={{
                        color: 'var(--primary)',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                      }}
                    >
                      Selected
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div className="glass-card" style={{ width: '550px', background: '#0b1120' }}>
            <h2 style={{ marginBottom: '1rem' }}>
              {editingAgentId ? 'Edit Agent Configuration' : 'Create Agent'}
            </h2>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                Agent Display Name
              </label>
              <input
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                System Prompt
              </label>
              <textarea
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.4rem',
                }}
              >
                Assigned Urdu Voice
              </label>
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  background: '#1e293b',
                  border: '1px solid var(--border-card)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                }}
              >
                {voices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.displayName} ({voice.gender})
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'flex-end',
              }}
            >
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                className="btn-primary"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
