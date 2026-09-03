import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';
import { Mic, MicOff, Radio, Volume2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function VoiceRoom({ onMealUpdate }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Voice assistant is idle. Click to start.');
  const [recentAction, setRecentAction] = useState(null);
  const [error, setError] = useState(null);

  const roomRef = useRef(null);
  const audioTrackRef = useRef(null);

  const connectToVoice = async () => {
    setIsConnecting(true);
    setError(null);
    setStatusMessage('Connecting to Beet LiveKit Cloud...');

    try {
      // 1. Get token from backend
      const tokenData = await api.getLivekitToken('beet-meal-logger');
      if (!tokenData || !tokenData.token) {
        throw new Error('Could not obtain LiveKit access token from backend');
      }

      // 2. Instantiate Room
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // 3. Set up event listeners
      room.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        setIsConnecting(false);
        setStatusMessage("Listening... Say: 'I had two rotis and a katori of dal for lunch'");
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        setIsConnecting(false);
        setStatusMessage('Disconnected. Click to start again.');
      });

      // Listen for data packets broadcast by the agent for instant sub-100ms sync
      room.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const str = new TextDecoder().decode(payload);
          const data = JSON.parse(str);
          if (data.type === 'MEAL_LOG_UPDATED') {
            setRecentAction({
              action: data.action,
              timestamp: new Date().toLocaleTimeString(),
            });
            if (onMealUpdate) {
              onMealUpdate();
            }
          }
        } catch (err) {
          console.error('Error decoding room data packet:', err);
        }
      });

      // Handle remote audio from agent (TTS speech)
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === 'audio') {
          const element = track.attach();
          document.body.appendChild(element);
        }
      });

      // 4. Connect to LiveKit
      await room.connect(tokenData.url, tokenData.token);

      // Explicitly unlock browser audio playback for agent speech
      try {
        await room.startAudio();
      } catch (audioErr) {
        console.warn('Audio autoplay requires user gesture or already started:', audioErr);
      }

      // 5. Publish microphone
      try {
        const audioTrack = await createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        audioTrackRef.current = audioTrack;
        await room.localParticipant.publishTrack(audioTrack);
        setIsMuted(false);
      } catch (micErr) {
        console.warn('Microphone permission not granted or audio track failed:', micErr);
        setStatusMessage('Connected (Mic error: ' + micErr.message + ')');
      }
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err.message || 'Failed to connect to LiveKit');
      setIsConnected(false);
      setIsConnecting(false);
      setStatusMessage('Connection failed. Please check backend credentials.');
    }
  };

  const disconnectVoice = async () => {
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
      audioTrackRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setStatusMessage('Voice assistant stopped.');
  };

  const toggleMute = async () => {
    if (!roomRef.current) return;
    const newMuted = !isMuted;
    await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
  };

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div
      style={{
        background: isConnected
          ? 'linear-gradient(135deg, #fff1f2 0%, #ffffff 100%)'
          : 'var(--surface-card)',
        border: isConnected ? '2px solid var(--beet-primary)' : '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        boxShadow: isConnected ? '0 10px 25px -5px rgba(225, 29, 72, 0.15)' : 'var(--shadow-md)',
        transition: 'all 0.3s ease',
        marginBottom: '28px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: isConnected ? 'var(--beet-gradient)' : 'var(--surface-subtle)',
              color: isConnected ? '#ffffff' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isConnected ? '0 4px 12px rgba(225, 29, 72, 0.3)' : 'none',
            }}
          >
            <Radio size={28} className={isConnected ? 'pulsing-dot' : ''} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                LiveKit Voice Assistant
              </h2>
              {isConnected && (
                <span
                  style={{
                    background: 'var(--emerald-light)',
                    color: 'var(--emerald-primary)',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span className="pulsing-dot" style={{ width: '8px', height: '8px' }}></span>
                  ACTIVE
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {statusMessage}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isConnected && (
            <button
              onClick={toggleMute}
              style={{
                background: isMuted ? '#fef2f2' : 'var(--surface-subtle)',
                color: isMuted ? 'var(--beet-primary)' : 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600',
              }}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          )}

          {!isConnected ? (
            <button
              onClick={connectToVoice}
              disabled={isConnecting}
              style={{
                background: 'var(--beet-gradient)',
                color: '#ffffff',
                borderRadius: 'var(--radius-md)',
                padding: '12px 24px',
                fontSize: '0.95rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.25)',
                opacity: isConnecting ? 0.7 : 1,
              }}
            >
              <Mic size={20} />
              {isConnecting ? 'Connecting...' : 'Start Voice Assistant'}
            </button>
          ) : (
            <button
              onClick={disconnectVoice}
              style={{
                background: '#f1f5f9',
                color: '#475569',
                borderRadius: 'var(--radius-md)',
                padding: '12px 20px',
                fontWeight: '600',
              }}
            >
              Disconnect
            </button>
          )}
        </div>
      </div>

      {/* Suggested Spoken Commands Banner */}
      <div
        style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px dashed var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontSize: '0.8rem',
            fontWeight: '700',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Sparkles size={14} color="var(--beet-primary)" /> Try saying:
        </span>
        <span
          style={{
            fontSize: '0.82rem',
            background: 'var(--surface-subtle)',
            padding: '4px 12px',
            borderRadius: '16px',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          "I had two rotis and a katori of dal for lunch."
        </span>
        <span
          style={{
            fontSize: '0.82rem',
            background: 'var(--surface-subtle)',
            padding: '4px 12px',
            borderRadius: '16px',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          "Actually make that three rotis."
        </span>
        <span
          style={{
            fontSize: '0.82rem',
            background: 'var(--surface-subtle)',
            padding: '4px 12px',
            borderRadius: '16px',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          "Remove the chai I logged this morning."
        </span>
      </div>

      {recentAction && (
        <div
          style={{
            marginTop: '12px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8rem',
            color: 'var(--emerald-primary)',
            fontWeight: '600',
          }}
        >
          <CheckCircle2 size={14} /> Real-time sync: updated via voice ({recentAction.action} at {recentAction.timestamp})
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            color: 'var(--beet-primary)',
            background: '#fff1f2',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}
    </div>
  );
}
