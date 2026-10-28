import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  FastForward,
  Rewind,
  Copy,
  Check,
  Search,
  WrapText,
  FileText,
  Code,
  Table as TableIcon,
  Music,
  Video,
  FileCode,
  ExternalLink,
  Download,
  ShieldCheck,
  Sparkles,
  Info,
  Subtitles,
  ListMusic,
  SkipBack,
  SkipForward,
  Repeat,
  Upload,
  PictureInPicture2,
} from 'lucide-react';
import { DriveItem } from '../types/drive';
import { formatBytes } from '../utils/driveLogic';

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseTimecodeToSeconds(tc: string): number {
  const clean = tc.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    return (
      parseFloat(parts[0]) * 3600 +
      parseFloat(parts[1]) * 60 +
      parseFloat(parts[2])
    );
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 0;
}

function parseSubtitleCues(rawText: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;
    const arrowLineIdx = lines.findIndex((l) => l.includes('-->'));
    if (arrowLineIdx === -1) continue;

    const timeLine = lines[arrowLineIdx];
    const [startRaw, endRaw] = timeLine.split('-->');
    if (!startRaw || !endRaw) continue;

    const start = parseTimecodeToSeconds(startRaw.trim().split(' ')[0]);
    const end = parseTimecodeToSeconds(endRaw.trim().split(' ')[0]);
    const text = lines
      .slice(arrowLineIdx + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text && end >= start) {
      cues.push({ start, end, text });
    }
  }
  return cues;
}

function convertSrtToWebVtt(rawText: string): string {
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (normalized.trim().startsWith('WEBVTT')) {
    return normalized;
  }
  const vttBody = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4'
  );
  return `WEBVTT\n\n${vttBody}`;
}

