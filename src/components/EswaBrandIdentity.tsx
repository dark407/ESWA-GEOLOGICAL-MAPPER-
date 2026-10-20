import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export interface EswaTunnelLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'splash';
  variant?: 'emblem' | 'lockup' | 'inline' | 'splash';
  animated?: boolean;
  eagleEntranceAnimation?: boolean;
  showBadge?: boolean;
  className?: string;
}

const SIZE_MAP: Record<NonNullable<EswaTunnelLogoProps['size']>, number> = {
  xs: 42,
  sm: 64,
  md: 110,
  lg: 220,
  xl: 320,
  '2xl': 390,
  splash: 440,
};

let sharedAudioCtx: AudioContext | null = null;

/**
 * Synthesizes a unique, warm ambient startup chord inspired by the classic Windows welcome sound.
 * Uses Web Audio API with layered warm pads (Dmaj9 voicing) + crystalline bell harmonics at eagle lock-in.
 */
export function playEswaWelcomeChime(forceRestart = false): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    const ctx = sharedAudioCtx;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
      if (!forceRestart && ctx.state === 'suspended') {
        return false;
      }
    }

    const now = ctx.currentTime + 0.03;

    // Master dynamics & output gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, now);
    masterGain.gain.linearRampToValueAtTime(0.28, now + 0.22);
    masterGain.gain.exponentialRampToValueAtTime(0.22, now + 1.65);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.05);

    // Subtle stereo delay for lush Windows-startup ambient space
    const delayNode = ctx.createDelay(1.0);
    delayNode.delayTime.setValueAtTime(0.19, now);
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.setValueAtTime(0.26, now);
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(2200, now);

    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    masterGain.connect(ctx.destination);
    masterGain.connect(delayNode);
    delayNode.connect(ctx.destination);

    // Layer 1: Warm Swoop-In Ambient Pad (0.0s -> 3.0s) — Dmaj9 (D3, A3, E4, F#4, A4)
    const padFreqs = [146.83, 220.0, 329.63, 369.99, 440.0];
    padFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const voiceGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = idx < 2 ? 'sine' : 'triangle';
      osc2.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.996, now);
      osc.frequency.exponentialRampToValueAtTime(freq, now + 0.45);
      osc2.frequency.setValueAtTime(freq * 1.003, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(520 + idx * 180, now);
      filter.frequency.exponentialRampToValueAtTime(2400, now + 1.25);
      filter.frequency.exponentialRampToValueAtTime(900, now + 2.95);

      const startOffset = idx * 0.055;
      const amp = idx === 0 ? 0.24 : 0.15 / Math.sqrt(idx + 1);
      voiceGain.gain.setValueAtTime(0.0001, now + startOffset);
      voiceGain.gain.linearRampToValueAtTime(amp, now + startOffset + 0.35);
      voiceGain.gain.exponentialRampToValueAtTime(amp * 0.72, now + 1.65);
      voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(voiceGain);
      voiceGain.connect(masterGain);

      osc.start(now + startOffset);
      osc2.start(now + startOffset);
      osc.stop(now + 3.05);
      osc2.stop(now + 3.05);
    });

    // Layer 2: Crystalline Eagle Lock-In Bell Harmonic Chord at t = 1.15s (F#4, A4, C#5, E5, A5)
    const chimeTime = now + 1.15;
    const bellFreqs = [369.99, 440.0, 554.37, 659.25, 880.0];
    bellFreqs.forEach((freq, idx) => {
      const bellOsc = ctx.createOscillator();
      const harmonicOsc = ctx.createOscillator();
      const bellGain = ctx.createGain();

      bellOsc.type = 'sine';
      harmonicOsc.type = 'triangle';
      bellOsc.frequency.setValueAtTime(freq, chimeTime + idx * 0.045);
      harmonicOsc.frequency.setValueAtTime(freq * 2, chimeTime + idx * 0.045);

      const noteStart = chimeTime + idx * 0.045;
      const peak = 0.14 / (1 + idx * 0.22);
      bellGain.gain.setValueAtTime(0.0001, noteStart);
      bellGain.gain.linearRampToValueAtTime(peak, noteStart + 0.025);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 1.8);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.22, noteStart);

      bellOsc.connect(bellGain);
      harmonicOsc.connect(overtoneGain);
      overtoneGain.connect(bellGain);
      bellGain.connect(masterGain);

      bellOsc.start(noteStart);
      harmonicOsc.start(noteStart);
      bellOsc.stop(noteStart + 1.85);
      harmonicOsc.stop(noteStart + 1.85);
    });

    return ctx.state === 'running';
  } catch {
    return false;
  }
}

/**
 * Official Transparent-Cutout ESWA TUNNEL GEOLOGICAL MAPPER Logo
 * Recreates the exact official logo (no box or circular border):
 * 1. Twin-peak dark topographic contour mountain triangle at top
 * 2. Topographic contour white/ice-blue eagle head with geological compass eye (animates from left)
 * 3. 'ESWA' wordmark where 'E' is a horseshoe tunnel portal arch containing rock hammer, hand lens, drill core & mineral sample,
 *    'S' contains a folded ochre rock stratum band, and 'W'/'A' feature sky-blue to slate-teal fractured rock texture
 * 4. 'TUNNEL GEOLOGICAL MAPPER' subtitle underneath
 */
