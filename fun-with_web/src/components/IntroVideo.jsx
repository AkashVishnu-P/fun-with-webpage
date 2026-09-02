import React, { useState, useRef, useEffect } from 'react';

/**
 * IntroVideo.jsx
 * Fullscreen intro video overlay with:
 * - Robust multi-source support (.mp4, .webm, .mov)
 * - Blob URL / local file selector if needed
 * - Autoplay & unmute / audio toggle
 * - Skip button
 * - Animated transition overlay fading out into the 3D game
 * - Fallback / placeholder screen with clear diagnostic message
 */
export function IntroVideo({ onComplete, videoSrc = '/intro.mp4' }) {
  const [isFading, setIsFading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [customSrc, setCustomSrc] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeSrc = customSrc || videoSrc;

  const handleFinish = () => {
    if (isFading) return;
    setIsFading(true);
    // Smooth 800ms fade transition out
    setTimeout(() => {
      onComplete();
    }, 800);
  };

  const toggleAudio = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomSrc(url);
      setHasError(false);
      setErrorMessage('');
    }
  };

  const handleVideoError = (e) => {
    const video = e.currentTarget;
    let msg = 'Unsupported media format or file not found.';
    if (video.error) {
      switch (video.error.code) {
        case 1:
          msg = 'Video playback aborted.';
          break;
        case 2:
          msg = 'Network error while loading video.';
          break;
        case 3:
          msg = 'Video decoding failed. The MP4 codec (e.g. HEVC/H.265 or ProRes) is not supported by your browser. Convert it to H.264/AAC.';
          break;
        case 4:
          msg = 'File not found at ' + activeSrc + ' or video format is unsupported.';
          break;
        default:
          msg = video.error.message || 'Media playback error.';
      }
    }
    setErrorMessage(msg);
    setHasError(true);
  };

  // Try playing whenever activeSrc changes
  useEffect(() => {
    if (videoRef.current && !hasError) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        // Autoplay policy might require mute
        if (videoRef.current) {
          videoRef.current.muted = true;
          setIsMuted(true);
          videoRef.current.play().catch(() => {});
        }
      });
    }
  }, [activeSrc, hasError]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#020814',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isFading ? 0 : 1,
        transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: isFading ? 'none' : 'auto',
      }}
    >
      {!hasError ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isMuted}
          onEnded={handleFinish}
          onError={handleVideoError}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src={activeSrc} type="video/mp4; codecs=avc1.42E01E,mp4a.40.2" />
          <source src={activeSrc} type="video/mp4" />
          <source src={activeSrc} type="video/webm" />
          <source src={activeSrc} type="video/quicktime" />
          <source src={activeSrc} />
        </video>
      ) : (
        /* Diagnostic & Fallback Screen */
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'radial-gradient(circle at center, #0a1931 0%, #020814 85%)',
            color: '#fff',
            fontFamily: "'JetBrains Mono', monospace",
            textAlign: 'center',
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '70px',
              height: '70px',
              borderRadius: '50%',
              border: '2px solid #ef4444',
              boxShadow: '0 0 25px rgba(239, 68, 68, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>

          <h1
            style={{
              fontSize: '22px',
              letterSpacing: '3px',
              color: '#f87171',
              margin: '0 0 10px 0',
              fontWeight: 800,
            }}
          >
            MEDIA TYPE ERROR
          </h1>

          <p
            style={{
              fontSize: '12px',
              color: '#e2e8f0',
              maxWidth: '560px',
              lineHeight: 1.6,
              margin: '0 0 16px 0',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
            }}
          >
            {errorMessage || 'Your browser cannot decode this MP4 file. Browsers only support H.264 video codec, not HEVC / H.265 / ProRes.'}
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
              marginBottom: '24px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              Select any working video directly from your computer to preview:
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: 'rgba(0, 229, 255, 0.15)',
                border: '1px solid #00e5ff',
                borderRadius: '6px',
                color: '#00e5ff',
                fontWeight: 600,
                fontSize: '12px',
                padding: '8px 18px',
                cursor: 'pointer',
                letterSpacing: '1px',
              }}
            >
              📁 CHOOSE VIDEO FILE (.MP4 / .WEBM)
            </button>
          </div>

          <button
            onClick={handleFinish}
            style={{
              background: 'linear-gradient(135deg, #00e5ff 0%, #0077b6 100%)',
              border: 'none',
              borderRadius: '6px',
              color: '#020814',
              fontWeight: 700,
              fontSize: '13px',
              letterSpacing: '2px',
              padding: '12px 30px',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0, 229, 255, 0.4)',
            }}
          >
            SKIP TO GAME ▶
          </button>
        </div>
      )}

      {/* Top HUD Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          display: 'flex',
          gap: '12px',
          zIndex: 10,
        }}
      >
        {!hasError && (
          <button
            onClick={toggleAudio}
            style={{
              background: 'rgba(2, 8, 20, 0.75)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0, 229, 255, 0.4)',
              borderRadius: '6px',
              color: '#00e5ff',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              letterSpacing: '1px',
              padding: '8px 14px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {isMuted ? '🔇 UNMUTE' : '🔊 MUTE'}
          </button>
        )}

        <button
          onClick={handleFinish}
          style={{
            background: 'rgba(2, 8, 20, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #00e5ff',
            borderRadius: '6px',
            color: '#00e5ff',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            fontSize: '12px',
            letterSpacing: '2px',
            padding: '8px 20px',
            cursor: 'pointer',
            boxShadow: '0 0 15px rgba(0, 229, 255, 0.3)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)';
            e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 229, 255, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(2, 8, 20, 0.85)';
            e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 229, 255, 0.3)';
          }}
        >
          SKIP INTRO ⏩
        </button>
      </div>

      {/* Cyber Corner HUD Details */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '10px',
          color: 'rgba(0, 229, 255, 0.6)',
          letterSpacing: '2px',
          pointerEvents: 'none',
        }}
      >
        <span>STATUS: SYSTEM READY</span>
        <span style={{ margin: '0 8px' }}>|</span>
        <span>LOCATION: MANHATTAN SECTOR 7</span>
      </div>
    </div>
  );
}