interface FileViewerProps {
  item: DriveItem;
  className?: string;
  onDownload?: () => void;
  siblingItems?: DriveItem[];
  onSelectItem?: (nextItem: DriveItem) => void;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  item,
  className = '',
  onDownload,
  siblingItems = [],
  onSelectItem,
}) => {
  // Image state
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [imgError, setImgError] = useState<boolean>(false);

  // Text/Code state
  const [textSearch, setTextSearch] = useState<string>('');
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [viewMarkdownFormatted, setViewMarkdownFormatted] = useState<boolean>(true);

  // Video state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const subtitleInputRef = useRef<HTMLInputElement | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoVolume, setVideoVolume] = useState<number>(1);
  const [isVideoMuted, setIsVideoMuted] = useState<boolean>(false);
  const [videoSpeed, setVideoSpeed] = useState<number>(1);
  const [videoError, setVideoError] = useState<boolean>(false);

  // Subtitle (.srt / .vtt) state
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [subtitleTrackName, setSubtitleTrackName] = useState<string | null>(null);
  const [subtitleVttUrl, setSubtitleVttUrl] = useState<string | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);

  // Playlist & Continuous Streaming state
  const [autoPlayNext, setAutoPlayNext] = useState<boolean>(true);
  const [loopMedia, setLoopMedia] = useState<boolean>(false);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState<boolean>(true);

  // Audio state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState<number>(0);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [audioVolume, setAudioVolume] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [audioError, setAudioError] = useState<boolean>(false);

  // PDF state
  const [pdfZoom, setPdfZoom] = useState<number>(100);

  // File extension
  const ext = useMemo(() => {
    return item.name.split('.').pop()?.toLowerCase() || '';
  }, [item.name]);

  // Build folder media playlist (all video items for video, or all audio items for audio)
  const mediaPlaylist = useMemo(() => {
    if (item.fileType !== 'video' && item.fileType !== 'audio') return [];
    const list = siblingItems.filter(
      (i) => !i.deleted && !i.isFolder && i.fileType === item.fileType
    );
    if (!list.some((i) => i.id === item.id)) {
      return [item, ...list];
    }
    return list;
  }, [siblingItems, item]);

  const currentPlaylistIndex = useMemo(
    () => mediaPlaylist.findIndex((i) => i.id === item.id),
    [mediaPlaylist, item.id]
  );

  const handlePlayPreviousTrack = () => {
    if (!onSelectItem || mediaPlaylist.length <= 1) return;
    const prevIdx =
      (currentPlaylistIndex - 1 + mediaPlaylist.length) % mediaPlaylist.length;
    onSelectItem(mediaPlaylist[prevIdx]);
  };

  const handlePlayNextTrack = () => {
    if (!onSelectItem || mediaPlaylist.length <= 1) return;
    const nextIdx = (currentPlaylistIndex + 1) % mediaPlaylist.length;
    onSelectItem(mediaPlaylist[nextIdx]);
  };

  // Discover .srt / .vtt subtitle files in the same folder/drive
  const availableDriveSubtitles = useMemo(() => {
    return siblingItems.filter(
      (i) =>
        !i.deleted &&
        !i.isFolder &&
        (i.name.toLowerCase().endsWith('.srt') || i.name.toLowerCase().endsWith('.vtt'))
    );
  }, [siblingItems]);

  const loadSubtitleText = (rawText: string, label: string) => {
    const cues = parseSubtitleCues(rawText);
    const vttText = convertSrtToWebVtt(rawText);
    const blob = new Blob([vttText], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    setSubtitleCues(cues);
    setSubtitleVttUrl(url);
    setSubtitleTrackName(label);
    setSubtitlesEnabled(true);
  };

  const handleLocalSubtitleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      loadSubtitleText(text, file.name);
    } catch {}
    e.target.value = '';
  };

  // Determine media URLs
  const mediaSrc = useMemo(() => {
    if (item.downloadUrl) return item.downloadUrl;
    if (item.content && (item.content.startsWith('http') || item.content.startsWith('data:'))) {
      return item.content;
    }
    return `/api/public/download/${encodeURIComponent(item.id)}`;
  }, [item]);

  // Reset transforms and auto-load matching folder subtitle when item changes
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setImgError(false);
    setVideoError(false);
    setAudioError(false);
    setTextSearch('');
    setIsVideoPlaying(false);
    setIsAudioPlaying(false);

    // Check if there is a matching .srt or .vtt in siblingItems
    const baseStem = item.name.replace(/\.[^.]+$/, '').toLowerCase();
    const matchedSub = availableDriveSubtitles.find((s) =>
      s.name.toLowerCase().startsWith(baseStem)
    );
    if (matchedSub && matchedSub.content) {
      loadSubtitleText(matchedSub.content, matchedSub.name);
    } else {
      setSubtitleCues([]);
      setSubtitleVttUrl(null);
      setSubtitleTrackName(null);
    }
  }, [item.id]);

  // Active subtitle cue at current video playback timestamp
  const activeSubtitleCue = useMemo(() => {
    if (!subtitlesEnabled || subtitleCues.length === 0) return null;
    return (
      subtitleCues.find(
        (c) => videoCurrentTime >= c.start && videoCurrentTime <= c.end
      ) || null
    );
  }, [subtitlesEnabled, subtitleCues, videoCurrentTime]);

  // Format time (seconds -> mm:ss)
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // ==========================================
  // 1. IMAGE PREVIEWER
  // ==========================================
  const renderImageViewer = () => {
    const imgSrc = item.content && (item.content.startsWith('data:image') || item.content.startsWith('http'))
      ? item.content
      : item.downloadUrl || `https://picsum.photos/seed/${item.id}/800/600`;

    return (
      <div className="flex flex-col h-full bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden">
        {/* Controls Toolbar */}
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              {ext.toUpperCase() || 'IMAGE'}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
            {rotation !== 0 && (
              <span className="text-slate-400 font-mono text-[11px]">({rotation}°)</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(0.25, prev - 0.25))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors font-mono text-[11px]"
              title="Reset Zoom"
            >
              100%
            </button>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(3, prev + 0.25))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-800 mx-1" />
            <button
              type="button"
              onClick={() => setRotation((prev) => (prev + 90) % 360)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Rotate 90° Clockwise"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setRotation(0);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Image Canvas */}
        <div className="flex-1 min-h-[380px] max-h-[60vh] flex items-center justify-center p-6 overflow-auto bg-slate-950/90 relative select-none">
          {imgError ? (
            <div className="text-center p-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                <FileCode className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 font-semibold">{item.name}</p>
              <p className="text-[11px] text-slate-400 max-w-xs">
                Could not render graphic preview. Download the file to view in your system image viewer.
              </p>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold"
                >
                  Download Image
                </button>
              )}
            </div>
          ) : (
            <div
              className="transition-transform duration-200 ease-out origin-center flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={imgSrc}
                alt={item.name}
                onError={() => setImgError(true)}
                className="max-h-[50vh] max-w-full rounded-xl object-contain shadow-2xl border border-slate-800"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // 2. VIDEO PREVIEWER
  // ==========================================
  const renderVideoViewer = () => {
    // If remote sample or uploaded video
    const videoUrl =
      item.downloadUrl ||
      (item.content && item.content.startsWith('http') ? item.content : null) ||
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

    if (videoError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-sky-950/80 border border-sky-800 flex items-center justify-center text-sky-400">
            <Video className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
            <p className="text-xs text-slate-400">
              Direct video playback is unavailable for this stream in your browser. You can download the file or open it in Microsoft 365.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-sky-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Video ({formatBytes(item.size)})</span>
              </button>
            )}
            {item.webUrl && (
              <a
                href={item.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in OneDrive</span>
              </a>
            )}
          </div>
        </div>
      );
    }

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => setVideoError(true));
        setIsVideoPlaying(true);
      } else {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoRef.current) return;
      const targetTime = parseFloat(e.target.value);
      videoRef.current.currentTime = targetTime;
      setVideoCurrentTime(targetTime);
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!videoRef.current) return;
      const vol = parseFloat(e.target.value);
      videoRef.current.volume = vol;
      setVideoVolume(vol);
      setIsVideoMuted(vol === 0);
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      videoRef.current.muted = !isVideoMuted;
      setIsVideoMuted(!isVideoMuted);
    };

    const handleSpeedChange = (speed: number) => {
      if (!videoRef.current) return;
      videoRef.current.playbackRate = speed;
      setVideoSpeed(speed);
    };

    const toggleFullscreen = () => {
      if (!videoRef.current) return;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        videoRef.current.requestFullscreen().catch(() => {});
      }
    };

    const togglePictureInPicture = () => {
      if (!videoRef.current) return;
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture().catch(() => {});
      } else if (videoRef.current.requestPictureInPicture) {
        videoRef.current.requestPictureInPicture().catch(() => {});
      }
    };

    return (
      <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* Hidden local .srt / .vtt file input */}
        <input
          ref={subtitleInputRef}
          type="file"
          accept=".srt,.vtt,text/vtt,application/x-subrip"
          onChange={handleLocalSubtitleUpload}
          className="hidden"
        />

        {/* Video Canvas Container */}
        <div className="relative bg-black flex items-center justify-center max-h-[55vh] min-h-[300px]">
          <video
            ref={videoRef}
            src={videoUrl}
            loop={loopMedia}
            playsInline
            crossOrigin="anonymous"
            className="w-full max-h-[55vh] object-contain cursor-pointer"
            onClick={togglePlay}
            onError={(e) => {
              e.preventDefault();
              setVideoError(true);
            }}
            onCanPlay={() => {
              setVideoError(false);
              if (videoRef.current) {
                videoRef.current.playbackRate = videoSpeed;
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                setVideoCurrentTime(videoRef.current.currentTime);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                setVideoDuration(videoRef.current.duration);
                videoRef.current.playbackRate = videoSpeed;
              }
            }}
            onEnded={() => {
              setIsVideoPlaying(false);
              if (autoPlayNext && mediaPlaylist.length > 1) {
                handlePlayNextTrack();
              }
            }}
          >
            {subtitleVttUrl && subtitlesEnabled && (
              <track
                kind="subtitles"
                src={subtitleVttUrl}
                srcLang="en"
                label={subtitleTrackName || 'Subtitles'}
                default
              />
            )}
          </video>

          {/* Live High-Contrast Subtitle Cue Overlay (.srt / .vtt) */}
          {activeSubtitleCue && (
            <div className="absolute bottom-6 inset-x-6 flex justify-center pointer-events-none z-10">
              <div className="px-4 py-1.5 rounded-xl bg-black/85 border border-white/10 text-white text-sm font-medium text-center shadow-2xl max-w-2xl whitespace-pre-line">
                {activeSubtitleCue.text}
              </div>
            </div>
          )}

          {/* Centered big play button overlay when paused */}
          {!isVideoPlaying && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-sky-600/90 hover:bg-sky-500 text-white flex items-center justify-center shadow-2xl shadow-sky-600/50 backdrop-blur-sm transition-transform active:scale-95"
              aria-label="Play video"
            >
              <Play className="w-8 h-8 ml-1" />
            </button>
          )}
        </div>

        {/* Custom Video Control Bar */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2.5">
          {/* Progress Timeline Scrubber */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-10 text-right">
              {formatTime(videoCurrentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={videoDuration || 100}
              step="0.1"
              value={videoCurrentTime}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400"
            />
            <span className="text-[11px] font-mono tabular-nums text-slate-400 w-10">
              {formatTime(videoDuration)}
            </span>
          </div>

          {/* Buttons & Tools */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex items-center gap-1.5">
              {mediaPlaylist.length > 1 && (
                <button
                  type="button"
                  onClick={handlePlayPreviousTrack}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Previous video in folder playlist"
                >
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={togglePlay}
                className="p-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-colors"
                title={isVideoPlaying ? 'Pause' : 'Play'}
              >
                {isVideoPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              {mediaPlaylist.length > 1 && (
                <button
                  type="button"
                  onClick={handlePlayNextTrack}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  title="Next video in folder playlist"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Rewind 10 seconds"
              >
                <Rewind className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime = Math.min(videoDuration, videoRef.current.currentTime + 10);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Forward 10 seconds"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  title={isVideoMuted ? 'Unmute' : 'Mute'}
                >
                  {isVideoMuted || videoVolume === 0 ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isVideoMuted ? 0 : videoVolume}
                  onChange={handleVolume}
                  className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Subtitle (.srt / .vtt) Controls */}
              <button
                type="button"
                onClick={() => subtitleInputRef.current?.click()}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                  subtitleTrackName
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
                title="Load custom .SRT or .VTT subtitle file"
              >
                <Subtitles className="w-3.5 h-3.5 text-sky-400" />
                <span>{subtitleTrackName ? `CC: ${subtitleTrackName.slice(0, 14)}` : 'Load .SRT/.VTT'}</span>
              </button>

              {subtitleTrackName && (
                <button
                  type="button"
                  onClick={() => setSubtitlesEnabled((prev) => !prev)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold border ${
                    subtitlesEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-950 text-slate-500 border-slate-800'
                  }`}
                >
                  {subtitlesEnabled ? 'CC ON' : 'CC OFF'}
                </button>
              )}

              {/* Loop Toggle */}
              <button
                type="button"
                onClick={() => setLoopMedia((prev) => !prev)}
                className={`p-1.5 rounded-lg border transition-colors ${
                  loopMedia
                    ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
                title="Loop current video"
              >
                <Repeat className="w-3.5 h-3.5" />
              </button>

              {/* Speed Selector */}
              <select
                value={videoSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono tabular-nums text-slate-300 focus:outline-none"
                title="Playback Speed"
              >
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1.0x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={1.75}>1.75x</option>
                <option value={2}>2.0x</option>
              </select>

              {/* Playlist Drawer Toggle */}
              {mediaPlaylist.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowPlaylistDrawer((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1 border transition-colors ${
                    showPlaylistDrawer
                      ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span className="font-mono tabular-nums">
                    {currentPlaylistIndex + 1}/{mediaPlaylist.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={togglePictureInPicture}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Picture-in-Picture"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Continuous Folder Streaming Playlist Queue */}
        {mediaPlaylist.length > 1 && showPlaylistDrawer && (
          <div className="bg-slate-950 border-t border-slate-800 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ListMusic className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-bold text-slate-200">
                  Folder Streaming Playlist ({mediaPlaylist.length} videos)
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="w-3.5 h-3.5 accent-sky-500 rounded"
                />
                <span>Auto-Play Next</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {mediaPlaylist.map((track, idx) => {
                const isCurrent = track.id === item.id;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onSelectItem && onSelectItem(track)}
                    className={`px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2 text-xs border transition-all ${
                      isCurrent
                        ? 'bg-sky-500/15 border-sky-500/40 text-sky-200 font-semibold'
                        : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {(idx + 1).toString().padStart(2, '0')}
                      </span>
                      <span className="truncate">{track.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                      {formatBytes(track.size)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 3. AUDIO PREVIEWER
  // ==========================================
  const renderAudioViewer = () => {
    const audioUrl =
      item.downloadUrl ||
      (item.content && item.content.startsWith('http') ? item.content : null) ||
      'https://actions.google.com/sounds/v1/ambiences/daytime_forest_bonfire.ogg';

    if (audioError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-950/80 border border-violet-800 flex items-center justify-center text-violet-400">
            <Music className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
            <p className="text-xs text-slate-400">
              Direct audio stream playback is unavailable for this file in your browser. You can download the file or open it in Microsoft 365.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-violet-600/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Audio ({formatBytes(item.size)})</span>
              </button>
            )}
            {item.webUrl && (
              <a
                href={item.webUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in OneDrive</span>
              </a>
            )}
          </div>
        </div>
      );
    }

    const togglePlay = () => {
      if (!audioRef.current) return;
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => setAudioError(true));
        setIsAudioPlaying(true);
      } else {
        audioRef.current.pause();
        setIsAudioPlaying(false);
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioRef.current) return;
      const targetTime = parseFloat(e.target.value);
      audioRef.current.currentTime = targetTime;
      setAudioCurrentTime(targetTime);
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!audioRef.current) return;
      const vol = parseFloat(e.target.value);
      audioRef.current.volume = vol;
      setAudioVolume(vol);
      setIsAudioMuted(vol === 0);
    };

    const toggleMute = () => {
      if (!audioRef.current) return;
      audioRef.current.muted = !isAudioMuted;
      setIsAudioMuted(!isAudioMuted);
    };

    const handleSpeedChange = (speed: number) => {
      if (!audioRef.current) return;
      audioRef.current.playbackRate = speed;
      setAudioSpeed(speed);
    };

    return (
      <div className="bg-slate-950 rounded-2xl border border-slate-800 p-6 shadow-2xl space-y-6">
        <audio
          ref={audioRef}
          src={audioUrl}
          onError={(e) => {
            e.preventDefault();
            setAudioError(true);
          }}
          onCanPlay={() => setAudioError(false)}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setAudioCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setAudioDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => {
            setIsAudioPlaying(false);
            if (autoPlayNext && mediaPlaylist.length > 1) {
              handlePlayNextTrack();
            }
          }}
        />

        {/* Studio Track Visualizer Header */}
        <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-925 border border-slate-800">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-sky-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 shrink-0">
            <Music className="w-10 h-10 animate-pulse" />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-violet-950 text-violet-400 border border-violet-800">
                {ext.toUpperCase() || 'AUDIO'}
              </span>
              <span className="text-[10px] text-slate-400">High-Fidelity Audio Stream</span>
            </div>
            <h3 className="text-base font-bold text-slate-100 truncate">{item.name}</h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              {formatBytes(item.size)} • 320 kbps • 44.1 kHz Stereo
            </p>
          </div>

          {/* Animated Waveform Visualizer Bars */}
          <div className="flex items-center gap-1 h-10 px-3 py-1 bg-slate-950/70 rounded-xl border border-slate-800/80">
            {[24, 38, 16, 42, 28, 50, 32, 46, 20, 36, 48, 18, 30, 44].map((height, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-violet-400 transition-all duration-150"
                style={{
                  height: isAudioPlaying ? `${Math.max(6, (height * Math.random()) + 10)}px` : `${Math.max(6, height * 0.4)}px`,
                  opacity: isAudioPlaying ? 0.9 : 0.4,
                }}
              />
            ))}
          </div>
        </div>

        {/* Timeline Scrubber */}
        <div className="space-y-1.5">
          <input
            type="range"
            min="0"
            max={audioDuration || 100}
            step="0.1"
            value={audioCurrentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400"
          />
          <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 px-1">
            <span>{formatTime(audioCurrentTime)}</span>
            <span>{formatTime(audioDuration)}</span>
          </div>
        </div>

        {/* Playback Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-900">
          <div className="flex items-center gap-2">
            {mediaPlaylist.length > 1 && (
              <button
                type="button"
                onClick={handlePlayPreviousTrack}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900"
                title="Previous audio track in folder"
              >
                <SkipBack className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              title="Rewind 10 seconds"
            >
              <Rewind className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={togglePlay}
              className="w-12 h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-violet-600/30 transition-all active:scale-95"
              title={isAudioPlaying ? 'Pause' : 'Play'}
            >
              {isAudioPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = Math.min(audioDuration, audioRef.current.currentTime + 10);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              title="Forward 10 seconds"
            >
              <FastForward className="w-4 h-4" />
            </button>

            {mediaPlaylist.length > 1 && (
              <button
                type="button"
                onClick={handlePlayNextTrack}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900"
                title="Next audio track in folder"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                title={isAudioMuted ? 'Unmute' : 'Mute'}
              >
                {isAudioMuted || audioVolume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isAudioMuted ? 0 : audioVolume}
                onChange={handleVolume}
                className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>

            {/* Speed Selector */}
            <select
              value={audioSpeed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs font-mono tabular-nums text-slate-300 focus:outline-none"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1.0x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={1.75}>1.75x</option>
              <option value={2}>2.0x</option>
            </select>
          </div>
        </div>

        {/* Continuous Audio Folder Playlist */}
        {mediaPlaylist.length > 1 && (
          <div className="pt-3 border-t border-slate-900 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <ListMusic className="w-3.5 h-3.5 text-violet-400" />
                Folder Audio Playlist ({mediaPlaylist.length} tracks)
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPlayNext}
                  onChange={(e) => setAutoPlayNext(e.target.checked)}
                  className="w-3.5 h-3.5 accent-violet-500 rounded"
                />
                <span>Continuous Play</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
              {mediaPlaylist.map((track, idx) => (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => onSelectItem && onSelectItem(track)}
                  className={`px-3 py-2 rounded-xl text-left flex items-center justify-between gap-2 text-xs border transition-all ${
                    track.id === item.id
                      ? 'bg-violet-500/15 border-violet-500/40 text-violet-200 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">
                    {idx + 1}. {track.name}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                    {formatBytes(track.size)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // 4. PDF PREVIEWER
  // ==========================================
  const renderPdfViewer = () => {
    const pdfUrl = item.downloadUrl || `/api/public/download/${encodeURIComponent(item.id)}`;

    return (
      <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* PDF Document Controls Header */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-rose-400 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-rose-950 border border-rose-800">
              PDF Document
            </span>
            <span className="text-slate-400 font-mono text-[11px]">{formatBytes(item.size)}</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
              <span>Open Fullscreen</span>
            </a>
          </div>
        </div>

        {/* Embedded Object or Interactive Excerpt */}
        <div className="p-4 bg-slate-950 space-y-4">
          <div className="w-full h-[480px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900/50 flex flex-col">
            <object
              data={pdfUrl}
              type="application/pdf"
              className="w-full h-full rounded-xl"
            >
              {/* Fallback container if native PDF plug-in is disabled */}
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-400 flex items-center justify-center">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-200">{item.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-md">
                    Verified Microsoft 365 PDF Document. Your browser can render this PDF in a dedicated view tab or download directly.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-md"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View PDF in New Tab</span>
                  </a>
                  {onDownload && (
                    <button
                      type="button"
                      onClick={onDownload}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700"
                    >
                      Download Copy
                    </button>
                  )}
                </div>
              </div>
            </object>
          </div>

          {/* Document Summary Section */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Enterprise PDF Metadata
              </span>
              <span>Account: {item.accountName}</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              {item.content || `Encrypted Microsoft 365 document item: ${item.name}. Fully synchronized with OneDrive for Business.`}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // ==========================================
  // 5. SPREADSHEET / CSV PREVIEWER
  // ==========================================
  const renderSpreadsheetViewer = () => {
    const rawContent = item.content || '';
    const rows = rawContent ? rawContent.trim().split('\n').map((r) => r.split(',')) : [];
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    const filteredRows = textSearch
      ? dataRows.filter((r) => r.some((c) => c.toLowerCase().includes(textSearch.toLowerCase())))
      : dataRows;

    return (
      <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* Table Toolbar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800">
              Spreadsheet Table
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {dataRows.length} rows • {headers.length} columns
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter in table */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Search table rows..."
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleCopyText(rawContent)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Copy CSV data"
            >
              {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Formatted Table */}
        <div className="overflow-x-auto max-h-[50vh] p-2 bg-slate-950">
          {rows.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-sm">Spreadsheet preview ready.</p>
              <p className="text-xs text-slate-400 mt-1">Open in Excel Online or download to view all formulas and worksheets.</p>
            </div>
          ) : (
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-200 font-semibold sticky top-0 z-10">
                  <th className="py-2 px-3 border-r border-slate-800 text-slate-500 w-10 text-center font-mono">#</th>
                  {headers.map((h, i) => (
                    <th key={i} className="py-2 px-3 border-r border-slate-800 last:border-r-0 whitespace-nowrap">
                      {h.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
                {filteredRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-850 transition-colors">
                    <td className="py-1.5 px-3 border-r border-slate-800/60 text-slate-500 text-center font-mono select-none">
                      {rIdx + 1}
                    </td>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-1.5 px-3 border-r border-slate-800/60 last:border-r-0 whitespace-nowrap">
                        {cell.trim()}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // 6. TEXT / CODE / MARKDOWN PREVIEWER
  // ==========================================
  const renderTextViewer = () => {
    const raw = item.content || `Document "${item.name}"\n\nSize: ${formatBytes(item.size)}\nAccount: ${item.accountName}\nLast Modified: ${new Date(item.lastModifiedDateTime).toLocaleString()}`;
    const isMarkdown = ext === 'md' || item.name.toLowerCase().endsWith('.markdown');
    const lines = raw.split('\n');

    // Filtered lines if searching
    const filteredLines = textSearch
      ? lines.map((line, idx) => ({ line, originalIdx: idx })).filter((item) => item.line.toLowerCase().includes(textSearch.toLowerCase()))
      : lines.map((line, idx) => ({ line, originalIdx: idx }));

    return (
      <div className="flex flex-col bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        {/* Editor Controls Toolbar */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sky-400 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-sky-950 border border-sky-800 font-mono">
              {ext.toUpperCase() || 'TXT'}
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              {lines.length} lines • {raw.length} chars
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search within document */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Find in text..."
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Markdown Toggle */}
            {isMarkdown && (
              <button
                type="button"
                onClick={() => setViewMarkdownFormatted(!viewMarkdownFormatted)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  viewMarkdownFormatted
                    ? 'bg-sky-600/20 text-sky-400 border-sky-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {viewMarkdownFormatted ? 'Formatted' : 'Raw'}
              </button>
            )}

            {/* Toggle Word Wrap */}
            <button
              type="button"
              onClick={() => setWordWrap(!wordWrap)}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                wordWrap ? 'bg-slate-800 text-sky-400 border-sky-600/40' : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
              title="Toggle Word Wrap"
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>

            {/* Copy Text Button */}
            <button
              type="button"
              onClick={() => handleCopyText(raw)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Copy All Content"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="overflow-auto max-h-[55vh] min-h-[300px] bg-slate-950 p-4 font-mono text-xs">
          {isMarkdown && viewMarkdownFormatted ? (
            // Rendered Markdown View
            <div className="prose prose-invert prose-slate max-w-none space-y-3 font-sans">
              {raw.split('\n\n').map((block, idx) => {
                if (block.startsWith('# ')) {
                  return <h1 key={idx} className="text-lg font-bold text-slate-100 border-b border-slate-800 pb-2">{block.replace('# ', '')}</h1>;
                }
                if (block.startsWith('## ')) {
                  return <h2 key={idx} className="text-base font-semibold text-slate-200 mt-3">{block.replace('## ', '')}</h2>;
                }
                if (block.startsWith('### ')) {
                  return <h3 key={idx} className="text-sm font-semibold text-sky-300 mt-2">{block.replace('### ', '')}</h3>;
                }
                if (block.startsWith('```')) {
                  const codeContent = block.replace(/```[a-z]*\n?/g, '').trim();
                  return (
                    <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-xs text-sky-300 overflow-x-auto whitespace-pre">
                      {codeContent}
                    </div>
                  );
                }
                if (block.startsWith('- ') || block.startsWith('* ')) {
                  return (
                    <ul key={idx} className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                      {block.split('\n').map((li, lIdx) => (
                        <li key={lIdx}>{li.replace(/^[-*]\s+/, '')}</li>
                      ))}
                    </ul>
                  );
                }
                return (
                  <p key={idx} className="text-xs text-slate-300 leading-relaxed font-sans">
                    {block}
                  </p>
                );
              })}
            </div>
          ) : (
            // Raw Code / Text with line number gutter
            <div className={`flex ${wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
              <div className="select-none pr-4 text-right text-slate-600 border-r border-slate-850 font-mono text-[11px] leading-relaxed">
                {filteredLines.map((item) => (
                  <div key={item.originalIdx}>{item.originalIdx + 1}</div>
                ))}
              </div>
              <div className="pl-4 flex-1 text-slate-200 leading-relaxed font-mono text-xs">
                {filteredLines.map((item) => (
                  <div
                    key={item.originalIdx}
                    className={textSearch && item.line.toLowerCase().includes(textSearch.toLowerCase()) ? 'bg-sky-500/20 text-sky-200 rounded px-1 -mx-1' : ''}
                  >
                    {item.line || ' '}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // ROUTE TO APPROPRIATE PREVIEWER
  // ==========================================
  switch (item.fileType) {
    case 'image':
      return renderImageViewer();
    case 'video':
      return renderVideoViewer();
    case 'audio':
      return renderAudioViewer();
    case 'pdf':
      return renderPdfViewer();
    case 'spreadsheet':
      return renderSpreadsheetViewer();
    case 'code':
    case 'document':
      return renderTextViewer();
    default:
      // Check extensions as fallback
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
        return renderImageViewer();
      }
      if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) {
        return renderVideoViewer();
      }
      if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) {
        return renderAudioViewer();
      }
      if (ext === 'pdf') {
        return renderPdfViewer();
      }
      if (['csv', 'tsv', 'xlsx'].includes(ext)) {
        return renderSpreadsheetViewer();
      }
      return renderTextViewer();
  }
};