export const EswaTunnelLogo: React.FC<EswaTunnelLogoProps> = ({
  size = 'md',
  variant = 'emblem',
  animated = false,
  eagleEntranceAnimation = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const widthPx = SIZE_MAP[size];
  const heightPx = Math.round(widthPx * (580 / 820));

  const emblemNode = (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${
        eagleEntranceAnimation ? 'eswa-logo-pop-out' : ''
      } ${className}`}
      style={{ width: widthPx, height: heightPx }}
    >
      <svg
        viewBox="0 0 820 580"
        width={widthPx}
        height={heightPx}
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
        className="eswa-logo-svg overflow-visible w-full h-full drop-shadow-[0_8px_18px_rgba(0,0,0,0.22)]"
        aria-label="ESWA Tunnel Geological Mapper Official Logo"
      >
        <defs>
          {/* Small Crisp White Outline Around Entire Cutout Logo for High Clarity on Bright Orange Background */}
          <filter id="eswaCrispWhiteOutline" x="-14%" y="-14%" width="128%" height="128%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="4.2" result="dilated" />
            <feFlood floodColor="#FFFFFF" floodOpacity="1" result="whiteFill" />
            <feComposite in="whiteFill" in2="dilated" operator="in" result="whiteOutline" />
            <feDropShadow
              dx="0"
              dy="3"
              stdDeviation="4"
              floodColor="#000000"
              floodOpacity="0.2"
              result="shadow"
            />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="whiteOutline" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Mountain Peak Dark Topographic Gradient */}
          <linearGradient id="eswaMtnPeakGrad" x1="25%" y1="0%" x2="75%" y2="100%">
            <stop offset="0%" stopColor="#4B5563" />
            <stop offset="38%" stopColor="#1F2937" />
            <stop offset="78%" stopColor="#090D14" />
            <stop offset="100%" stopColor="#030508" />
          </linearGradient>

          {/* Clip Path for Twin-Peak Mountain Triangle */}
          <clipPath id="eswaMtnPeakClip">
            <polygon points="222,332 346,118 368,144 452,22 686,332" />
          </clipPath>

          {/* Eagle Head Ice-White to Sky-Blue Gradient */}
          <linearGradient id="eswaEagleHeadGrad" x1="15%" y1="10%" x2="92%" y2="85%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="48%" stopColor="#E0F2FE" />
            <stop offset="78%" stopColor="#BAE6FD" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>

          {/* Clip Path for Eagle Head & Hooked Beak */}
          <clipPath id="eswaEagleHeadClip">
            <path d="M 272 268 C 318 228, 378 190, 444 186 C 476 184, 502 194, 514 208 C 546 210, 578 224, 590 250 C 598 268, 594 292, 578 308 C 574 292, 562 280, 544 278 C 516 276, 488 292, 464 316 C 452 328, 444 342, 440 354 L 382 354 C 368 310, 326 276, 272 268 Z" />
          </clipPath>

          {/* Horseshoe Tunnel Arch 'E' Inner Rock Wall Gradient */}
          <linearGradient id="eswaTunnelArchWallGrad" x1="0%" y1="95%" x2="90%" y2="10%">
            <stop offset="0%" stopColor="#9A7B4F" />
            <stop offset="35%" stopColor="#856A47" />
            <stop offset="68%" stopColor="#5B6B73" />
            <stop offset="100%" stopColor="#3B4D59" />
          </linearGradient>

          {/* Horseshoe Tunnel Arch 'E' Outer Concrete/Rock Rim Gradient */}
          <linearGradient id="eswaTunnelRimGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748B" />
            <stop offset="45%" stopColor="#94A3B8" />
            <stop offset="75%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          {/* 'S', 'W', 'A' Sky-Blue to Deep Slate-Teal Rock Gradient */}
          <linearGradient id="eswaLettersBlueRockGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#29A3DC" />
            <stop offset="35%" stopColor="#2B8CBE" />
            <stop offset="72%" stopColor="#3B6275" />
            <stop offset="100%" stopColor="#2A404D" />
          </linearGradient>

          {/* Folded Sedimentary Rock Band Gradient inside 'S' */}
          <linearGradient id="eswaSFoldBandGrad" x1="0%" y1="20%" x2="100%" y2="80%">
            <stop offset="0%" stopColor="#D4A359" />
            <stop offset="50%" stopColor="#A4753B" />
            <stop offset="100%" stopColor="#7C5329" />
          </linearGradient>

          {/* Clip Path for Letter 'S' */}
          <clipPath id="eswaLetterSClip">
            <path d="M 432 384 C 414 366, 386 358, 358 360 C 318 362, 294 384, 294 412 C 294 442, 322 454, 360 466 C 388 474, 398 482, 396 494 C 394 506, 376 512, 354 510 C 332 508, 314 498, 298 486 L 280 518 C 302 534, 330 542, 360 542 C 406 542, 438 520, 438 486 C 438 454, 412 438, 370 426 C 344 418, 334 412, 336 400 C 338 390, 352 384, 372 386 C 390 388, 406 396, 418 406 Z" />
          </clipPath>

          {/* Clip Path for Letters 'W' and 'A' */}
          <clipPath id="eswaLettersWAClip">
            <path d="M 426 364 L 466 364 L 490 472 L 520 364 L 554 364 L 584 472 L 608 364 L 648 364 L 604 538 L 566 538 L 537 432 L 508 538 L 470 538 Z M 686 364 L 730 364 L 792 538 L 748 538 L 736 502 L 678 502 L 666 538 L 624 538 Z M 707 412 L 688 470 L 726 470 Z" />
          </clipPath>
        </defs>

        <g filter="url(#eswaCrispWhiteOutline)">
        {/* ==================== 1. TWIN-PEAK TOPOGRAPHIC MOUNTAIN TRIANGLE ==================== */}
        <g>
          {/* Small Crisp White Outer Outline on Mountain Triangle */}
          <polygon
            points="222,332 346,118 368,144 452,22 686,332"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="19"
            strokeLinejoin="round"
          />

          {/* Mountain Base Fill & Topographic Contours */}
          <g clipPath="url(#eswaMtnPeakClip)">
            <polygon
              points="222,332 346,118 368,144 452,22 686,332"
              fill="url(#eswaMtnPeakGrad)"
            />
            {/* Topographic Elevation Contour Lines Inside Mountain Peak */}
            <g fill="none" stroke="#64748B" strokeWidth="1.5" opacity="0.58">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((idx) => {
                const yOff = idx * 22;
                return (
                  <path
                    key={`mtn-topo-${idx}`}
                    d={`M ${250 - idx * 4} ${290 - idx * 12} C ${330 + idx * 5} ${
                      210 - idx * 8
                    }, ${395 - idx * 4} ${145 + yOff * 0.4}, ${448 + idx * 3} ${
                      52 + yOff * 0.85
                    } C ${495 + idx * 6} ${135 + yOff * 0.5}, ${545 - idx * 3} ${
                      205 + yOff * 0.3
                    }, ${655 + idx * 4} ${315 - idx * 6}`}
                  />
                );
              })}
              {/* Nested Ridges & Peak Contours */}
              <ellipse
                cx="452"
                cy="96"
                rx="28"
                ry="42"
                transform="rotate(-14 452 96)"
                stroke="#94A3B8"
                strokeWidth="1.4"
              />
              <ellipse
                cx="454"
                cy="98"
                rx="16"
                ry="26"
                transform="rotate(-14 454 98)"
                stroke="#CBD5E1"
                strokeWidth="1.2"
              />
              <ellipse
                cx="352"
                cy="176"
                rx="26"
                ry="34"
                transform="rotate(18 352 176)"
                stroke="#94A3B8"
                strokeWidth="1.3"
              />
            </g>
          </g>

          {/* Bold Black Mountain Triangle Outer Frame */}
          <polygon
            points="222,332 346,118 368,144 452,22 686,332"
            fill="none"
            stroke="#05070A"
            strokeWidth="11"
            strokeLinejoin="miter"
          />
        </g>

        {/* ==================== 2. TOPOGRAPHIC EAGLE HEAD WITH GEOLOGICAL COMPASS EYE (ANIMATES FROM LEFT) ==================== */}
        <g
          className={
            eagleEntranceAnimation
              ? 'eswa-eagle-swoop-in'
              : animated
              ? 'eswa-eagle-subtle-breathe'
              : ''
          }
        >
          {/* Small Crisp White Outer Outline on Eagle Head */}
          <path
            d="M 272 268 C 318 228, 378 190, 444 186 C 476 184, 502 194, 514 208 C 546 210, 578 224, 590 250 C 598 268, 594 292, 578 308 C 574 292, 562 280, 544 278 C 516 276, 488 292, 464 316 C 452 328, 444 342, 440 354"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="9.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Eagle Head Base & Flowing Topographic Contour Curves */}
          <g clipPath="url(#eswaEagleHeadClip)">
            <path
              d="M 272 268 C 318 228, 378 190, 444 186 C 476 184, 502 194, 514 208 C 546 210, 578 224, 590 250 C 598 268, 594 292, 578 308 C 574 292, 562 280, 544 278 C 516 276, 488 292, 464 316 C 452 328, 444 342, 440 354 L 382 354 C 368 310, 326 276, 272 268 Z"
              fill="url(#eswaEagleHeadGrad)"
            />

            {/* Concentric Topographic Lines Wrapping Eagle Head & Beak */}
            <g fill="none" stroke="#1E293B" strokeWidth="1.45" strokeOpacity="0.72">
              {Array.from({ length: 18 }, (_, i) => {
                const shift = i * 9.5;
                return (
                  <path
                    key={`eagle-contour-${i}`}
                    d={`M ${268 + shift * 0.7} ${348 - shift * 0.3} C ${
                      338 + shift * 0.65
                    } ${265 - shift * 0.45}, ${425 + shift * 0.45} ${
                      192 + shift * 0.38
                    }, ${512 + shift * 0.28} ${214 + shift * 0.35} C ${
                      556 + shift * 0.15
                    } ${228 + shift * 0.25}, ${584 - shift * 0.18} ${
                      262 + shift * 0.2
                    }, ${572 - shift * 0.35} ${312 - shift * 0.1}`}
                  />
                );
              })}
            </g>

            {/* Beak Separation Contour Line */}
            <path
              d="M 514 208 C 498 236, 496 268, 516 286"
              fill="none"
              stroke="#0F172A"
              strokeWidth="2.2"
              strokeOpacity="0.85"
            />
          </g>

          {/* Eagle Head Crisp Outer Stroke */}
          <path
            d="M 272 268 C 318 228, 378 190, 444 186 C 476 184, 502 194, 514 208 C 546 210, 578 224, 590 250 C 598 268, 594 292, 578 308 C 574 292, 562 280, 544 278 C 516 276, 488 292, 464 316 C 452 328, 444 342, 440 354"
            fill="none"
            stroke="#090D14"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Eagle Eye: Tilted Geological Compass Needle & North Indicator */}
          <g transform="translate(476, 236)">
            {/* Small North 'N' Pointer Upper-Left of Compass Eye */}
            <g transform="translate(-16, -15) rotate(-38)">
              <polygon points="0,-7 -4,3 0,1 4,3" fill="#475569" />
              <text
                x="0"
                y="-8"
                textAnchor="middle"
                fill="#334155"
                fontSize="7"
                fontWeight="900"
                fontFamily="sans-serif"
              >
                N
              </text>
            </g>
            {/* Tilted Black Diamond Compass Needle Eye */}
            <g transform="rotate(-36)">
              <polygon points="-28,0 0,-8 28,0 0,8" fill="#05070A" />
              <circle cx="0" cy="0" r="7.5" fill="#05070A" />
              <circle cx="0" cy="0" r="5.2" fill="#BAE6FD" />
              <circle cx="0" cy="0" r="2.3" fill="#0F172A" />
              <circle cx="-1.5" cy="-1.5" r="1.1" fill="#FFFFFF" />
            </g>
          </g>
        </g>

        {/* ==================== 3. 'ESWA' GEOLOGICAL & TUNNEL PORTAL WORDMARK ==================== */}
        <g>
          {/* ---------- LETTER 'E' AS HORSESHOE TUNNEL PORTAL ARCH ---------- */}
          <g>
            {/* Small White Outline Under-Stroke for Tunnel Arch 'E' */}
            <path
              d="M 152 538 L 152 388 A 128 128 0 0 1 404 352 L 382 362 L 330 388 A 52 52 0 0 0 242 414 L 242 428 L 284 428 L 284 468 L 242 468 L 242 496 L 296 496 L 296 538 Z"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="11"
              strokeLinejoin="round"
            />
            {/* Outer Segmented Concrete/Rock Tunnel Arch Rim */}
            <path
              d="M 152 538 L 152 388 A 128 128 0 0 1 404 352 L 382 362 A 104 104 0 0 0 174 388 L 174 538 Z"
              fill="url(#eswaTunnelRimGrad)"
              stroke="#090D14"
              strokeWidth="4.5"
              strokeLinejoin="round"
            />
            {/* Arch Segment Joint Ticks on Outer Rim */}
            <g stroke="#090D14" strokeWidth="2.5">
              <line x1="152" y1="452" x2="174" y2="452" />
              <line x1="162" y1="346" x2="182" y2="356" />
              <line x1="216" y1="278" x2="230" y2="296" />
              <line x1="306" y1="262" x2="302" y2="284" />
              <line x1="376" y1="302" x2="358" y2="316" />
            </g>

            {/* Inner Horseshoe Tunnel Rock Wall Forming 'E' */}
            <path
              d="M 174 538 L 174 388 A 104 104 0 0 1 382 362 L 330 388 A 52 52 0 0 0 242 414 L 242 428 L 284 428 L 284 468 L 242 468 L 242 496 L 296 496 L 296 538 Z"
              fill="url(#eswaTunnelArchWallGrad)"
              stroke="#090D14"
              strokeWidth="4"
              strokeLinejoin="round"
            />

            {/* Flat Tunnel Invert Floor (Bottom Bar of E) */}
            <polygon
              points="174,538 222,504 296,504 296,538"
              fill="#64748B"
              stroke="#090D14"
              strokeWidth="3"
              strokeLinejoin="round"
            />

            {/* Internal Tunnel Bedding & Arch Contour Lines */}
            <path
              d="M 192 518 L 192 392 A 86 86 0 0 1 356 364"
              fill="none"
              stroke="#27272A"
              strokeWidth="1.5"
              strokeOpacity="0.65"
            />
            <path
              d="M 212 502 L 212 396 A 68 68 0 0 1 334 374"
              fill="none"
              stroke="#27272A"
              strokeWidth="1.3"
              strokeOpacity="0.55"
            />

            {/* Embedded Geologist's Rock Hammer (Lower-Left of E Arch) */}
            <g transform="translate(192, 456) rotate(-14)">
              {/* Hammer Handle */}
              <rect
                x="-3.5"
                y="0"
                width="7"
                height="48"
                rx="2.5"
                fill="#A16207"
                stroke="#090D14"
                strokeWidth="2.2"
              />
              {/* Steel Hammer Head & Pick Point */}
              <path
                d="M -16 -6 L 22 -6 L 14 4 L -16 2 Z"
                fill="#94A3B8"
                stroke="#090D14"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
            </g>

            {/* Embedded Hand Lens / Magnifying Loupe (Middle-Left of E Arch) */}
            <g transform="translate(224, 424) rotate(12)">
              <circle
                cx="0"
                cy="0"
                r="10"
                fill="#93C5FD"
                fillOpacity="0.55"
                stroke="#090D14"
                strokeWidth="2.6"
              />
              <circle cx="0" cy="0" r="6.5" fill="none" stroke="#E2E8F0" strokeWidth="1.5" />
              <rect
                x="-2.5"
                y="10"
                width="5"
                height="16"
                rx="2"
                fill="#CBD5E1"
                stroke="#090D14"
                strokeWidth="2"
              />
            </g>

            {/* Embedded Drill Core Cylinder (Upper-Left of E Arch) */}
            <g transform="translate(244, 336) rotate(32)">
              <rect
                x="-14"
                y="-6"
                width="28"
                height="12"
                rx="4"
                fill="#CBD5E1"
                stroke="#090D14"
                strokeWidth="2.2"
              />
              <line x1="-5" y1="-6" x2="-2" y2="6" stroke="#475569" strokeWidth="1.8" />
              <line x1="5" y1="-6" x2="8" y2="6" stroke="#475569" strokeWidth="1.8" />
            </g>

            {/* Embedded Angular Rock / Mineral Sample (Upper-Right of E Arch) */}
            <polygon
              points="344,328 356,320 364,332 354,342 342,338"
              fill="#D97706"
              stroke="#090D14"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>

          {/* ---------- LETTER 'S' WITH FOLDED SEDIMENTARY ROCK STRATUM ---------- */}
          <g>
            <g clipPath="url(#eswaLetterSClip)">
              {/* Base Slate-Blue Rock Fill */}
              <rect
                x="275"
                y="355"
                width="175"
                height="195"
                fill="url(#eswaLettersBlueRockGrad)"
              />

              {/* Folded Brown-Ochre Sedimentary Stratum Band Curving Through 'S' */}
              <path
                d="M 275 392 C 325 408, 355 432, 445 478 L 445 516 C 355 468, 320 442, 275 426 Z"
                fill="url(#eswaSFoldBandGrad)"
                stroke="#090D14"
                strokeWidth="3"
              />
              {/* Internal Bedding Lines Inside the Folded Stratum */}
              <path
                d="M 275 404 C 325 420, 355 444, 445 490"
                fill="none"
                stroke="#451A03"
                strokeWidth="1.8"
                strokeOpacity="0.75"
              />
              <path
                d="M 275 415 C 325 431, 355 455, 445 501"
                fill="none"
                stroke="#FEF3C7"
                strokeWidth="1.3"
                strokeOpacity="0.55"
              />

              {/* Rock Joint / Fracture Lines on 'S' */}
              <path
                d="M 345 362 L 362 392 L 388 386 M 312 496 L 348 518 L 378 508"
                fill="none"
                stroke="#0F172A"
                strokeWidth="2"
                strokeOpacity="0.65"
              />
            </g>

            {/* Small White Outline Under-Stroke of 'S' */}
            <path
              d="M 432 384 C 414 366, 386 358, 358 360 C 318 362, 294 384, 294 412 C 294 442, 322 454, 360 466 C 388 474, 398 482, 396 494 C 394 506, 376 512, 354 510 C 332 508, 314 498, 298 486 L 280 518 C 302 534, 330 542, 360 542 C 406 542, 438 520, 438 486 C 438 454, 412 438, 370 426 C 344 418, 334 412, 336 400 C 338 390, 352 384, 372 386 C 390 388, 406 396, 418 406 Z"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            {/* Crisp Outer Outline of 'S' */}
            <path
              d="M 432 384 C 414 366, 386 358, 358 360 C 318 362, 294 384, 294 412 C 294 442, 322 454, 360 466 C 388 474, 398 482, 396 494 C 394 506, 376 512, 354 510 C 332 508, 314 498, 298 486 L 280 518 C 302 534, 330 542, 360 542 C 406 542, 438 520, 438 486 C 438 454, 412 438, 370 426 C 344 418, 334 412, 336 400 C 338 390, 352 384, 372 386 C 390 388, 406 396, 418 406 Z"
              fill="none"
              stroke="#090D14"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
          </g>

          {/* ---------- LETTERS 'W' AND 'A' WITH FRACTURED ROCK TEXTURE ---------- */}
          <g>
            {/* Small White Outline Under-Stroke of 'W' and 'A' */}
            <path
              d="M 426 364 L 466 364 L 490 472 L 520 364 L 554 364 L 584 472 L 608 364 L 648 364 L 604 538 L 566 538 L 537 432 L 508 538 L 470 538 Z M 686 364 L 730 364 L 792 538 L 748 538 L 736 502 L 678 502 L 666 538 L 624 538 Z M 707 412 L 688 470 L 726 470 Z"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="10"
              strokeLinejoin="round"
            />
            <g clipPath="url(#eswaLettersWAClip)">
              <rect
                x="420"
                y="360"
                width="380"
                height="185"
                fill="url(#eswaLettersBlueRockGrad)"
              />

              {/* Realistic Geological Rock Fractures & Joint Networks Across 'W' and 'A' */}
              <g fill="none" stroke="#0F172A" strokeWidth="2.2" strokeOpacity="0.62">
                <path d="M 442 430 L 478 452 L 502 438 L 526 468" />
                <path d="M 468 488 L 498 474 L 516 508" />
                <path d="M 556 418 L 588 446 L 618 432" />
                <path d="M 564 492 L 594 476 L 612 512" />
                <path d="M 658 468 L 692 448 L 722 462 L 758 442" />
                <path d="M 642 514 L 674 496 L 696 518" />
                <path d="M 728 486 L 756 504 L 778 492" />
              </g>
              {/* Subtle Fine Quartz/Highlight Hairline Cracks */}
              <g fill="none" stroke="#BAE6FD" strokeWidth="1" strokeOpacity="0.38">
                <path d="M 444 428 L 480 450 M 558 416 L 590 444 M 660 466 L 694 446" />
              </g>
            </g>

            {/* Crisp Outer Stroke of 'W' and 'A' */}
            <path
              d="M 426 364 L 466 364 L 490 472 L 520 364 L 554 364 L 584 472 L 608 364 L 648 364 L 604 538 L 566 538 L 537 432 L 508 538 L 470 538 Z M 686 364 L 730 364 L 792 538 L 748 538 L 736 502 L 678 502 L 666 538 L 624 538 Z M 707 412 L 688 470 L 726 470 Z"
              fill="none"
              stroke="#090D14"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
          </g>
        </g>

        {/* ==================== 4. 'TUNNEL GEOLOGICAL MAPPER' OFFICIAL SUBTITLE ==================== */}
        <g className={eagleEntranceAnimation ? 'eswa-wordmark-reveal' : ''}>
          <text
            x="472"
            y="574"
            textAnchor="middle"
            fill={isLight ? '#090D14' : '#090D14'}
            stroke="#FFFFFF"
            strokeWidth="7"
            strokeLinejoin="round"
            paintOrder="stroke"
            fontSize="33"
            fontWeight="800"
            fontFamily="'Chakra Petch', 'Plus Jakarta Sans', sans-serif"
            letterSpacing="3.2"
          >
            GEOLOGICAL MAPPER
          </text>
        </g>
        </g>
      </svg>
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-2 select-none">
        {emblemNode}
      </div>
    );
  }

  return emblemNode;
};

/**
 * Exact Amber-Orange Geological Topographic Contour, Folded Rock Strata & Cross-Hatched Fault Corridor Map Backdrop
 * Recreates the uploaded official ESWA amber-orange geological background for the Welcome Window and Main App Workspace.
 */
export const EswaGeologicalOrangeMapBackdrop: React.FC<{
  className?: string;
  opacity?: number;
}> = ({ className = '', opacity = 1 }) => {
  const { palette } = useTheme();
  const stops = palette.baseGradientStops;
  const glow = palette.glowStops;
  const strata = palette.strataColors;
  const primary = palette.primaryHex;

  return (
    <div
      className={`fixed inset-0 pointer-events-none select-none z-0 overflow-hidden no-print eswa-bg-watermark ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <defs>
          {/* Dynamic Theme Color Geological Map Base Gradient */}
          <linearGradient id="eswaGeoOrangeBase" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stops[0]} />
            <stop offset="35%" stopColor={stops[1]} />
            <stop offset="68%" stopColor={stops[2]} />
            <stop offset="100%" stopColor={stops[3]} />
          </linearGradient>

          {/* Warm Radial Highlight for Topographic Highs */}
          <radialGradient id="eswaGeoWarmGlow" cx="62%" cy="28%" r="55%">
            <stop offset="0%" stopColor={glow[0]} stopOpacity="0.65" />
            <stop offset="55%" stopColor={glow[1]} stopOpacity="0.25" />
            <stop offset="100%" stopColor={glow[2]} stopOpacity="0" />
          </radialGradient>

          {/* Rotated Cross-Hatch Mesh Pattern for Fault / Shear Corridors & Tunnel Portals */}
          <pattern
            id="eswaFaultCrossHatch"
            width="18"
            height="18"
            patternTransform="rotate(-38)"
            patternUnits="userSpaceOnUse"
          >
            <rect width="18" height="18" fill="rgba(168, 42, 8, 0.12)" />
            <path
              d="M 0 0 L 0 18 M 0 0 L 18 0 M 9 0 L 9 18 M 0 9 L 18 9"
              stroke={strata[0]}
              strokeWidth="1.25"
              strokeOpacity="0.78"
            />
          </pattern>

          {/* Engineering Survey Coordinate Grid Pattern */}
          <pattern
            id="eswaGeoSurveyGrid"
            width="240"
            height="240"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 240 0 L 0 0 0 240"
              fill="none"
              stroke={strata[0]}
              strokeWidth="1"
              strokeOpacity="0.28"
            />
          </pattern>

          {/* Clip Path for Central-Left Diagonal Folded Rock Strata Outcrop Swath */}
          <clipPath id="eswaFoldedStrataSwathClip">
            <path d="M 840 -40 L 1120 -40 C 1060 220, 1010 430, 960 610 C 900 810, 790 960, 690 1120 L 240 1120 C 330 890, 420 680, 520 470 C 630 250, 740 80, 840 -40 Z" />
          </clipPath>

          {/* Clip Path for Top-Left Corner Banded Rock Wedge */}
          <clipPath id="eswaTopLeftStrataClip">
            <path d="M -40 -40 L 380 -40 C 270 110, 140 260, -40 420 Z" />
          </clipPath>

          {/* Clip Path for Bottom-Left & Bottom-Right Banded Strata Wedges */}
          <clipPath id="eswaBottomLeftStrataClip">
            <path d="M -40 730 L 390 1120 L -40 1120 Z" />
          </clipPath>
          <clipPath id="eswaBottomRightStrataClip">
            <path d="M 1520 1120 C 1630 960, 1770 860, 1960 810 L 1960 1120 Z" />
          </clipPath>
        </defs>

        {/* 1. Base Vibrant Themed Sheet */}
        <rect width="1920" height="1080" fill="url(#eswaGeoOrangeBase)" />
        <rect width="1920" height="1080" fill="url(#eswaGeoWarmGlow)" />

        {/* 2. Top-Left Banded Rock Strata Wedge */}
        <g clipPath="url(#eswaTopLeftStrataClip)">
          <rect x="-50" y="-50" width="460" height="500" fill={strata[2] || primary} />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <path
              key={`tl-${i}`}
              d={`M -60 ${360 - i * 38} C 80 ${260 - i * 36}, 210 ${120 - i * 34}, 370 ${-40 - i * 30}`}
              fill="none"
              stroke={strata[i % strata.length]}
              strokeWidth={i % 2 === 0 ? 18 : 12}
              strokeOpacity="0.88"
            />
          ))}
        </g>

        {/* 3. Central-Left Diagonal Folded Sedimentary / Metamorphic Rock Strata Outcrop */}
        <g clipPath="url(#eswaFoldedStrataSwathClip)">
          <rect x="200" y="-40" width="960" height="1200" fill={strata[6] || primary} />
          {Array.from({ length: 28 }, (_, i) => {
            const yBase = -120 + i * 46;
            const colors = strata;
            const widths = [24, 15, 20, 18, 14, 16, 22, 16];
            return (
              <path
                key={`strata-${i}`}
                d={`M 220 ${yBase + 140} C 430 ${yBase + 210}, 590 ${yBase + 275}, 760 ${
                  yBase + 380
                } C 880 ${yBase + 455}, 980 ${yBase + 490}, 1140 ${yBase + 520}`}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth={widths[i % widths.length]}
                strokeOpacity="0.9"
              />
            );
          })}
          {/* Quartz / Calcite Vein Fracture Along Left Margin of Outcrop */}
          <path
            d="M 835 -20 C 755 140, 650 310, 540 500 C 445 665, 360 850, 275 1090"
            fill="none"
            stroke="#FEF3C7"
            strokeWidth="12"
            strokeOpacity="0.75"
            strokeDasharray="28 10 14 8"
          />
          <path
            d="M 960 470 C 930 570, 895 660, 855 770"
            fill="none"
            stroke="#FFFBEB"
            strokeWidth="18"
            strokeOpacity="0.8"
          />
        </g>

        {/* 4. Bottom-Left & Bottom-Right Banded Strata Wedges */}
        <g clipPath="url(#eswaBottomLeftStrataClip)">
          <rect x="-40" y="720" width="450" height="420" fill="#B45309" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <path
              key={`bl-${i}`}
              d={`M -40 ${760 + i * 48} L 410 ${1140 + i * 32}`}
              fill="none"
              stroke={i % 3 === 0 ? '#3B1403' : i % 3 === 1 ? '#FDE68A' : '#78350F'}
              strokeWidth="22"
              strokeOpacity="0.85"
            />
          ))}
        </g>

        <g clipPath="url(#eswaBottomRightStrataClip)">
          <rect x="1500" y="800" width="460" height="340" fill="#A34407" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <path
              key={`br-${i}`}
              d={`M 1510 ${1130 - i * 36} C 1660 ${990 - i * 36}, 1790 ${900 - i * 34}, 1970 ${
                840 - i * 32
              }`}
              fill="none"
              stroke={i % 3 === 0 ? '#2D1003' : i % 3 === 1 ? '#FCD34D' : '#78350F'}
              strokeWidth="20"
              strokeOpacity="0.88"
            />
          ))}
        </g>

        {/* 5. Concentric Topographic Elevation Contours (Upper-Center-Right Bullseye & Regional Flow) */}
        <g fill="none" stroke="#8C1D05" strokeLinecap="round" strokeLinejoin="round">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((ring) => {
            const rx = ring * 34;
            const ry = ring * 22;
            return (
              <ellipse
                key={`topo-top-${ring}`}
                cx={1210 + ring * 4}
                cy={155 + ring * 3}
                rx={rx}
                ry={ry}
                transform={`rotate(-32 ${1210 + ring * 4} ${155 + ring * 3})`}
                strokeWidth={ring % 4 === 0 ? '2.1' : '1.25'}
                strokeOpacity={0.78 - ring * 0.03}
              />
            );
          })}

          {/* Lower-Left Topographic Contour Loops */}
          {[1, 2, 3, 4, 5, 6, 7].map((ring) => (
            <ellipse
              key={`topo-bl-${ring}`}
              cx={185}
              cy={795}
              rx={ring * 24}
              ry={ring * 18}
              transform="rotate(-25 185 795)"
              strokeWidth={ring % 3 === 0 ? '1.9' : '1.2'}
              strokeOpacity="0.72"
            />
          ))}

          {/* Sweeping Regional Geological Contour Curves Across the Sheet */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((idx) => {
            const offset = idx * 68;
            return (
              <path
                key={`reg-contour-${idx}`}
                d={`M ${650 + offset * 0.4} -20 C ${760 + offset * 0.5} 260, ${
                  980 + offset * 0.65
                } 480, ${860 + offset * 0.55} 780 C ${780 + offset * 0.45} 940, ${
                  910 + offset * 0.5
                } 1020, ${980 + offset * 0.55} 1100`}
                strokeWidth={idx % 4 === 0 ? '2.0' : '1.15'}
                strokeOpacity="0.62"
              />
            );
          })}
        </g>

        {/* 6. Diagonal Cross-Hatched Structural Fault / Shear Corridors */}
        <path
          d="M 465 -30 L 645 -30 C 525 155, 370 335, 225 505 C 120 625, 35 715, -30 790 L -30 615 C 65 510, 175 385, 290 235 C 365 135, 420 50, 465 -30 Z"
          fill="url(#eswaFaultCrossHatch)"
          stroke="#8B1E04"
          strokeWidth="2.4"
        />

        <path
          d="M 1085 1100 C 1245 905, 1435 705, 1625 505 C 1745 380, 1850 265, 1950 165 L 1950 325 C 1835 445, 1710 580, 1575 725 C 1435 875, 1315 995, 1225 1100 Z"
          fill="url(#eswaFaultCrossHatch)"
          stroke="#8B1E04"
          strokeWidth="2.4"
        />

        {/* 7. Cross-Hatched Horseshoe Tunnel Portal Outlines & Structural Labels */}
        <g
          transform="translate(425, 765) rotate(-36)"
          fill="url(#eswaFaultCrossHatch)"
          stroke="#7F1D04"
          strokeWidth="2.2"
        >
          <path d="M -42 90 L -42 0 A 42 48 0 0 1 42 0 L 42 90 Z" />
          <line x1="-55" y1="90" x2="55" y2="90" strokeWidth="1.8" />
        </g>

        <g
          transform="translate(995, 955) rotate(-36)"
          fill="url(#eswaFaultCrossHatch)"
          stroke="#7F1D04"
          strokeWidth="2.2"
        >
          <path d="M -44 65 L -44 0 A 44 48 0 0 1 44 0 L 44 65 A 44 35 0 0 1 -44 65 Z" />
        </g>

        {/* Subtle Geological Map Annotations ('Fold Axis') */}
        <g
          fill="#6E1803"
          fontFamily="'IBM Plex Mono', monospace"
          fontSize="13"
          fontWeight="600"
          opacity="0.78"
        >
          <text x="1050" y="892">
            Fold Axis
          </text>
          <path
            d="M 1118 888 L 1168 892 L 1216 930"
            fill="none"
            stroke="#6E1803"
            strokeWidth="1.3"
          />
          <circle cx="1216" cy="930" r="3" fill="#6E1803" />
        </g>

        {/* 8. Subtle Survey Coordinate Grid & Diamond Markers */}
        <rect width="1920" height="1080" fill="url(#eswaGeoSurveyGrid)" />

        {/* Subtle 4-Point Survey Star Markers (Lower Right) */}
        <g fill="#FDE68A" opacity="0.65">
          <path d="M 1645 692 Q 1645 715 1668 715 Q 1645 715 1645 738 Q 1645 715 1622 715 Q 1645 715 1645 692 Z" />
          <path d="M 1752 878 Q 1752 910 1784 910 Q 1752 910 1752 942 Q 1752 910 1720 910 Q 1752 910 1752 878 Z" />
        </g>
      </svg>
    </div>
  );
};

/**
 * Official Amber-Orange Geological Background + Center-Blended ESWA Logo Watermark for Active App Workspaces.
 * Strictly unmounted in all Reports & Print views.
 */
export interface EswaAppBackgroundWatermarkProps {
  visible?: boolean;
  showLogoWatermark?: boolean;
  isCanvas?: boolean;
  isReport?: boolean;
}

export const EswaAppBackgroundWatermark: React.FC<EswaAppBackgroundWatermarkProps> = ({
  visible = true,
  showLogoWatermark = true,
  isCanvas = false,
  isReport = false,
}) => {
  const { isCanvasActive, isReportActive } = useTheme();
  if (!visible) return null;

  const hideLogo = isCanvas || isReport || isCanvasActive || isReportActive || !showLogoWatermark;

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none z-0 flex items-center justify-center overflow-hidden no-print eswa-bg-watermark"
      aria-hidden="true"
    >
      {/* Full-Bleed Geological Map Backdrop dynamically styled by Theme Color */}
      <EswaGeologicalOrangeMapBackdrop />

      {/* Center-Blended Official ESWA Logo Watermark in Minute Opacity (visible, discreet, never disturbing) */}
      {!hideLogo && (
        <div
          className="relative z-10 flex items-center justify-center opacity-[0.038] mix-blend-multiply pointer-events-none"
          style={{
            width: 'min(58vw, 480px)',
          }}
        >
          <EswaTunnelLogo size="splash" variant="emblem" className="!w-full !h-auto" />
        </div>
      )}
    </div>
  );
};

interface EswaLoadingScreenProps {
  onComplete: () => void;
}

/**
 * Official ESWA 3-Second Animated Boot Splash Screen (Logo Only — No Box!):
 * - Displays ONLY the official cutout ESWA TUNNEL GEOLOGICAL MAPPER logo over the geological orange background.
 * - Eagle flies in from the left while the logo slowly pops out over 3 seconds (3000ms) with the Windows-style welcome chime.
 */
export const EswaLoadingScreen: React.FC<EswaLoadingScreenProps> = ({ onComplete }) => {
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const chimePlayedRef = useRef<boolean>(false);
  const { palette } = useTheme();

  useEffect(() => {
    // Play the synthesized Windows-style warm welcome sound immediately on launch
    const started = playEswaWelcomeChime(false);
    chimePlayedRef.current = started;

    // Fallback unlock listener in case browser autoplay policy deferred initial audio context start
    const handleUnlockAudio = () => {
      if (!chimePlayedRef.current) {
        chimePlayedRef.current = playEswaWelcomeChime(true);
      }
    };
    window.addEventListener('pointerdown', handleUnlockAudio, { once: true });
    window.addEventListener('keydown', handleUnlockAudio, { once: true });

    const totalDurationMs = 3000;

    const exitTimer = window.setTimeout(() => {
      setIsExiting(true);
    }, totalDurationMs - 220);

    const completeTimer = window.setTimeout(() => {
      onComplete();
    }, totalDurationMs);

    return () => {
      window.removeEventListener('pointerdown', handleUnlockAudio);
      window.removeEventListener('keydown', handleUnlockAudio);
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div
      onClick={() => {
        playEswaWelcomeChime(true);
        onComplete();
      }}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center px-4 select-none overflow-hidden cursor-pointer transition-all duration-300 ${
        isExiting ? 'opacity-0 scale-[1.03]' : 'opacity-100 scale-100'
      }`}
      style={{
        backgroundColor: palette.primaryHex,
      }}
      role="dialog"
      aria-label="ESWA Official Boot Splash Screen"
    >
      {/* Full-Bleed Geological Orange Map Backdrop */}
      <EswaGeologicalOrangeMapBackdrop />

      {/* Logo Only — No Box Around It! Eagle Flies in From Left + Logo Slowly Pops Out Over 3 Seconds */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        <EswaTunnelLogo
          size="splash"
          variant="emblem"
          eagleEntranceAnimation
          showBadge={false}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          className="mt-6 px-4 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white/90 text-xs font-semibold tracking-wider uppercase transition-colors shadow-sm"
        >
          Click anywhere to enter
        </button>
      </div>
    </div>
  );
};
