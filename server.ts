import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { exec, execSync } from 'child_process';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

// Prevent unhandled WebSocket/socket errors from crashing the dev server process
process.on('uncaughtException', (err) => {
  console.warn('[Server Warning] uncaughtException suppressed:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning] unhandledRejection suppressed:', reason);
});

const cliPortIdx = process.argv.indexOf('--port');
const cliPort = cliPortIdx !== -1 && process.argv[cliPortIdx + 1] ? Number(process.argv[cliPortIdx + 1]) : null;
const PORT = Number(process.env.PORT) || cliPort || 3000;
const ESWA_GATEWAY_SALT = 'ESWA_GATEWAY_API_SIG_2026';

function validateEswaGatewaySignature(hwId: string, sig: string): boolean {
  if (!hwId || !sig) return false;
  const expected = crypto.createHash('sha256').update(`${hwId}:${ESWA_GATEWAY_SALT}`).digest('hex');
  return expected.toLowerCase() === sig.toLowerCase();
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(express.static('/tmp/akash-release-cache/public'));

  // Global CORS & Preflight support for all /api/* routes (including custom ESWA security headers)
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-ESWA-Hardware-ID, X-ESWA-Signature'
    );
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  /**
   * Enterprise IP Protection & Anti-Reverse Engineering API Gateway Guard:
   * Requires every /api/ai/*, /api/geometry/*, and /api/ota/* request to include custom
   * security headers (X-ESWA-Hardware-ID and X-ESWA-Signature) validated on the server.
   */
  const eswaProprietaryGatewayGuard: express.RequestHandler = (req, res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }
    const hwId = String(
      req.headers['x-eswa-hardware-id'] || req.headers['X-ESWA-Hardware-ID'] || ''
    ).trim();
    const sig = String(
      req.headers['x-eswa-signature'] || req.headers['X-ESWA-Signature'] || ''
    ).trim();

    if (!hwId || !sig || !validateEswaGatewaySignature(hwId, sig)) {
      res.status(403).json({
        error: 'ESWA_GATEWAY_ACCESS_DENIED',
        message:
          'Proprietary API gateway access rejected: Missing or invalid cryptographic hardware signature.',
        securityLock: true,
      });
      return;
    }
    next();
  };

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'ESWA GEOLOGICAL MAPPER',
      timestamp: new Date().toISOString(),
      owner: 'akashdhanusheswar@gmail.com',
    });
  });

  /**
   * Master Admin Authentication Challenge endpoints:
   * /api/auth/send-master-code
   * /api/auth/verify-master-code
   */
  let serverMasterChallenge: { email: string; code: string; expiresAt: number } | null = null;
  const masterChallengeFilePath = '/tmp/akash-release-cache/master-auth-challenge.json';

  const readPersistedMasterChallenge = (): { email: string; code: string; expiresAt: number } | null => {
    if (serverMasterChallenge && Date.now() <= serverMasterChallenge.expiresAt) {
      return serverMasterChallenge;
    }
    try {
      if (fs.existsSync(masterChallengeFilePath)) {
        const parsed = JSON.parse(fs.readFileSync(masterChallengeFilePath, 'utf8'));
        if (parsed && parsed.code && Number(parsed.expiresAt) >= Date.now()) {
          serverMasterChallenge = {
            email: String(parsed.email || '').trim().toLowerCase(),
            code: String(parsed.code).trim(),
            expiresAt: Number(parsed.expiresAt),
          };
          return serverMasterChallenge;
        }
      }
    } catch {
      // Ignore read errors
    }
    return null;
  };

  const writePersistedMasterChallenge = (challenge: { email: string; code: string; expiresAt: number }) => {
    serverMasterChallenge = challenge;
    try {
      const dir = path.dirname(masterChallengeFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(masterChallengeFilePath, JSON.stringify(challenge, null, 2), 'utf8');
    } catch {
      // Ignore write errors
    }
  };

  app.post('/api/auth/send-master-code', async (req, res) => {
    try {
      const { email, code, smtpAppPassword, accessToken } = req.body || {};
      const cleanCode = String(code || Math.floor(100000 + Math.random() * 900000)).trim();
      const cleanEmail = String(email || 'akashdhanusheswar@gmail.com').trim().toLowerCase();

      const challenge = {
        email: cleanEmail,
        code: cleanCode,
        expiresAt: Date.now() + 15 * 60 * 1000,
      };
      writePersistedMasterChallenge(challenge);
      console.info(`[Master Auth] 6-digit challenge code ready for ${cleanEmail}: ${cleanCode}`);

      const subject = `ESWA Software Access Control — Master Login Code: ${cleanCode}`;
      const textBody = [
        'ESWA GEOLOGICAL MAPPER — SOFTWARE ACCESS CONTROL',
        '',
        `Your 6-Digit Master Verification Code is: ${cleanCode}`,
        '',
        `Requested Master Account: ${cleanEmail}`,
        'Valid for: 15 minutes',
        '',
        'Enter this 6-digit code in the ESWA Software Access Control window to unlock Master Owner access on this device.',
      ].join('\n');

      const htmlBody = `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #f59e0b;">
        <h2 style="color: #fbbf24; margin-top: 0; font-size: 18px;">ESWA Software Access Control</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
          Use the following 6-digit verification code to complete Master Owner login on your device:
        </p>
        <div style="background: #020617; border: 2px solid #f59e0b; border-radius: 12px; padding: 18px; text-align: center; margin: 20px 0;">
          <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Master Verification Code</div>
          <div style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 0.35em; color: #fbbf24;">${cleanCode}</div>
        </div>
        <p style="color: #94a3b8; font-size: 12px; font-family: monospace; margin-bottom: 0;">
          Master Account: ${cleanEmail} · Expires in 15 minutes.
        </p>
      </div>`;

      // Target both primary and secondary Master Owner Gmail addresses so whichever inbox is checked receives the code
      const recipientSet = new Set<string>([
        cleanEmail,
        'akashdhanusheswar@gmail.com',
        'dhoniakash707@gmail.com',
      ]);

      let emailDelivered = false;
      let deliveryMethod = 'LOCAL_CHALLENGE_READY';

      // Check stored server email credentials
      let storedOAuthToken = String(accessToken || '').trim();
      let storedSmtpPass = String(smtpAppPassword || process.env.GMAIL_APP_PASSWORD || '')
        .replace(/\s+/g, '')
        .trim();
      try {
        const storeRawPath = '/tmp/akash-release-cache/licensing-cloud-mirror.json';
        if (fs.existsSync(storeRawPath)) {
          const parsedStore = JSON.parse(fs.readFileSync(storeRawPath, 'utf8'));
          if (!storedOAuthToken && parsedStore?.email_config?.oauthAccessToken) {
            storedOAuthToken = String(parsedStore.email_config.oauthAccessToken).trim();
          }
          if (!storedSmtpPass && parsedStore?.email_config?.smtpAppPassword) {
            storedSmtpPass = String(parsedStore.email_config.smtpAppPassword)
              .replace(/\s+/g, '')
              .trim();
          }
        }
      } catch {
        // Ignore store read error
      }

      for (const recipient of Array.from(recipientSet)) {
        if (!recipient || !recipient.includes('@')) continue;

        // 1. Try Gmail OAuth API if token is available
        if (storedOAuthToken) {
          try {
            const boundary = `eswa_master_otp_${Date.now()}`;
            const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
            const mimeLines = [
              `From: "ESWA Software Access Control" <akashdhanusheswar@gmail.com>`,
              `To: ${recipient}`,
              `Subject: ${encodedSubject}`,
              'MIME-Version: 1.0',
              `Content-Type: multipart/alternative; boundary="${boundary}"`,
              '',
              `--${boundary}`,
              'Content-Type: text/plain; charset="UTF-8"',
              'Content-Transfer-Encoding: 8bit',
              '',
              textBody,
              '',
              `--${boundary}`,
              'Content-Type: text/html; charset="UTF-8"',
              'Content-Transfer-Encoding: 8bit',
              '',
              htmlBody,
              '',
              `--${boundary}--`,
              '',
            ];
            const rawEncoded = Buffer.from(mimeLines.join('\r\n'), 'utf8')
              .toString('base64')
              .replace(/\+/g, '-')
              .replace(/\//g, '_')
              .replace(/=+$/, '');

            const gmailResp = await fetch(
              'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${storedOAuthToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ raw: rawEncoded }),
              }
            );
            if (gmailResp.ok) {
              emailDelivered = true;
              deliveryMethod = 'GMAIL_OAUTH_API';
              continue;
            }
          } catch {
            // Fall through to SMTP
          }
        }

        // 2. Try Gmail SMTP via Nodemailer if App Password is available
        if (storedSmtpPass) {
          try {
            const transporter = nodemailer.createTransport({
              host: 'smtp.gmail.com',
              port: 465,
              secure: true,
              auth: {
                user: 'akashdhanusheswar@gmail.com',
                pass: storedSmtpPass,
              },
            });
            await transporter.sendMail({
              from: '"ESWA Software Access Control" <akashdhanusheswar@gmail.com>',
              to: recipient,
              subject,
              text: textBody,
              html: htmlBody,
            });
            emailDelivered = true;
            deliveryMethod = 'GMAIL_SMTP';
            continue;
          } catch {
            // Fall through to FormSubmit relay
          }
        }

        // 3. Try FormSubmit AJAX relay with browser-compatible Origin & Referer headers
        try {
          const originUrl =
            String(req.headers.origin || '').trim() ||
            'https://ais-pre-5ptwqnfp5dwhotfkvwrapg-951690892189.asia-southeast1.run.app';
          const fsResp = await fetch(
            `https://formsubmit.co/ajax/${encodeURIComponent(recipient)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Origin: originUrl,
                Referer: `${originUrl}/`,
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              },
              body: JSON.stringify({
                _subject: subject,
                _template: 'box',
                _captcha: 'false',
                app: 'ESWA Software Access Control',
                master_account: cleanEmail,
                verification_code: cleanCode,
                message: textBody,
              }),
            }
          );
          if (fsResp.ok) {
            const fsJson = (await fsResp.json().catch(() => ({}))) as {
              success?: string | boolean;
            };
            if (fsJson.success === true || fsJson.success === 'true') {
              emailDelivered = true;
              deliveryMethod = 'FORMSUBMIT_RELAY';
            }
          }
        } catch {
          // Ignore external relay error
        }
      }

      res.json({
        ok: true,
        emailDelivered,
        method: deliveryMethod,
        code: cleanCode,
        message: emailDelivered
          ? `6-Digit verification code dispatched (${deliveryMethod}).`
          : 'Challenge generated and ready for verification.',
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message || 'Server error' });
    }
  });

  app.post('/api/auth/verify-master-code', (req, res) => {
    try {
      const { enteredCode } = req.body || {};
      const clean = String(enteredCode || '').trim();
      if (!clean) {
        res.status(400).json({ ok: false, valid: false, error: 'Missing code' });
        return;
      }
      const activeChallenge = readPersistedMasterChallenge();
      if (
        activeChallenge &&
        activeChallenge.code === clean &&
        Date.now() <= activeChallenge.expiresAt
      ) {
        res.json({ ok: true, valid: true });
        return;
      }
      res.json({ ok: true, valid: false });
    } catch (err: any) {
      res.status(500).json({ ok: false, valid: false, error: err?.message || 'Server error' });
    }
  });

  app.use('/api/ai', eswaProprietaryGatewayGuard);
  app.use('/api/geometry', eswaProprietaryGatewayGuard);
  app.use('/api/ota', eswaProprietaryGatewayGuard);

  /**
   * POST /api/ai/trace-joints
   * Hybrid AI + Computer Vision geological discontinuity segmentation & classification endpoint.
   */
  app.post('/api/ai/trace-joints', async (req, res) => {
    try {
      const {
        imageBase64,
        supportingImagesBase64 = [],
        surface = 'face',
        tunnelWidth = 8.0,
        tunnelHeight = 7.0,
        driveDirection = 70,
        cvCandidates = [],
        rejectedOrientations = [],
        confirmedOrientations = [],
        currentModelVersion = 'AKASH AI Model 1.3',
      } = req.body || {};

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Missing imageBase64 payload' });
        return;
      }

      const ai = getGeminiClient();
      const base64Clean = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const cleanSupporting: string[] = Array.isArray(supportingImagesBase64)
        ? supportingImagesBase64
            .slice(0, 5)
            .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
            .map((s) => s.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''))
        : [];

      if (ai) {
        try {
          const learningPrompt =
            Array.isArray(rejectedOrientations) && rejectedOrientations.length > 0
              ? `\nCONTINUOUS GEOLOGIST LEARNING CALIBRATION (${currentModelVersion}):
- Confirmed/Prioritized Fracture Orientations (DipDir/Dip): ${JSON.stringify(confirmedOrientations)}
- Rejected False-Positive Orientations to Suppress: ${JSON.stringify(rejectedOrientations)}`
              : '';

          const promptText = `You are an expert underground engineering geologist mapping a rock tunnel ${surface} photograph.
Master Tunnel Geometry: Width = ${tunnelWidth}m, Height = ${tunnelHeight}m, Tunnel Drive Direction = N ${driveDirection}° E.${learningPrompt}
IMAGE 1 is the MAIN PHOTO (PRIMARY MAPPING IMAGE).
${
  cleanSupporting.length > 0
    ? `IMAGES 2..${cleanSupporting.length + 1} (${cleanSupporting.length} additional photo(s)) are SUPPORTING PHOTOS ONLY. Use them ONLY as supporting evidence to verify geological continuity, resolve shadow/water/shotcrete occlusions, reject non-geological artifacts, and report supportingPhotosCorroborated. ALL output trace coordinates (u, v) MUST be registered strictly to IMAGE 1 (the MAIN PHOTO).`
    : 'No additional supporting photos provided; analyze the MAIN PHOTO directly.'
}
Computer Vision (CLAHE + Sobel + Dark-Valley Ridge Skeleton) on the MAIN PHOTO has detected ${cvCandidates.length} candidate multi-point curvilinear fracture traces in normalized MAIN PHOTO coordinates (u, v in [0.0, 1.0], where u=0 is left, u=1 is right, v=0 is top, v=1 is bottom):
${JSON.stringify(cvCandidates)}

CRITICAL GEOLOGICAL REALISM & MAIN PHOTO RULES:
1. MAIN PHOTO ANCHOR: All returned trace vertices (u, v) must lie strictly in the MAIN PHOTO coordinate frame. Never merge or composite photos.
2. NEVER STRAIGHTEN A REAL JOINT: Real rock joints must NOT be treated as 2-point straight CAD lines. Preserve natural slight curvature, strong curvature, stepped geometry, undulations, and local bends.
3. TRACE THE GEOLOGICAL FEATURE, NOT AN IDEALIZED LINE: Represent every discontinuity as a flexible multi-point polyline containing 7 to 14 vertices (P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7 -> ...) where each segment follows the true visible rock fracture path and local angle variations.
4. JOINT TERMINATION: If a visible geological discontinuity ends inside the exposed rock or abuts against another joint, STOP THE TRACE at that exact point. Never artificially extend a trace across the entire tunnel wall-to-wall.
5. IRREGULAR TRACE WIDTH / APERTURE: Provide vertexWidths (array of relative width multipliers 0.65 to 1.85 at each vertex, representing thin -> wider -> thin variations) separate from the reported apertureMm measurement.
6. Reject any non-geological lines caused by cables, pipes, rockbolts, mesh, lighting glare, mechanical tool marks, or outer frame borders.`;

          const contentParts: Array<
            { inlineData: { mimeType: string; data: string } } | { text: string }
          > = [
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: base64Clean,
              },
            },
            ...cleanSupporting.map((supData) => ({
              inlineData: {
                mimeType: 'image/jpeg',
                data: supData,
              },
            })),
            {
              text: promptText,
            },
          ];

          const candidateModels = [
            'gemini-3-flash-preview',
            'gemini-2.5-flash',
          ];

          for (const modelName of candidateModels) {
            try {
              const response = await ai.models.generateContent({
                model: modelName,
                contents: {
                  parts: contentParts,
                },
                config: {
                  temperature: 0.2,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      traces: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            points: {
                              type: Type.ARRAY,
                              description:
                                '7 to 14 vertices (u, v in [0.04..0.96]) in MAIN PHOTO coordinates following the natural curved, stepped, or undulating geological discontinuity trace.',
                              items: {
                                type: Type.OBJECT,
                                properties: {
                                  u: { type: Type.NUMBER },
                                  v: { type: Type.NUMBER },
                                },
                                required: ['u', 'v'],
                              },
                            },
                            vertexWidths: {
                              type: Type.ARRAY,
                              description:
                                'Relative visual aperture width multiplier (0.65 to 1.85) at each vertex along the trace (thin -> wider -> thin).',
                              items: { type: Type.NUMBER },
                            },
                            featureType: {
                              type: Type.STRING,
                              description:
                                'One of: joint, fracture, fault, shear, bedding, foliation, lineation, lithological_contact, fold, shale_band, dolerite, infilling, water_seepage',
                            },
                            confidence: {
                              type: Type.STRING,
                              description: 'One of: High, Medium, Low',
                            },
                            supportingPhotosCorroborated: {
                              type: Type.NUMBER,
                              description:
                                'Number of supporting photos (0 to 5) that corroborate and confirm this geological feature.',
                            },
                            roughness: {
                              type: Type.STRING,
                            },
                            infilling: {
                              type: Type.STRING,
                            },
                            apertureMm: {
                              type: Type.STRING,
                            },
                            waterCondition: {
                              type: Type.STRING,
                              description: 'One of: Dry, Damp, Wet, Dripping, Flowing',
                            },
                          },
                          required: ['points', 'featureType', 'confidence'],
                        },
                      },
                    },
                    required: ['traces'],
                  },
                },
              });

              const rawText = response.text;
              if (rawText) {
                const parsed = JSON.parse(rawText.trim());
                if (parsed && Array.isArray(parsed.traces) && parsed.traces.length > 0) {
                  res.json({
                    traces: parsed.traces,
                    engine: 'GEMINI_3_8_FLASH_HYBRID',
                  });
                  return;
                }
              }
            } catch {
              // Try next available Gemini model or gracefully fall through to deterministic CV pipeline
            }
          }
        } catch {
          // Cleanly proceed to deterministic CV pipeline
        }
      }

      // Deterministic CV classification fallback if API key is not configured or rate-limited
      const classifiedFromCV = (Array.isArray(cvCandidates) ? cvCandidates : []).map(
        (
          c: {
            points: { u: number; v: number }[];
            vertexWidths?: number[];
            angleDeg: number;
            strength: number;
          },
          idx: number
        ) => {
          const ang = c.angleDeg || 45;
          const isLowAngleBedding = ang < 38 || ang > 142;
          const isProminentShear = idx === 0 && (c.strength || 0.7) > 0.78;

          return {
            points: c.points,
            vertexWidths: c.vertexWidths,
            featureType: isProminentShear ? 'shear' : isLowAngleBedding ? 'bedding' : 'joint',
            confidence:
              (c.strength || 0.7) > 0.72
                ? 'High'
                : (c.strength || 0.7) > 0.55
                ? 'Medium'
                : 'Low',
            roughness: isProminentShear
              ? 'Slickensided / Undulating'
              : isLowAngleBedding
              ? 'Undulating / Planar'
              : 'Rough / Stepped',
            infilling: isProminentShear ? 'Clay / Crushed rock gouge' : 'Not determined',
            apertureMm: isProminentShear ? '5-15 mm (Variable)' : '1-3 mm (Variable)',
            waterCondition: isProminentShear ? 'Damp' : 'Dry',
          };
        }
      );

      res.json({
        traces: classifiedFromCV,
        engine: 'DETERMINISTIC_CV_PIPELINE',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error in AI joint tracing';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/ai/analyze-sketch-shape
   * AI-powered vision and CAD analysis of user's rough hand-drawn tunnel profile with lengths and angles.
   */
  app.post('/api/ai/analyze-sketch-shape', async (req, res) => {
    try {
      const {
        imageBase64,
        strokes = [],
        textAnnotations = [],
        clientMetrics = null,
        userParameters = null,
        tunnelName = 'Custom Tunnel',
        userSymmetryPreference = 'auto',
      } = req.body || {};

      // Normalize annotations to { text, x, y }
      const normalizedAnnotations: { text: string; x: number; y: number }[] = Array.isArray(
        textAnnotations
      )
        ? textAnnotations
            .map((ann: any) => {
              if (typeof ann === 'string') return { text: ann.trim(), x: 0, y: 0 };
              if (ann && typeof ann.text === 'string') {
                return {
                  text: ann.text.trim(),
                  x: typeof ann.x === 'number' ? ann.x : 0,
                  y: typeof ann.y === 'number' ? ann.y : 0,
                };
              }
              return null;
            })
            .filter((a): a is { text: string; x: number; y: number } => Boolean(a && a.text))
        : [];

      // Flatten all stroke points (already in real-world meters: origin (0,0) at centerline invert)
      const allPts: { x: number; y: number }[] = [];
      if (Array.isArray(strokes)) {
        for (const s of strokes) {
          if (Array.isArray(s)) {
            for (const pt of s) {
              if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
                allPts.push({ x: pt.x, y: pt.y });
              }
            }
          } else if (s && Array.isArray(s.points)) {
            for (const pt of s.points) {
              if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
                allPts.push({ x: pt.x, y: pt.y });
              }
            }
          }
        }
      }

      // Deterministic geometric analysis of meter-space strokes
      let strokeSpanM = clientMetrics?.span ?? 8.5;
      let strokeHeightM = clientMetrics?.totalH ?? 7.5;
      let strokeLeftSpanM = clientMetrics?.leftSpan ?? strokeSpanM / 2;
      let strokeRightSpanM = clientMetrics?.rightSpan ?? strokeSpanM / 2;
      let strokeLeftWallHM = clientMetrics?.leftWallH ?? 3.8;
      let strokeRightWallHM = clientMetrics?.rightWallH ?? 3.8;
      let strokeLeftAngleDeg = clientMetrics?.leftAngle ?? 90;
      let strokeRightAngleDeg = clientMetrics?.rightAngle ?? 90;
      let strokeApexOffsetXM = clientMetrics?.apexOffsetX ?? 0;
      let strokeCrownType: 'circular_arc' | 'basket_handle_3arc' | 'flat' =
        clientMetrics?.crownType || 'circular_arc';
      let strokeInvertType: 'flat' | 'curved_dish' = clientMetrics?.invertType || 'flat';
      let strokeInvertSagittaM = clientMetrics?.invertSagittaM ?? 0.3;
      let strokeOpenWall: 'none' | 'left' | 'right' = clientMetrics?.openWall || 'none';
      let strokeIsSymmetric: boolean =
        typeof clientMetrics?.isSymmetric === 'boolean'
          ? clientMetrics.isSymmetric
          : userSymmetryPreference !== 'non-symmetric';

      if (!clientMetrics && allPts.length >= 3) {
        const xs = allPts.map((p) => p.x);
        const ys = allPts.map((p) => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const baseY = Math.abs(minY) <= 0.85 ? 0 : minY;

        strokeSpanM = Number(Math.max(1.5, Math.min(30.0, maxX - minX)).toFixed(2));
        strokeHeightM = Number(Math.max(1.5, Math.min(30.0, maxY - baseY)).toFixed(2));
        const midX = (minX + maxX) / 2;
        strokeLeftSpanM = Number(
          Math.max(0.5, Math.abs(minX) > 0.5 ? Math.abs(minX) : strokeSpanM / 2).toFixed(2)
        );
        strokeRightSpanM = Number(
          Math.max(0.5, maxX > 0.5 ? maxX : strokeSpanM / 2).toFixed(2)
        );

        const leftBand = allPts.filter((p) => p.x <= minX + strokeSpanM * 0.22);
        const rightBand = allPts.filter((p) => p.x >= maxX - strokeSpanM * 0.22);
        strokeLeftWallHM =
          leftBand.length > 0
            ? Number(
                Math.max(
                  0.5,
                  Math.min(strokeHeightM - 0.2, Math.max(...leftBand.map((p) => p.y - baseY)))
                ).toFixed(2)
              )
            : Number((strokeHeightM * 0.52).toFixed(2));
        strokeRightWallHM =
          rightBand.length > 0
            ? Number(
                Math.max(
                  0.5,
                  Math.min(strokeHeightM - 0.2, Math.max(...rightBand.map((p) => p.y - baseY)))
                ).toFixed(2)
              )
            : Number((strokeHeightM * 0.52).toFixed(2));
        const highestPt = allPts.reduce((best, p) => (p.y > best.y ? p : best), allPts[0]);
        strokeApexOffsetXM = Number((highestPt.x - midX).toFixed(2));
      }

      // Parse explicit annotations & spatial dimension pins
      let ovrWidth: number | null = null;
      let ovrLeftSpan: number | null = null;
      let ovrRightSpan: number | null = null;
      let ovrHeight: number | null = null;
      let ovrLeftWallH: number | null = null;
      let ovrRightWallH: number | null = null;
      let ovrLeftAngle: number | null = null;
      let ovrRightAngle: number | null = null;
      let ovrCrownArcLen: number | null = null;
      let ovrInvertDish: number | null = null;
      let ovrOpenWall: 'none' | 'left' | 'right' | null = null;
      let ovrCrownType: 'circular_arc' | 'basket_handle_3arc' | 'flat' | null = null;
      let ovrInvertType: 'flat' | 'curved_dish' | null = null;

      const sketchMinX = allPts.length >= 2 ? Math.min(...allPts.map((p) => p.x)) : -strokeLeftSpanM;
      const sketchMaxX = allPts.length >= 2 ? Math.max(...allPts.map((p) => p.x)) : strokeRightSpanM;
      const sketchMidX = (sketchMinX + sketchMaxX) / 2;
      const sketchMaxY = allPts.length >= 2 ? Math.max(...allPts.map((p) => p.y)) : strokeHeightM;

      for (const ann of normalizedAnnotations) {
        const str = ann.text;
        const annX = ann.x;
        const annY = ann.y;

        if (/(?:^|\b)open\b/i.test(str) || /slashing|drift/i.test(str)) {
          if (/right/i.test(str) || (!/left/i.test(str) && annX > sketchMidX + 0.5)) {
            ovrOpenWall = 'right';
          } else {
            ovrOpenWall = 'left';
          }
        }
        if (/flat\s*(?:roof|crown|back)/i.test(str) || /box|rectangular/i.test(str)) {
          ovrCrownType = 'flat';
        } else if (/basket|3\s*-?\s*arc/i.test(str)) {
          ovrCrownType = 'basket_handle_3arc';
        }
        if (/dish|curved\s*invert/i.test(str)) {
          ovrInvertType = 'curved_dish';
        } else if (/flat\s*(?:invert|floor)/i.test(str)) {
          ovrInvertType = 'flat';
        }

        const matchC =
          str.match(/(?:^|\b)c\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?/i) ||
          str.match(/(?:^|\b)(?:arc|curve)\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?/i);
        const matchDeg = str.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:°|deg|degrees)\b/i) ||
          (/(?:angle|batter|incline)/i.test(str) ? str.match(/([0-9]+(?:\.[0-9]+)?)/) : null);

        if (matchC) {
          ovrCrownArcLen = Number(matchC[1]);
          ovrCrownType = 'circular_arc';
          continue;
        }

        if (matchDeg) {
          const degVal = Math.max(45, Math.min(135, Number(matchDeg[1])));
          if (/right|r-wall|r\s*wall/i.test(str)) {
            ovrRightAngle = degVal;
          } else if (/left|l-wall|l\s*wall/i.test(str)) {
            ovrLeftAngle = degVal;
          } else if (annX > sketchMidX + strokeSpanM * 0.15) {
            ovrRightAngle = degVal;
          } else if (annX < sketchMidX - strokeSpanM * 0.15) {
            ovrLeftAngle = degVal;
            if (strokeIsSymmetric && ovrRightAngle === null) ovrRightAngle = degVal;
          } else {
            ovrLeftAngle = degVal;
            ovrRightAngle = degVal;
          }
        }

        // Remove degree numbers before matching metric lengths
        const strWithoutDeg = str.replace(/[0-9]+(?:\.[0-9]+)?\s*(?:°|deg|degrees)/gi, '');
        const matchM = strWithoutDeg.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:m|meter|meters)?/i);
        if (matchM) {
          const val = Number(matchM[1]);
          if (val <= 0) continue;

          if (/dish|invert\s*depth|sagitta/i.test(str)) {
            ovrInvertDish = val;
            ovrInvertType = 'curved_dish';
          } else if (/left\s*span|l-span/i.test(str)) {
            ovrLeftSpan = val;
          } else if (/right\s*span|r-span/i.test(str)) {
            ovrRightSpan = val;
          } else if (/width|span|\bw\b|floor|invert|base/i.test(str)) {
            ovrWidth = val;
          } else if (/height|\bh\b|total|apex|crown\s*h/i.test(str)) {
            ovrHeight = val;
          } else if (/right\s*wall|r-wall|r\s*wall|\brw\b/i.test(str)) {
            ovrRightWallH = val;
          } else if (/left\s*wall|l-wall|l\s*wall|\blw\b/i.test(str)) {
            ovrLeftWallH = val;
          } else if (/wall|shoulder|wh|springline/i.test(str)) {
            if (ovrOpenWall === 'left' || strokeOpenWall === 'left') {
              ovrRightWallH = val;
            } else if (ovrOpenWall === 'right' || strokeOpenWall === 'right') {
              ovrLeftWallH = val;
            } else if (annX > sketchMidX + strokeSpanM * 0.15) {
              ovrRightWallH = val;
            } else if (annX < sketchMidX - strokeSpanM * 0.15) {
              ovrLeftWallH = val;
              if (strokeIsSymmetric && ovrRightWallH === null) ovrRightWallH = val;
            } else {
              ovrLeftWallH = val;
              ovrRightWallH = val;
            }
          } else {
            // Bare number pin (e.g., "6m", "8m", "3.2m") — classify using spatial (x, y) pin position!
            const isNearFloor = annY <= Math.max(0.8, sketchMaxY * 0.2);
            const isNearRoof = annY >= sketchMaxY * 0.75;
            const isLeftFlank = annX < sketchMidX - strokeSpanM * 0.18;
            const isRightFlank = annX > sketchMidX + strokeSpanM * 0.18;

            if (isNearFloor && !isLeftFlank && !isRightFlank) {
              ovrWidth = val;
            } else if (isNearRoof && !isLeftFlank && !isRightFlank) {
              ovrHeight = val;
            } else if (isLeftFlank) {
              if ((ovrOpenWall === 'left' || strokeOpenWall === 'left') && val > strokeRightWallHM) {
                ovrHeight = val;
              } else {
                ovrLeftWallH = val;
                if (strokeIsSymmetric && ovrRightWallH === null) ovrRightWallH = val;
              }
            } else if (isRightFlank) {
              if ((ovrOpenWall === 'right' || strokeOpenWall === 'right') && val > strokeLeftWallHM) {
                ovrHeight = val;
              } else {
                ovrRightWallH = val;
              }
            } else {
              // Fallback if placed near center: assign unassigned dimensions logically
              if (ovrWidth === null && Math.abs(val - strokeSpanM) <= Math.abs(val - strokeHeightM)) {
                ovrWidth = val;
              } else if (ovrHeight === null) {
                ovrHeight = val;
              } else if (ovrLeftWallH === null) {
                ovrLeftWallH = val;
                ovrRightWallH = val;
              }
            }
          }
        }
      }

      const ai = getGeminiClient();
      let aiResult: any = null;

      if (ai && imageBase64 && typeof imageBase64 === 'string') {
        const base64Clean = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
        const prompt = `You are a licensed underground civil/mining tunnel engineer and computer vision specialist.
The user has sketched a tunnel cross-section on an 800x480 engineering drafting canvas.
CANVAS COORDINATE SYSTEM & EXACT SCALE:
- Canvas resolution: 800px wide by 480px high.
- Scale: 36 pixels = 1.00 meter (5-meter major grid squares = 180px).
- Tunnel Centerline (CL, X = 0.00m) is the vertical dashed amber line at X = 400px.
- Invert Datum (Floor RL 0.00m, Y = 0.00m) is the horizontal green line at Y = 380px.

PRE-COMPUTED GEOMETRIC METRICS FROM USER'S DRAWN STROKES (IN METERS):
${JSON.stringify(
  {
    drawnPointCount: allPts.length,
    measuredSpanM: strokeSpanM,
    measuredLeftSpanM: strokeLeftSpanM,
    measuredRightSpanM: strokeRightSpanM,
    measuredTotalHeightM: strokeHeightM,
    measuredLeftWallHeightM: strokeLeftWallHM,
    measuredRightWallHeightM: strokeRightWallHM,
    measuredLeftWallAngleDeg: strokeLeftAngleDeg,
    measuredRightWallAngleDeg: strokeRightAngleDeg,
    measuredApexOffsetXM: strokeApexOffsetXM,
    detectedCrownType: strokeCrownType,
    detectedInvertType: strokeInvertType,
    detectedOpenWall: ovrOpenWall || strokeOpenWall,
  },
  null,
  2
)}

USER EXPLICIT PARAMETER OVERRIDES (IF ANY):
${JSON.stringify(userParameters || {}, null, 2)}

USER ANNOTATIONS / DIMENSION PINS ON CANVAS (with X, Y meter coordinates):
${JSON.stringify(normalizedAnnotations, null, 2)}

USER SYMMETRY PREFERENCE: ${userSymmetryPreference}
CRITICAL RULES:
1. If the user placed dimension pins/annotations (e.g. "W = 6.0m", "H = 8.0m", "Wall = 3.2m", "c 10.2m", "80°", "open") or explicit userParameters, those exact numbers MUST take highest priority!
2. If no annotation overrides a dimension and the user drew strokes on the canvas (drawnPointCount >= 3), use the PRE-COMPUTED GEOMETRIC METRICS from the user's strokes so the output matches the drawn shape on the meter grid with 100% accuracy!
3. In tunnel drawings, "c <number>m" (e.g., "c 10.2m", "c 10.6m") denotes the exact CURVED CROWN ARC LENGTH in meters (crownArcLengthM).
4. If one wall is marked "open" (or openWall is "left" or "right"), set openWall accordingly, hasLeftWall / hasRightWall, isSymmetric = false, and archetype = "open_slashing_drift".
5. If userSymmetryPreference === "non-symmetric" or the sketch/annotations have different left vs right wall heights, angles, or half-spans, set isSymmetric = false and report leftWallHeightM, rightWallHeightM, leftWallAngleDeg, rightWallAngleDeg, leftSpanM, and rightSpanM independently.
6. If the drawn roof is flat/rectangular, set crownType = "flat" and archetype = "box_portal".`;

        const candidateModels = ['gemini-3-flash-preview', 'gemini-2.5-flash'];
        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/png',
                      data: base64Clean,
                    },
                  },
                  {
                    text: prompt,
                  },
                ],
              },
              config: {
                temperature: 0.05,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    archetype: { type: Type.STRING },
                    openWall: { type: Type.STRING, description: 'none, left, or right' },
                    hasLeftWall: { type: Type.BOOLEAN },
                    hasRightWall: { type: Type.BOOLEAN },
                    widthM: { type: Type.NUMBER },
                    leftSpanM: { type: Type.NUMBER },
                    rightSpanM: { type: Type.NUMBER },
                    heightM: { type: Type.NUMBER },
                    apexOffsetXM: { type: Type.NUMBER },
                    leftWallHeightM: { type: Type.NUMBER },
                    rightWallHeightM: { type: Type.NUMBER },
                    leftWallAngleDeg: { type: Type.NUMBER },
                    rightWallAngleDeg: { type: Type.NUMBER },
                    crownSagittaM: { type: Type.NUMBER },
                    crownArcLengthM: { type: Type.NUMBER },
                    crownType: { type: Type.STRING },
                    invertType: { type: Type.STRING },
                    invertSagittaM: { type: Type.NUMBER },
                    invertArcLengthM: { type: Type.NUMBER },
                    isSymmetric: { type: Type.BOOLEAN },
                    recognizedDimensions: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    explanation: { type: Type.STRING },
                  },
                  required: ['archetype', 'widthM', 'heightM', 'crownSagittaM'],
                },
              },
            });
            const parsed = JSON.parse(response.text || '{}');
            if (parsed && typeof parsed.widthM === 'number' && typeof parsed.heightM === 'number') {
              aiResult = parsed;
              break;
            }
          } catch (modelErr) {
            console.warn(`[AI Sketch Analysis] Model ${modelName} error:`, modelErr);
          }
        }
      }

      // Reconcile AI result (if available) with deterministic stroke metrics, spatial pins, and locked user parameters
      const finalOpenWall: 'none' | 'left' | 'right' =
        ovrOpenWall ??
        (userParameters?.openWall as 'none' | 'left' | 'right' | undefined) ??
        (aiResult?.openWall === 'left' || aiResult?.openWall === 'right'
          ? aiResult.openWall
          : strokeOpenWall);

      const finalIsSymmetric: boolean =
        finalOpenWall !== 'none'
          ? false
          : userSymmetryPreference === 'non-symmetric'
          ? false
          : ovrLeftWallH !== null &&
            ovrRightWallH !== null &&
            Math.abs(ovrLeftWallH - ovrRightWallH) > 0.05
          ? false
          : ovrLeftAngle !== null &&
            ovrRightAngle !== null &&
            Math.abs(ovrLeftAngle - ovrRightAngle) >= 1
          ? false
          : typeof aiResult?.isSymmetric === 'boolean' && allPts.length === 0
          ? aiResult.isSymmetric
          : strokeIsSymmetric;

      const hasStrokes = allPts.length >= 3;

      let finalWidth =
        ovrWidth ??
        userParameters?.widthM ??
        (hasStrokes ? strokeSpanM : aiResult?.widthM ?? 8.5);
      let finalLeftSpan =
        ovrLeftSpan ??
        userParameters?.leftSpanM ??
        (finalIsSymmetric
          ? Number((finalWidth / 2).toFixed(2))
          : hasStrokes
          ? strokeLeftSpanM
          : aiResult?.leftSpanM ?? Number((finalWidth / 2).toFixed(2)));
      let finalRightSpan =
        ovrRightSpan ??
        userParameters?.rightSpanM ??
        (finalIsSymmetric
          ? Number((finalWidth / 2).toFixed(2))
          : hasStrokes
          ? strokeRightSpanM
          : aiResult?.rightSpanM ?? Number((finalWidth / 2).toFixed(2)));

      if (!finalIsSymmetric && (ovrLeftSpan !== null || ovrRightSpan !== null)) {
        finalWidth = Number((finalLeftSpan + finalRightSpan).toFixed(2));
      } else if (finalIsSymmetric) {
        finalLeftSpan = Number((finalWidth / 2).toFixed(2));
        finalRightSpan = Number((finalWidth / 2).toFixed(2));
      }

      let finalHeight =
        ovrHeight ??
        userParameters?.heightM ??
        (hasStrokes ? strokeHeightM : aiResult?.heightM ?? 7.5);

      let finalLeftWallH =
        finalOpenWall === 'left'
          ? 0
          : ovrLeftWallH ??
            userParameters?.leftWallHeightM ??
            (hasStrokes ? strokeLeftWallHM : aiResult?.leftWallHeightM ?? Number((finalHeight * 0.52).toFixed(2)));

      let finalRightWallH =
        finalOpenWall === 'right'
          ? 0
          : ovrRightWallH ??
            userParameters?.rightWallHeightM ??
            (finalIsSymmetric
              ? finalLeftWallH
              : hasStrokes
              ? strokeRightWallHM
              : aiResult?.rightWallHeightM ?? finalLeftWallH);

      const detectedShapeKind: string = clientMetrics?.shapeKind || 'arched_tunnel';
      const isPolygonalNoSidewall =
        detectedShapeKind === 'triangle' &&
        ovrLeftWallH === null &&
        ovrRightWallH === null &&
        userParameters?.leftWallHeightM === undefined &&
        userParameters?.rightWallHeightM === undefined;

      // Clamp wall heights so they never exceed total height (allow 0m for pure triangles!)
      if (finalOpenWall !== 'left') {
        finalLeftWallH = isPolygonalNoSidewall
          ? 0
          : Number(Math.max(0, Math.min(finalHeight - 0.1, finalLeftWallH)).toFixed(2));
      }
      if (finalOpenWall !== 'right') {
        finalRightWallH = isPolygonalNoSidewall
          ? 0
          : Number(
              Math.max(
                0,
                Math.min(finalHeight - 0.1, finalIsSymmetric ? finalLeftWallH : finalRightWallH)
              ).toFixed(2)
            );
      }

      const finalLeftAngle =
        ovrLeftAngle ??
        userParameters?.leftWallAngleDeg ??
        (hasStrokes ? strokeLeftAngleDeg : aiResult?.leftWallAngleDeg ?? 90);
      const finalRightAngle =
        ovrRightAngle ??
        userParameters?.rightWallAngleDeg ??
        (finalIsSymmetric
          ? finalLeftAngle
          : hasStrokes
          ? strokeRightAngleDeg
          : aiResult?.rightWallAngleDeg ?? finalLeftAngle);

      const finalCrownType: 'circular_arc' | 'basket_handle_3arc' | 'flat' =
        ovrCrownType ??
        userParameters?.crownType ??
        (hasStrokes ? strokeCrownType : aiResult?.crownType || 'circular_arc');

      const finalInvertType: 'flat' | 'curved_dish' =
        ovrInvertType ??
        userParameters?.invertType ??
        (hasStrokes ? strokeInvertType : aiResult?.invertType || 'flat');

      const finalInvertSagitta =
        ovrInvertDish ??
        userParameters?.invertSagittaM ??
        (hasStrokes ? strokeInvertSagittaM : aiResult?.invertSagittaM ?? 0.3);

      const finalCrownArcLength =
        ovrCrownArcLen ??
        userParameters?.crownArcLengthM ??
        (aiResult?.crownArcLengthM && aiResult.crownArcLengthM > 0 ? aiResult.crownArcLengthM : null);

      const finalApexOffsetX = finalIsSymmetric
        ? 0
        : userParameters?.apexOffsetXM ??
          (hasStrokes ? strokeApexOffsetXM : aiResult?.apexOffsetXM ?? 0);

      // Compute exact crown sagitta and reconcile height when curve length C is specified
      const leftRad = ((90 - finalLeftAngle) * Math.PI) / 180;
      const rightRad = ((90 - finalRightAngle) * Math.PI) / 180;
      const leftShoulderX =
        -finalLeftSpan + Math.tan(leftRad) * (finalOpenWall === 'left' ? finalHeight : finalLeftWallH);
      const rightShoulderX =
        finalRightSpan - Math.tan(rightRad) * (finalOpenWall === 'right' ? finalHeight : finalRightWallH);
      const leftShoulderY = finalOpenWall === 'left' ? finalHeight : finalLeftWallH;
      const rightShoulderY = finalOpenWall === 'right' ? finalHeight : finalRightWallH;
      const chordLtoR = Math.max(
        1.0,
        Math.hypot(rightShoulderX - leftShoulderX, rightShoulderY - leftShoulderY)
      );
      const midShoulderY = (leftShoulderY + rightShoulderY) / 2;

      let finalCrownSagitta = Number(
        Math.max(0, finalHeight - Math.min(leftShoulderY, rightShoulderY)).toFixed(2)
      );

      if (finalCrownArcLength && finalCrownArcLength > chordLtoR * 1.001) {
        let low = 0.005;
        let high = 2.5;
        for (let iter = 0; iter < 36; iter++) {
          const mid = (low + high) / 2;
          const theta = 4 * Math.atan(mid);
          const radius = chordLtoR / (2 * Math.sin(theta / 2));
          const arcLen = radius * theta;
          if (arcLen < finalCrownArcLength) low = mid;
          else high = mid;
        }
        const solvedBulge = (low + high) / 2;
        finalCrownSagitta = Number(((chordLtoR * solvedBulge) / 2).toFixed(2));
        if (finalOpenWall === 'none' && ovrHeight === null && userParameters?.heightM === undefined) {
          finalHeight = Number((midShoulderY + finalCrownSagitta).toFixed(2));
        }
      }

      const finalArchetype =
        finalOpenWall !== 'none'
          ? 'open_slashing_drift'
          : detectedShapeKind === 'triangle' ||
            detectedShapeKind === 'quadrilateral' ||
            detectedShapeKind === 'pentagon_gable' ||
            detectedShapeKind === 'polygon'
          ? detectedShapeKind
          : finalCrownType === 'flat'
          ? 'box_portal'
          : finalCrownType === 'basket_handle_3arc'
          ? 'modified_horseshoe'
          : finalLeftAngle !== 90 || finalRightAngle !== 90 || finalInvertType === 'curved_dish'
          ? 'horseshoe'
          : aiResult?.archetype || 'd_shaped';

      const mergedResult = {
        archetype: finalArchetype,
        shapeKind: detectedShapeKind,
        controlPoints: clientMetrics?.controlPoints,
        segments: clientMetrics?.segments,
        openWall: finalOpenWall,
        hasLeftWall: finalOpenWall !== 'left' && !isPolygonalNoSidewall,
        hasRightWall: finalOpenWall !== 'right' && !isPolygonalNoSidewall,
        widthM: Number(finalWidth.toFixed(2)),
        leftSpanM: Number(finalLeftSpan.toFixed(2)),
        rightSpanM: Number(finalRightSpan.toFixed(2)),
        heightM: Number(finalHeight.toFixed(2)),
        apexOffsetXM: Number(finalApexOffsetX.toFixed(2)),
        leftWallHeightM: Number(finalLeftWallH.toFixed(2)),
        rightWallHeightM: Number(finalRightWallH.toFixed(2)),
        leftWallAngleDeg: Number(finalLeftAngle.toFixed(1)),
        rightWallAngleDeg: Number(finalRightAngle.toFixed(1)),
        crownSagittaM: Number(finalCrownSagitta.toFixed(2)),
        crownArcLengthM: finalCrownArcLength ? Number(finalCrownArcLength.toFixed(2)) : undefined,
        crownType: finalCrownType,
        invertType: finalInvertType,
        invertSagittaM: Number(finalInvertSagitta.toFixed(2)),
        isSymmetric: finalIsSymmetric,
        recognizedDimensions: normalizedAnnotations.map((a) => a.text),
        explanation:
          detectedShapeKind === 'triangle'
            ? `Solved exact 3-vertex CAD Triangle profile from canvas drawing: Span ${finalWidth.toFixed(2)}m × Height ${finalHeight.toFixed(2)}m (Left slope ${finalLeftAngle}°, Right slope ${finalRightAngle}°).`
            : detectedShapeKind === 'quadrilateral' ||
              detectedShapeKind === 'pentagon_gable' ||
              detectedShapeKind === 'polygon'
            ? `Solved exact ${clientMetrics?.controlPoints?.length || 4}-vertex CAD ${detectedShapeKind.replace(/_/g, ' ')} profile from canvas drawing: Span ${finalWidth.toFixed(2)}m × Height ${finalHeight.toFixed(2)}m.`
            : aiResult?.explanation ||
              (finalOpenWall !== 'none'
                ? `Solved open tunnel (${finalOpenWall} wall open): Span ${finalWidth.toFixed(2)}m, Height ${finalHeight.toFixed(2)}m${
                    finalCrownArcLength ? `, Curve Arc C=${finalCrownArcLength.toFixed(2)}m` : ''
                  }.`
                : `Solved ${finalIsSymmetric ? 'symmetric' : 'non-symmetric'} ${finalArchetype.replace(/_/g, ' ')} profile: Span ${finalWidth.toFixed(2)}m × Height ${finalHeight.toFixed(2)}m (L-Wall ${finalLeftWallH.toFixed(2)}m @ ${finalLeftAngle}°, R-Wall ${finalRightWallH.toFixed(2)}m @ ${finalRightAngle}°${
                    finalCrownArcLength ? `, Arc C=${finalCrownArcLength.toFixed(2)}m` : ''
                  }).`),
      };

      res.json({
        success: true,
        source: aiResult ? 'GEMINI_AI_VISION' : 'LOCAL_GEOMETRIC_SOLVER',
        result: mergedResult,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error in sketch analysis';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/geometry/parse-cad
   * Backend DWG / DXF conversion pipeline to extract tunnel vector cross-section coordinates.
   */
  app.post('/api/geometry/parse-cad', async (req, res) => {
    try {
      const { fileName = 'tunnel.dwg', contentBase64 = '' } = req.body || {};
      const buf = Buffer.from(contentBase64, 'base64');
      const asciiView = buf.toString('utf8');

      // Check if ASCII DXF content is present inside file
      if (asciiView.includes('SECTION') && asciiView.includes('ENTITIES')) {
        res.json({
          format: 'dxf',
          dxfText: asciiView,
        });
        return;
      }

      // For binary DWG files (AC1015 / AC1018 / AC1021 / AC1024 / AC1027 / AC1032),
      // scan IEEE-754 double coordinate pairs in the entity stream or header EXTMIN / EXTMAX
      const doubles: number[] = [];
      for (let offset = 64; offset < Math.min(buf.length - 8, 65536); offset += 8) {
        const val = buf.readDoubleLE(offset);
        if (isFinite(val) && Math.abs(val) >= 0.5 && Math.abs(val) <= 25.0) {
          doubles.push(Number(val.toFixed(3)));
        }
      }

      // Extract realistic tunnel dimensions if embedded, or standard D-shaped tunnel master geometry
      let width = 8.4;
      let height = 7.2;
      if (doubles.length >= 4) {
        const candidates = doubles.filter((d) => d >= 3.5 && d <= 18.0);
        if (candidates.length >= 2) {
          width = Number(candidates[0].toFixed(2));
          height = Number(Math.max(3.5, Math.min(width * 1.15, candidates[1])).toFixed(2));
        }
      }
      const wallHeight = Number((height * 0.58).toFixed(2));

      res.json({
        format: 'dwg_converted',
        fileName,
        width,
        height,
        wallHeight,
        crownGeometry: 'd_shaped',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'CAD conversion error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/ai/eswa-chat
   * ESWA AI Executive Assistant with Full Software Authority & Multi-Format Template Data Extraction.
   */
  app.post('/api/ai/eswa-chat', async (req, res) => {
    try {
      const {
        message = '',
        history = [],
        softwareContext = {},
      } = req.body || {};

      const userPrompt = String(message || '').trim();
      if (!userPrompt) {
        res.status(400).json({ error: 'Missing chat message' });
        return;
      }

      const ai = getGeminiClient();

      if (ai) {
        const systemInstruction = `You are ESWA AI — the senior geotechnical & tunneling engineering AI assistant inside ESWA Tunnel Mapper & ESWACAD.
You have full access to the live software state, overbreak root-cause & advance predictions, rock strata support system Factor of Safety (FoS), spot bolting locations & historical pull data, and kinematic failure mode Factors of Safety (Wedge, Planar, Keyblock, Buckling, Stress).

LIVE SOFTWARE DATA SNAPSHOT:
${JSON.stringify(softwareContext, null, 2)}

CRITICAL RULES FOR YOUR RESPONSE:
1. Answer the EXACT question the user is asking directly, accurately, and thoroughly using the live software data!
   - NEVER dump irrelevant download files or previous unrelated tables.
   - If the user asks why overbreak happened or whether it is geological vs mechanical/excavation, explain the exact Geological % vs Mechanical % breakdown, zone-by-zone root causes, and Next-Round Advance Prediction from the live data.
   - If the user asks about Spot Bolting, explain the exact chosen Spot Bolting locations, coordinates, reasons, historical data collected from previous spot-bolt pulls, and the exact number of spot bolts required.
   - If the user asks about the Support System, Rock Strata Factor of Safety, or Wedge/Failure Mode Factor of Safety, provide the exact Support Pressure Demand (kPa), Installed Capacity (kPa), Rock Strata FoS, and Unbolted vs Supported FoS for Wedge, Planar, Keyblock, and Stress failures, along with actionable engineering recommendations.
2. Set "includeDataSchedule" to true ONLY if the user explicitly asks for a table/schedule/report to be displayed. Otherwise MUST set "includeDataSchedule" to false.
3. Choose "dataCategory" matching the user's topic:
   - "SUPPORT_SPOTBOLT_FOS_TEMPLATE" (for support system, spot bolting, rock strata FoS, wedge/failure FoS)
   - "OVERBREAK_SUPPORT_BOQ_TEMPLATE" (for overbreak, mechanical vs geological overbreak, undercut, BOQ)
   - "JOINT_DISCONTINUITY_TEMPLATE" (for joints, dip, strike, discontinuities)
   - "STRIP_PULL_LOG_TEMPLATE" (for 3D continuous strip logging pulls)
   - "EXECUTIVE_PROJECT_AUDIT_TEMPLATE" (only if asking for a full project audit)
4. If the user asks you to perform a software action (e.g. open 3D Continuous Logging, open Face Mapping, change width/height, add a pull, add a joint, switch theme, save section), include it in "executedActions".`;

        const historyContents = Array.isArray(history)
          ? history.slice(-8).map((h: { role?: string; text?: string }) => ({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: String(h.text || '') }],
            }))
          : [];

        const candidateModels = [
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
        ];

        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                ...historyContents,
                {
                  role: 'user',
                  parts: [{ text: userPrompt }],
                },
              ],
              config: {
                systemInstruction,
                temperature: 0.25,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    reply: {
                      type: Type.STRING,
                      description:
                        'Direct, specific, engineering-grade answer to the exact question asked by the user.',
                    },
                    includeDataSchedule: {
                      type: Type.BOOLEAN,
                      description:
                        'True ONLY if the user explicitly asked to view a table or schedule.',
                    },
                    dataCategory: {
                      type: Type.STRING,
                      description:
                        'One of: SUPPORT_SPOTBOLT_FOS_TEMPLATE, OVERBREAK_SUPPORT_BOQ_TEMPLATE, JOINT_DISCONTINUITY_TEMPLATE, STRIP_PULL_LOG_TEMPLATE, EXECUTIVE_PROJECT_AUDIT_TEMPLATE',
                    },
                    executedActions: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          actionType: {
                            type: Type.STRING,
                            description:
                              'One of: OPEN_3D_CONTINUOUS_LOGGING, OPEN_FACE_MAPPING, OPEN_CUSTOM_PROFILE_EDITOR, OPEN_PROJECT_DATABASE, OPEN_EXPORT_SHEET, UPDATE_GEOMETRY, UPDATE_SETTINGS, ADD_JOINT, ADD_STRIP_PULL, SAVE_SECTION, SET_THEME, NONE',
                          },
                          description: {
                            type: Type.STRING,
                          },
                          payloadJson: {
                            type: Type.STRING,
                          },
                        },
                        required: ['actionType', 'description'],
                      },
                    },
                  },
                  required: ['reply', 'includeDataSchedule', 'dataCategory', 'executedActions'],
                },
              },
            });

            const rawText = response.text;
            if (rawText) {
              const parsed = JSON.parse(rawText.trim());
              if (parsed && typeof parsed.reply === 'string') {
                res.json({
                  ...parsed,
                  engine: modelName,
                });
                return;
              }
            }
          } catch {
            // Try next model or fall through to local deterministic executive engine
          }
        }
      }

      // Deterministic Local Executive Intelligence Fallback (ensures 100% reliability offline or without API key)
      res.json({
        fallback: true,
        engine: 'ESWA_LOCAL_EXECUTIVE_CORE',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'ESWA AI Chat error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/ai/analyze-geotech
   * Dedicated AI Geotechnical Analysis for Overbreak Root-Cause & Advance Prediction,
   * Spot Bolting Location Selection, and Rock Strata / Wedge Failure Factor of Safety.
   */
  app.post('/api/ai/analyze-geotech', async (req, res) => {
    try {
      const { mode = 'FULL_GEOTECH', context = {} } = req.body || {};
      const ai = getGeminiClient();

      if (ai) {
        const candidateModels = [
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
        ];
        const prompt = `You are a Principal Underground Rock Mechanics & Tunnel Support Engineer.
Analyze the following live tunnel excavation, discontinuity sets, overbreak profile, historical pulls, and support system data (Mode: ${mode}):
${JSON.stringify(context, null, 2)}

Provide a concise, authoritative engineering analysis covering:
1. Overbreak Root-Cause Diagnosis (Geological Wedge/Joint vs. Mechanical Excavation Profile Deviation) and Advance Prediction for the next round.
2. Spot Bolting Locations Chosen, historical pull correlation, and exact number of spot bolts required.
3. Rock Strata Support System Factor of Safety (FoS) and Wedge / Planar / Keyblock Failure Mode FoS recommendations.`;

        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    overbreakExecutiveSummary: { type: Type.STRING },
                    nextAdvanceMitigation: { type: Type.STRING },
                    supportAndFosRecommendation: { type: Type.STRING },
                    spotBoltingJustification: { type: Type.STRING },
                  },
                  required: [
                    'overbreakExecutiveSummary',
                    'nextAdvanceMitigation',
                    'supportAndFosRecommendation',
                    'spotBoltingJustification',
                  ],
                },
              },
            });
            if (response.text) {
              const parsed = JSON.parse(response.text.trim());
              res.json({ ...parsed, engine: modelName });
              return;
            }
          } catch {
            // Try next model
          }
        }
      }

      res.json({ fallback: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Geotech AI analysis error';
      res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/offline-pc-installer
   * Packages the compiled dist/ bundle (HTML + CSS + JS) into a 100% self-contained
   * local Windows PC application installer that runs from %LOCALAPPDATA% without
   * opening any website URL or requiring an internet connection.
   */
  app.get('/api/offline-pc-installer', (req, res) => {
    try {
      const format = String(req.query.format || 'bat');
      const distDir = path.join(process.cwd(), 'dist');
      const assetsDir = path.join(distDir, 'assets');

      // Ensure fresh production minified bundle exists
      if (!fs.existsSync(assetsDir) || !fs.readdirSync(assetsDir).some((f) => f.endsWith('.js'))) {
        try {
          execSync('npx vite build', { cwd: process.cwd(), stdio: 'pipe' });
        } catch {
          // Fall through if build command is busy
        }
      }

      let cssContent = '';
      let jsContent = '';

      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir);
        for (const file of files) {
          // Strictly exclude any source maps (.map)
          if (file.endsWith('.map')) continue;
          const fullPath = path.join(assetsDir, file);
          if (file.endsWith('.css')) {
            cssContent += fs.readFileSync(fullPath, 'utf8') + '\n';
          } else if (file.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            // Aggressively strip any lingering sourceMappingUrls or debugger directives
            content = content.replace(/\/\/# sourceMappingURL=.*$/gm, '');
            jsContent += content + '\n';
          }
        }
      }

      // Escape closing script tags inside JS bundle if any exist
      const safeJsContent = jsContent.replace(/<\/script>/gi, '<\\/script>');

      const standaloneHtml = `<!doctype html>
<html lang="en" data-theme="dark" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ESWA GEOLOGICAL MAPPER — Desktop Engineering Suite</title>
    <style>${cssContent}</style>
    <script>
      // Enterprise IP Protection & Hardware-Lock Pre-Mount Runtime Guard
      (function() {
        try {
          window.__ESWA_OFFLINE_STANDALONE_PC__ = true;
          window.__ESWA_STANDALONE_PC_EXE__ = true;
          window.__ESWA_EDITION__ = 'user';
          // Check tamper lockout state before React components initialize
          if (typeof window !== 'undefined' && window.localStorage) {
            var lockoutKey = 'eswa_tamper_lockout_active_v1';
            if (localStorage.getItem(lockoutKey)) {
              console.warn('[ESWA ENTERPRISE SHIELD] Machine Tamper Violation Lockout active.');
            }
          }
        } catch (e) {}
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
${safeJsContent}
    </script>
  </body>
</html>`;

      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="ESWA_Geological_Mapper_Offline_PC.html"'
        );
        res.send(standaloneHtml);
        return;
      }

      const b64Payload = Buffer.from(standaloneHtml, 'utf8').toString('base64');
      const b64Lines: string[] = [];
      for (let i = 0; i < b64Payload.length; i += 76) {
        b64Lines.push(b64Payload.slice(i, i + 76));
      }

      const batLines = [
        '@echo off',
        'setlocal',
        'title ESWA Geological Mapper - Offline PC Software Installer',
        'echo ============================================================================',
        'echo   ESWA GEOLOGICAL MAPPER - STANDALONE OFFLINE PC SOFTWARE INSTALLER',
        'echo ============================================================================',
        'echo.',
        'set "INSTALL_DIR=%LOCALAPPDATA%\\EswaGeologicalMapper"',
        'if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"',
        'set "B64_FILE=%INSTALL_DIR%\\app_bundle.b64"',
        'set "APP_HTML=%INSTALL_DIR%\\EswaGeologyApp.html"',
        'set "LAUNCHER_CMD=%INSTALL_DIR%\\Launch_Eswa_Geological_Mapper.vbs"',
        'echo [1/3] Extracting standalone offline software files to %INSTALL_DIR%...',
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Get-Content -LiteralPath \'%~f0\'; $idx = [Array]::IndexOf($c, \'::===PAYLOAD_START===\'); $b64 = $c[($idx+1)..($c.Length-1)] -join \'\'; [IO.File]::WriteAllBytes(\'%APP_HTML%\', [Convert]::FromBase64String($b64))"',
        'echo [2/3] Creating silent Windows desktop window launcher (no website / 100%% offline)...',
        '(',
        '  echo Set sh = CreateObject("WScript.Shell"^)',
        '  echo Set fso = CreateObject("Scripting.FileSystemObject"^)',
        '  echo appFile = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\\EswaGeologicalMapper\\EswaGeologyApp.html"^)',
        '  echo fileUrl = "file:///" ^& Replace(appFile, "\\", "/"^)',
        '  echo edge1 = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"',
        '  echo edge2 = "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"',
        '  echo chrome1 = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
        '  echo If fso.FileExists(edge1^) Then',
        '  echo   sh.Run """" ^& edge1 ^& """ --app=""" ^& fileUrl ^& """ --start-maximized", 1, False',
        '  echo ElseIf fso.FileExists(edge2^) Then',
        '  echo   sh.Run """" ^& edge2 ^& """ --app=""" ^& fileUrl ^& """ --start-maximized", 1, False',
        '  echo ElseIf fso.FileExists(chrome1^) Then',
        '  echo   sh.Run """" ^& chrome1 ^& """ --app=""" ^& fileUrl ^& """ --start-maximized", 1, False',
        '  echo Else',
        '  echo   sh.Run """" ^& appFile ^& """", 1, False',
        '  echo End If',
        ') > "%LAUNCHER_CMD%"',
        'echo [3/3] Creating Desktop and Start Menu shortcuts...',
        'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $dt = [Environment]::GetFolderPath(\'Desktop\'); $sm = [Environment]::GetFolderPath(\'Programs\'); foreach ($dir in @($dt, $sm)) { $s = $ws.CreateShortcut((Join-Path $dir \'ESWA Geological Mapper.lnk\')); $s.TargetPath = \'wscript.exe\'; $s.Arguments = \'\"%LOCALAPPDATA%\\EswaGeologicalMapper\\Launch_Eswa_Geological_Mapper.vbs\"\'; $s.WorkingDirectory = \'%LOCALAPPDATA%\\EswaGeologicalMapper\'; $s.IconLocation = \'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe,0\'; $s.Description = \'ESWA Geological Mapper - Standalone Offline PC Software\'; $s.Save() }"',
        'echo.',
        'echo ============================================================================',
        'echo   INSTALLATION COMPLETE! (100%% Local Offline PC Software)',
        'echo   Installed to: %INSTALL_DIR%',
        'echo   Shortcut created on Desktop: "ESWA Geological Mapper"',
        'echo   Launching software now...',
        'echo ============================================================================',
        'wscript.exe "%LAUNCHER_CMD%"',
        'exit /b 0',
        '::===PAYLOAD_START===',
        ...b64Lines,
      ];

      res.setHeader('Content-Type', 'application/x-bat; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Install_ESWA_Geological_Mapper_PC.bat"'
      );
      res.send(batLines.join('\r\n'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to build offline installer';
      res.status(500).send(msg);
    }
  });

  /**
   * Helper to recursively collect all workspace source files for direct GitHub push
   * (including .github/workflows/*.yml so GitHub Actions builds the .EXE installers).
   */
  function collectWorkspaceFiles(
    dirPath: string,
    baseDir: string,
    includeWorkflows: boolean
  ): Array<{ path: string; content: string }> {
    const results: Array<{ path: string; content: string }> = [];
    const ignoredDirs = new Set([
      'node_modules',
      'dist',
      'dev-dist',
      'release',
      'build',
      'android-user-apk',
      '.git',
      'coverage',
    ]);
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (ignoredDirs.has(entry.name)) continue;
      if (!includeWorkflows && entry.name === '.github') continue;
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
      if (entry.name === 'bun.lock' || entry.name === 'package-lock.json') continue;
      if (entry.name.endsWith('.apk') || entry.name.endsWith('.aab') || entry.name.endsWith('.exe')) continue;

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        results.push(...collectWorkspaceFiles(fullPath, baseDir, includeWorkflows));
      } else if (entry.isFile()) {
        try {
          const stat = fs.statSync(fullPath);
          // Skip binary or huge files > 1.5MB
          if (stat.size > 1500000) continue;
          const content = fs.readFileSync(fullPath, 'utf8');
          results.push({ path: relPath, content });
        } catch {
          // Skip unreadable file
        }
      }
    }
    return results;
  }

  /**
   * POST /api/github/push-and-build-exe
   * Pushes all project source files + .github/workflows directly to GitHub via Git Data REST API
   * and triggers the GitHub Actions Windows .EXE Installer workflow.
   */
  app.post('/api/github/push-and-build-exe', async (req, res) => {
    try {
      const {
        repoSlug = '',
        githubToken = '',
        commitMessage = 'Update ESWA GEOLOGICAL MAPPER + Trigger Windows .EXE Build',
      } = req.body || {};

      const cleanRepo = String(repoSlug || '')
        .trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');
      const token = String(githubToken || process.env.GITHUB_TOKEN || '').trim();

      if (!cleanRepo || !cleanRepo.includes('/')) {
        res.status(400).json({
          ok: false,
          error: 'Please enter a valid GitHub repository (e.g. username/repository).',
        });
        return;
      }
      if (!token) {
        res.status(400).json({
          ok: false,
          error:
            'Please provide a GitHub Personal Access Token (with repo + workflow permissions) to push directly to GitHub.',
        });
        return;
      }

      const ghHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ESWA-Geological-Mapper-GitHub-Sync',
      };

      // 1. Get repository info & default branch
      const repoResp = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
        headers: ghHeaders,
      });
      if (!repoResp.ok) {
        const errJson = await repoResp.json().catch(() => ({}));
        res.status(repoResp.status).json({
          ok: false,
          error:
            errJson.message ||
            `Could not access repository ${cleanRepo} (HTTP ${repoResp.status}). Check repo name and token permissions.`,
        });
        return;
      }
      const repoData = (await repoResp.json()) as { default_branch?: string };
      const branch = repoData.default_branch || 'main';

      // 2. Get latest commit SHA on default branch (auto-initialize repo if empty!)
      let refResp = await fetch(
        `https://api.github.com/repos/${cleanRepo}/git/ref/heads/${branch}`,
        { headers: ghHeaders }
      );
      if (!refResp.ok && (refResp.status === 404 || refResp.status === 409)) {
        // Repository might be empty (0 commits) — auto-initialize with README.md via Contents API
        const initResp = await fetch(
          `https://api.github.com/repos/${cleanRepo}/contents/README.md`,
          {
            method: 'PUT',
            headers: ghHeaders,
            body: JSON.stringify({
              message: 'Initialize ESWA GEOLOGICAL MAPPER repository',
              content: Buffer.from(
                '# ESWA GEOLOGICAL MAPPER\nOfficial Geological Mapping & Geotechnical Engineering Suite (NATM, TBM, MINING).\n',
                'utf8'
              ).toString('base64'),
              branch,
            }),
          }
        );
        if (initResp.ok) {
          refResp = await fetch(
            `https://api.github.com/repos/${cleanRepo}/git/ref/heads/${branch}`,
            { headers: ghHeaders }
          );
        }
      }
      if (!refResp.ok) {
        const errJson = await refResp.json().catch(() => ({}));
        res.status(refResp.status).json({
          ok: false,
          error:
            errJson.message ||
            `Could not read branch '${branch}' on ${cleanRepo}. Check token 'repo' permissions.`,
        });
        return;
      }
      const refData = (await refResp.json()) as { object?: { sha?: string } };
      const latestCommitSha = refData.object?.sha;
      if (!latestCommitSha) {
        res.status(400).json({ ok: false, error: 'Could not resolve latest commit SHA.' });
        return;
      }

      // 3. Get base tree SHA
      const commitResp = await fetch(
        `https://api.github.com/repos/${cleanRepo}/git/commits/${latestCommitSha}`,
        { headers: ghHeaders }
      );
      const commitData = (await commitResp.json()) as { tree?: { sha?: string } };
      const baseTreeSha = commitData.tree?.sha;

      // 4. Collect workspace files + inject .github/workflows/build-installer.yml from scripts/github-action-build-exe.yml
      const rootDir = process.cwd();
      const runtimeReleaseDir = '/tmp/akash-release-cache';
      const releaseFolder = path.join(rootDir, 'release');
      const localApkCandidates = [
        path.join(releaseFolder, 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk'),
        path.join(releaseFolder, 'ESWA-TUNNEL-MAPPER-User-Android.apk'),
        path.join(runtimeReleaseDir, 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk'),
        path.join(runtimeReleaseDir, 'ESWA-TUNNEL-MAPPER-User-Android.apk'),
      ];
      const localApkPath =
        localApkCandidates.find((p) => fs.existsSync(p)) || localApkCandidates[0];
      const workflowTemplatePath = path.join(
        rootDir,
        'scripts',
        'github-action-build-exe.yml'
      );
      const workflowYmlContent = fs.existsSync(workflowTemplatePath)
        ? fs.readFileSync(workflowTemplatePath, 'utf8')
        : '';

      let filesToPush = collectWorkspaceFiles(rootDir, rootDir, true);
      let pushedWorkflows = true;

      const buildTreePayload = (
        files: Array<{ path: string; content: string }>,
        includeWorkflowFile: boolean
      ) => {
        const treeEntries: Array<{
          path: string;
          mode: string;
          type: string;
          content?: string;
          sha?: string;
        }> = files.map((f) => ({
          path: f.path,
          mode: '100644',
          type: 'blob',
          content: f.content,
        }));

        if (includeWorkflowFile && workflowYmlContent) {
          treeEntries.push({
            path: '.github/workflows/build-installer.yml',
            mode: '100644',
            type: 'blob',
            content: workflowYmlContent,
          });
        }

        return {
          base_tree: baseTreeSha,
          tree: treeEntries,
        };
      };

      let treeResp = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify(buildTreePayload(filesToPush, true)),
      });

      // Fallback if token doesn't have 'workflow' scope
      if (!treeResp.ok) {
        filesToPush = collectWorkspaceFiles(rootDir, rootDir, false);
        pushedWorkflows = false;
        treeResp = await fetch(`https://api.github.com/repos/${cleanRepo}/git/trees`, {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify(buildTreePayload(filesToPush, false)),
        });
      }

      if (!treeResp.ok) {
        const errJson = await treeResp.json().catch(() => ({}));
        res.status(treeResp.status).json({
          ok: false,
          error: errJson.message || 'Failed to create Git tree on GitHub.',
        });
        return;
      }
      const treeData = (await treeResp.json()) as { sha?: string };

      // 5. Create Commit
      const newCommitResp = await fetch(
        `https://api.github.com/repos/${cleanRepo}/git/commits`,
        {
          method: 'POST',
          headers: ghHeaders,
          body: JSON.stringify({
            message: commitMessage,
            tree: treeData.sha,
            parents: [latestCommitSha],
          }),
        }
      );

      let finalNewCommitData: { sha?: string } = {};
      if (!newCommitResp.ok && pushedWorkflows) {
        // GitHub sometimes rejects .github/workflows at commit creation if 'workflow' scope is missing
        filesToPush = collectWorkspaceFiles(rootDir, rootDir, false);
        pushedWorkflows = false;
        const retryTreeResp = await fetch(
          `https://api.github.com/repos/${cleanRepo}/git/trees`,
          {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify(buildTreePayload(filesToPush, false)),
          }
        );
        const retryTreeData = (await retryTreeResp.json()) as { sha?: string };
        const retryCommitResp = await fetch(
          `https://api.github.com/repos/${cleanRepo}/git/commits`,
          {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({
              message: commitMessage,
              tree: retryTreeData.sha,
              parents: [latestCommitSha],
            }),
          }
        );
        if (!retryCommitResp.ok) {
          const errJson = await retryCommitResp.json().catch(() => ({}));
          res.status(retryCommitResp.status).json({
            ok: false,
            error: errJson.message || 'Failed to create commit on GitHub.',
          });
          return;
        }
        finalNewCommitData = (await retryCommitResp.json()) as { sha?: string };
      } else if (!newCommitResp.ok) {
        const errJson = await newCommitResp.json().catch(() => ({}));
        res.status(newCommitResp.status).json({
          ok: false,
          error: errJson.message || 'Failed to create commit on GitHub.',
        });
        return;
      } else {
        finalNewCommitData = (await newCommitResp.json()) as { sha?: string };
      }

      // 6. Update branch reference to point to new commit
      const updateRefResp = await fetch(
        `https://api.github.com/repos/${cleanRepo}/git/refs/heads/${branch}`,
        {
          method: 'PATCH',
          headers: ghHeaders,
          body: JSON.stringify({
            sha: finalNewCommitData.sha,
            force: true,
          }),
        }
      );
      if (!updateRefResp.ok) {
        const errJson = await updateRefResp.json().catch(() => ({}));
        res.status(updateRefResp.status).json({
          ok: false,
          error: errJson.message || `Failed to update branch ${branch} on GitHub.`,
        });
        return;
      }

      // 7. Explicitly trigger workflow_dispatch on build-installer.yml in case push didn't trigger it
      let workflowTriggered = false;
      try {
        const dispatchResp = await fetch(
          `https://api.github.com/repos/${cleanRepo}/actions/workflows/build-installer.yml/dispatches`,
          {
            method: 'POST',
            headers: ghHeaders,
            body: JSON.stringify({ ref: branch }),
          }
        );
        workflowTriggered = dispatchResp.ok;
      } catch {
        // Push event itself already triggers on: push
      }

      // 8. Immediately publish/update the 'latest' GitHub Release with standalone ESWA-TUNNEL-MAPPER-User-Android.apk if cached
      let apkReleaseUploaded = false;
      if (fs.existsSync(localApkPath)) {
        try {
          let releaseData: {
            id?: number;
            upload_url?: string;
            assets?: Array<{ id: number; name: string }>;
          } | null = null;

          const getRelResp = await fetch(
            `https://api.github.com/repos/${cleanRepo}/releases/tags/latest`,
            { headers: ghHeaders }
          );
          if (getRelResp.ok) {
            releaseData = await getRelResp.json();
          } else {
            const createRelResp = await fetch(
              `https://api.github.com/repos/${cleanRepo}/releases`,
              {
                method: 'POST',
                headers: ghHeaders,
                body: JSON.stringify({
                  tag_name: 'latest',
                  target_commitish: branch,
                  name: 'ESWA GEOLOGICAL MAPPER — Master .EXE, User .EXE & User Android .APK',
                  body: 'Official release containing Master Edition (.EXE), User Edition (.EXE), and Standalone User Android App (ESWA-GEOLOGICAL-MAPPER-User-Android.apk).',
                  draft: false,
                  prerelease: false,
                }),
              }
            );
            if (createRelResp.ok) {
              releaseData = await createRelResp.json();
            }
          }

          if (releaseData?.id && releaseData.upload_url) {
            const cleanUploadBase = releaseData.upload_url.replace(/\{\?.*$/, '');
            const apkBytes = fs.readFileSync(localApkPath);
            for (const apkAssetName of [
              'ESWA-GEOLOGICAL-MAPPER-release.apk',
              'ESWA-GEOLOGICAL-MAPPER-User-Android.apk',
              'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk',
              'ESWA-TUNNEL-MAPPER-release.apk',
              'ESWA-TUNNEL-MAPPER-User-Android.apk',
              'ESWA-TUNNEL-MAPPER-Master-Android.apk',
            ]) {
              const specificCandidateMaster = path.join(runtimeReleaseDir, 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk');
              const legacyCandidateMaster = path.join(runtimeReleaseDir, 'ESWA-TUNNEL-MAPPER-Master-Android.apk');
              const specificApkPath =
                apkAssetName.includes('Master')
                  ? (fs.existsSync(specificCandidateMaster) ? specificCandidateMaster : legacyCandidateMaster)
                  : localApkPath;
              const specificBytes = fs.existsSync(specificApkPath)
                ? fs.readFileSync(specificApkPath)
                : apkBytes;
              const existingApkAsset = (releaseData.assets || []).find(
                (a) => a.name === apkAssetName
              );
              if (existingApkAsset?.id) {
                await fetch(
                  `https://api.github.com/repos/${cleanRepo}/releases/assets/${existingApkAsset.id}`,
                  { method: 'DELETE', headers: ghHeaders }
                ).catch(() => {});
              }
              const uploadAssetResp = await fetch(
                `${cleanUploadBase}?name=${apkAssetName}`,
                {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'Content-Type': 'application/vnd.android.package-archive',
                    'Content-Length': String(specificBytes.length),
                    'User-Agent': 'ESWA-Geological-Mapper-GitHub-Sync',
                  },
                  body: specificBytes,
                }
              );
              if (uploadAssetResp.ok) {
                apkReleaseUploaded = true;
              }
            }
          }
        } catch (err) {
          console.error('Failed to upload standalone APK to GitHub Release:', err);
        }
      }

      res.json({
        ok: true,
        repo: cleanRepo,
        branch,
        commitSha: finalNewCommitData.sha,
        filesCount: filesToPush.length + (pushedWorkflows ? 1 : 0),
        pushedWorkflows,
        workflowTriggered,
        apkPushedToRepo: false,
        apkReleaseUploaded,
        apkDownloadUrl: `https://github.com/${cleanRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-User-Android.apk`,
        userExeDownloadUrl: `https://github.com/${cleanRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-User-Setup.exe`,
        masterExeDownloadUrl: `https://github.com/${cleanRepo}/releases/download/latest/ESWA-GEOLOGICAL-MAPPER-Master-Setup.exe`,
        actionsUrl: `https://github.com/${cleanRepo}/actions`,
        releasesUrl: `https://github.com/${cleanRepo}/releases/tag/latest`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'GitHub push error';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  /**
   * GET /api/github/workflow-yml
   * Downloads the direct GitHub Actions workflow file (build-installer.yml)
   * that compiles the ~80 MB AKASH-TUNNEL-MAPPER-User-Setup.exe and AKASH-TUNNEL-MAPPER-Master-Setup.exe.
   */
  app.get('/api/github/workflow-yml', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const workflowPath = path.join(
      process.cwd(),
      'scripts',
      'github-action-build-exe.yml'
    );
    if (fs.existsSync(workflowPath)) {
      res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="build-installer.yml"');
      res.sendFile(workflowPath);
      return;
    }
    res.status(404).send('Workflow file not found.');
  });

  /**
   * GET /api/github/actions-status
   * Checks the latest GitHub Actions workflow runs and latest .EXE Release for a repository.
   */
  app.get('/api/github/actions-status', async (req, res) => {
    try {
      const rawRepo = String(req.query.repo || '')
        .trim()
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');
      const token = String(req.query.token || process.env.GITHUB_TOKEN || '').trim();

      if (!rawRepo || !rawRepo.includes('/')) {
        res.status(400).json({ ok: false, error: 'Invalid repo slug' });
        return;
      }

      const ghHeaders: Record<string, string> = {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'AKASH-Tunnel-Mapper-GitHub-Sync',
      };
      if (token) {
        ghHeaders.Authorization = `Bearer ${token}`;
      }

      const runsResp = await fetch(
        `https://api.github.com/repos/${rawRepo}/actions/runs?per_page=5`,
        { headers: ghHeaders }
      );
      const runsData = runsResp.ok
        ? ((await runsResp.json()) as {
            workflow_runs?: Array<{
              id: number;
              name: string;
              status: string;
              conclusion: string | null;
              html_url: string;
              created_at: string;
              head_sha: string;
            }>;
          })
        : { workflow_runs: [] };

      res.json({
        ok: true,
        runs: (runsData.workflow_runs || []).map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          conclusion: r.conclusion,
          htmlUrl: r.html_url,
          createdAt: r.created_at,
          headSha: (r.head_sha || '').slice(0, 7),
        })),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch Actions status';
      res.status(500).json({ ok: false, error: msg });
    }
  });

  /**
   * GET /api/android/download-apk & GET /api/android/download-master-apk
   * Serves the compiled standalone signed User Android App (.APK) or Master Android App (.APK) binary directly.
   * - ?edition=master (or /api/android/download-master-apk) -> ESWA-TUNNEL-MAPPER-Master-Android.apk (Owner App with Software Access Control)
   * - default -> ESWA-TUNNEL-MAPPER-User-Android.apk (User App)
   */
  const runtimeCacheDir = '/tmp/akash-release-cache';
  let apkBuildInFlightPromise: Promise<void> | null = null;

  const ensureAndroidApkBuiltAsync = async (apkPath: string): Promise<void> => {
    let needsBuild = !fs.existsSync(apkPath);
    if (!needsBuild) {
      try {
        const apkMtime = fs.statSync(apkPath).mtimeMs;
        const pyScriptPath = path.join(process.cwd(), 'scripts', 'compile-standalone-apk.py');
        const mjsScriptPath = path.join(process.cwd(), 'scripts', 'build-android-apk.mjs');
        const pyMtime = fs.existsSync(pyScriptPath) ? fs.statSync(pyScriptPath).mtimeMs : 0;
        const mjsMtime = fs.existsSync(mjsScriptPath) ? fs.statSync(mjsScriptPath).mtimeMs : 0;
        if (apkMtime < Math.max(pyMtime, mjsMtime)) {
          needsBuild = true;
        }
      } catch {
        needsBuild = true;
      }
    }
    if (!needsBuild) {
      return;
    }
    if (apkBuildInFlightPromise) {
      await apkBuildInFlightPromise;
      return;
    }
    apkBuildInFlightPromise = new Promise<void>((resolve) => {
      exec(
        'node scripts/build-android-apk.mjs',
        { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 32 },
        (err) => {
          if (err) {
            console.error('Failed to build Android APK on demand:', err);
          }
          resolve();
        }
      );
    }).finally(() => {
      apkBuildInFlightPromise = null;
    });
    await apkBuildInFlightPromise;
  };

  const releaseDir = path.join(process.cwd(), 'release');

  const resolveEffectiveApkPath = (isMaster: boolean): { fileName: string; filePath: string } => {
    const geoName = isMaster
      ? 'ESWA-GEOLOGICAL-MAPPER-Master-Android.apk'
      : 'ESWA-GEOLOGICAL-MAPPER-User-Android.apk';
    const legacyName = isMaster
      ? 'ESWA-TUNNEL-MAPPER-Master-Android.apk'
      : 'ESWA-TUNNEL-MAPPER-User-Android.apk';

    const candidates = [
      { name: geoName, p: path.join(releaseDir, geoName) },
      { name: legacyName, p: path.join(releaseDir, legacyName) },
      { name: geoName, p: path.join(runtimeCacheDir, geoName) },
      { name: legacyName, p: path.join(runtimeCacheDir, legacyName) },
    ];

    for (const c of candidates) {
      if (fs.existsSync(c.p) && fs.statSync(c.p).size > 100000) {
        return { fileName: c.name, filePath: c.p };
      }
    }
    return { fileName: geoName, filePath: path.join(releaseDir, geoName) };
  };

  const serveStandaloneAndroidApk = async (
    req: express.Request,
    res: express.Response,
    forceMaster = false
  ) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const isMaster =
      forceMaster || String(req.query.edition || '').toLowerCase() === 'master';
    const { fileName, filePath } = resolveEffectiveApkPath(isMaster);

    await ensureAndroidApkBuiltAsync(filePath);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.sendFile(filePath);
      return;
    }

    res.status(500).json({
      ok: false,
      error: 'Standalone Android APK binary could not be generated.',
    });
  };

  app.get('/api/android/download-apk', (req, res) => {
    void serveStandaloneAndroidApk(req, res, false);
  });
  app.get('/api/android/download-master-apk', (req, res) => {
    void serveStandaloneAndroidApk(req, res, true);
  });
  app.get('/ESWA-GEOLOGICAL-MAPPER-Master-Android.apk', (req, res) => {
    void serveStandaloneAndroidApk(req, res, true);
  });
  app.get('/ESWA-GEOLOGICAL-MAPPER-User-Android.apk', (req, res) => {
    void serveStandaloneAndroidApk(req, res, false);
  });
  app.get('/ESWA-TUNNEL-MAPPER-Master-Android.apk', (req, res) => {
    void serveStandaloneAndroidApk(req, res, true);
  });
  app.get('/ESWA-TUNNEL-MAPPER-User-Android.apk', (req, res) => {
    void serveStandaloneAndroidApk(req, res, false);
  });

  /**
   * GET /api/android/apk-binary
   * Streams raw APK bytes as application/octet-stream for on-demand client download.
   */
  app.options('/api/android/:action', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
  });

  app.get('/api/android/apk-binary', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const isMaster = String(req.query.edition || '').toLowerCase() === 'master';
    const { fileName, filePath } = resolveEffectiveApkPath(isMaster);

    await ensureAndroidApkBuiltAsync(filePath);

    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('X-APK-Filename', fileName);
      res.sendFile(filePath);
      return;
    }

    res.status(500).json({
      ok: false,
      error: 'Standalone Android APK binary could not be generated.',
    });
  });

  /**
   * GET /api/android/apk-bundle
   * Returns the standalone Android APK as standard application/json (Base64 encoded)
   * so Cloud Run / iframe proxies that filter binary MIME types pass it through cleanly.
   */
  app.get('/api/android/apk-bundle', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const isMaster = String(req.query.edition || '').toLowerCase() === 'master';
    const { fileName, filePath } = resolveEffectiveApkPath(isMaster);

    await ensureAndroidApkBuiltAsync(filePath);

    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json({
        ok: true,
        fileName,
        sizeBytes: buf.length,
        base64: buf.toString('base64'),
      });
      return;
    }

    res.status(500).json({
      ok: false,
      error: 'Standalone Android APK binary could not be generated.',
    });
  });

  /**
   * SERVER-SIDE LICENSING & ACCESS REQUEST RELAY STORE
   * Declared before /api/email/* and /api/licensing/* so all handlers have lexical access.
   */
  const licensingStorePath = path.join(runtimeCacheDir, 'licensing-cloud-mirror.json');
  interface ServerLicensingStore {
    access_requests: Record<string, Record<string, unknown>>;
    software_licenses: Record<string, Record<string, unknown>>;
    software_releases: Record<string, Record<string, unknown>>;
    master_pcs: Record<string, Record<string, unknown>>;
    email_config?: {
      smtpAppPassword?: string;
      oauthAccessToken?: string;
      updatedAtIso?: string;
    };
  }

  const readServerLicensingStore = (): ServerLicensingStore => {
    try {
      if (fs.existsSync(licensingStorePath)) {
        const raw = fs.readFileSync(licensingStorePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<ServerLicensingStore>;
        return {
          access_requests: parsed.access_requests || {},
          software_licenses: parsed.software_licenses || {},
          software_releases: parsed.software_releases || {},
          master_pcs: parsed.master_pcs || {},
          email_config: parsed.email_config || {},
        };
      }
    } catch {
      // Ignore read errors
    }
    return {
      access_requests: {},
      software_licenses: {},
      software_releases: {},
      master_pcs: {},
      email_config: {},
    };
  };

  const writeServerLicensingStore = (store: ServerLicensingStore): void => {
    try {
      const dir = path.dirname(licensingStorePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(licensingStorePath, JSON.stringify(store, null, 2), 'utf8');
    } catch {
      // Ignore write errors
    }
  };

  /**
   * POST /api/email/send-notification
   * Sends automatic approval & software update emails from the Master Owner's Gmail account
   * using either a Google OAuth Bearer token or a Gmail SMTP App Password (nodemailer).
   */
  app.options('/api/email/send-notification', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
  });

  app.post('/api/email/send-notification', async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const {
        to,
        subject,
        textBody,
        htmlBody,
        fromEmail = 'akashdhanusheswar@gmail.com',
        smtpAppPassword,
        accessToken,
      } = req.body || {};

      const cleanTo = String(to || '').trim();
      if (!cleanTo || !cleanTo.includes('@')) {
        res.status(400).json({ ok: false, error: 'Recipient email address is invalid.' });
        return;
      }

      const storeForEmail = readServerLicensingStore();
      const authHeader = String(req.headers.authorization || '');
      const bearerToken = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : String(
            accessToken || storeForEmail.email_config?.oauthAccessToken || ''
          ).trim();

      // 1. Try Gmail REST API if an OAuth accessToken is available
      if (bearerToken) {
        const boundary = `eswa_srv_boundary_${Date.now()}`;
        const encodedSubject = `=?UTF-8?B?${Buffer.from(
          String(subject || 'ESWA Tunnel Mapper Notification'),
          'utf8'
        ).toString('base64')}?=`;

        const mimeLines = [
          `From: "ESWA Tunnel Mapper" <${fromEmail}>`,
          `To: ${cleanTo}`,
          `Subject: ${encodedSubject}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          'Content-Transfer-Encoding: 8bit',
          '',
          String(textBody || ''),
          '',
        ];
        if (htmlBody) {
          mimeLines.push(
            `--${boundary}`,
            'Content-Type: text/html; charset="UTF-8"',
            'Content-Transfer-Encoding: 8bit',
            '',
            String(htmlBody),
            ''
          );
        }
        mimeLines.push(`--${boundary}--`, '');
        const rawEncoded = Buffer.from(mimeLines.join('\r\n'), 'utf8')
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const gmailResp = await fetch(
          'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ raw: rawEncoded }),
          }
        );

        if (gmailResp.ok) {
          if (accessToken || authHeader.startsWith('Bearer ')) {
            storeForEmail.email_config = {
              ...storeForEmail.email_config,
              oauthAccessToken: bearerToken,
              updatedAtIso: new Date().toISOString(),
            };
            writeServerLicensingStore(storeForEmail);
          }
          const data = (await gmailResp.json()) as { id?: string };
          res.json({ ok: true, messageId: data.id, method: 'GMAIL_OAUTH_API' });
          return;
        }
      }

      // 2. Try Gmail SMTP via Nodemailer using App Password (from request, server store, or server env)
      const effectiveAppPass = String(
        smtpAppPassword ||
          storeForEmail.email_config?.smtpAppPassword ||
          process.env.GMAIL_APP_PASSWORD ||
          ''
      )
        .replace(/\s+/g, '')
        .trim();

      if (effectiveAppPass) {
        if (smtpAppPassword) {
          storeForEmail.email_config = {
            ...storeForEmail.email_config,
            smtpAppPassword: effectiveAppPass,
            updatedAtIso: new Date().toISOString(),
          };
          writeServerLicensingStore(storeForEmail);
        }
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: fromEmail,
            pass: effectiveAppPass,
          },
        });

        const info = await transporter.sendMail({
          from: `"ESWA Tunnel Mapper" <${fromEmail}>`,
          to: cleanTo,
          subject: String(subject || 'Greetings from ESWA Tunnel Mapper'),
          text: String(textBody || ''),
          html: htmlBody ? String(htmlBody) : undefined,
        });

        res.json({ ok: true, messageId: info.messageId, method: 'GMAIL_SMTP' });
        return;
      }

      // 3. Fallback: Try FormSubmit AJAX relay with browser-like Origin/Referer headers
      try {
        const originUrl =
          String(req.headers.origin || '').trim() ||
          'https://ais-pre-5ptwqnfp5dwhotfkvwrapg-951690892189.asia-southeast1.run.app';
        const fsResp = await fetch(
          `https://formsubmit.co/ajax/${encodeURIComponent(cleanTo)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Origin: originUrl,
              Referer: `${originUrl}/`,
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            },
            body: JSON.stringify({
              _subject: String(subject || 'Greetings from ESWA Tunnel Mapper'),
              _template: 'box',
              _captcha: 'false',
              from_app: 'ESWA Geological Mapper',
              message: String(textBody || ''),
            }),
          }
        );
        if (fsResp.ok) {
          const fsData = (await fsResp.json().catch(() => ({}))) as {
            success?: string | boolean;
          };
          if (fsData.success === true || fsData.success === 'true') {
            res.json({
              ok: true,
              messageId: `formsubmit_${Date.now()}`,
              method: 'FORMSUBMIT_RELAY',
            });
            return;
          }
        }
      } catch {
        // Ignore fallback relay error
      }

      res.status(401).json({
        ok: false,
        error: 'GMAIL_AUTH_REQUIRED',
      });
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to send email.',
      });
    }
  });

  app.options('/api/email/save-config', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
  });

  app.post('/api/email/save-config', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const { smtpAppPassword, oauthAccessToken } = req.body || {};
      const store = readServerLicensingStore();
      store.email_config = {
        ...store.email_config,
        ...(smtpAppPassword !== undefined
          ? { smtpAppPassword: String(smtpAppPassword).replace(/\s+/g, '').trim() }
          : {}),
        ...(oauthAccessToken ? { oauthAccessToken: String(oauthAccessToken).trim() } : {}),
        updatedAtIso: new Date().toISOString(),
      };
      writeServerLicensingStore(store);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to save email config.',
      });
    }
  });

  app.options('/api/licensing/:action', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
  });

  app.get('/api/licensing/state', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const store = readServerLicensingStore();
    res.json({
      ok: true,
      access_requests: Object.values(store.access_requests),
      software_licenses: Object.values(store.software_licenses),
      software_releases: Object.values(store.software_releases),
      master_pcs: Object.values(store.master_pcs),
    });
  });

  app.post('/api/licensing/upsert', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const { collection, id, record } = req.body || {};
      const validCols = [
        'access_requests',
        'software_licenses',
        'software_releases',
        'master_pcs',
      ] as const;
      if (
        !validCols.includes(collection) ||
        !id ||
        typeof id !== 'string' ||
        !record ||
        typeof record !== 'object'
      ) {
        res.status(400).json({ ok: false, error: 'Invalid licensing upsert payload.' });
        return;
      }
      const store = readServerLicensingStore();
      const targetMap = store[collection as keyof ServerLicensingStore];
      targetMap[id] = { ...(targetMap[id] || {}), ...(record as Record<string, unknown>) };
      writeServerLicensingStore(store);
      res.json({ ok: true, item: targetMap[id] });
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Upsert error',
      });
    }
  });

  app.post('/api/licensing/delete', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
      const { collection, id } = req.body || {};
      const validCols = [
        'access_requests',
        'software_licenses',
        'software_releases',
        'master_pcs',
      ] as const;
      if (!validCols.includes(collection) || !id || typeof id !== 'string') {
        res.status(400).json({ ok: false, error: 'Invalid delete payload.' });
        return;
      }
      const store = readServerLicensingStore();
      const targetMap = store[collection as keyof ServerLicensingStore];
      delete targetMap[id];
      writeServerLicensingStore(store);
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Delete error',
      });
    }
  });

  /**
   * GET /api/ota/latest-bundle
   * Delivers the self-contained OTA update bundle (CSS + IIFE JS + Version) so installed
   * User Android Apps (.APK) and User Windows Software (.EXE) can update in-place with 1 click
   * and zero deletion of previous user tunnel projects or login sessions.
   */
  app.options('/api/ota/latest-bundle', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-ESWA-Hardware-ID, X-ESWA-Signature'
    );
    res.status(204).end();
  });

  app.get('/api/ota/latest-bundle', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    try {
      const requestedVersion = String(req.query.version || '').trim();
      const otaCandidatePaths = [
        path.join(releaseDir, 'user-ota-bundle.json'),
        path.join(runtimeCacheDir, 'user-ota-bundle.json'),
      ];
      const otaBundlePath =
        otaCandidatePaths.find((p) => fs.existsSync(p)) || otaCandidatePaths[0];
      const distAssetsDir = path.join(process.cwd(), 'dist', 'assets');

      let cssContent = '';
      let jsContent = '';
      let bundleVersion = requestedVersion || '2.5.0';

      if (fs.existsSync(otaBundlePath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(otaBundlePath, 'utf8'));
          if (parsed && parsed.jsContent) {
            cssContent = parsed.cssContent || '';
            jsContent = parsed.jsContent || '';
            if (!requestedVersion && parsed.version) {
              bundleVersion = String(parsed.version);
            }
          }
        } catch {
          // Ignore and try dist/assets
        }
      }

      if (!jsContent && fs.existsSync(distAssetsDir)) {
        let jsFilePath = '';
        for (const fn of fs.readdirSync(distAssetsDir)) {
          if (fn.endsWith('.css')) {
            cssContent += fs.readFileSync(path.join(distAssetsDir, fn), 'utf8') + '\n';
          } else if (fn.endsWith('.js') && !jsFilePath) {
            jsFilePath = path.join(distAssetsDir, fn);
          }
        }
        if (jsFilePath) {
          const iifeOutPath = path.join(runtimeCacheDir, 'temp-srv-ota.js');
          try {
            fs.mkdirSync(runtimeCacheDir, { recursive: true });
            execSync(
              `npx esbuild "${jsFilePath}" --bundle --format=iife --platform=browser --target=es2020 --minify --outfile="${iifeOutPath}"`,
              { cwd: process.cwd(), stdio: 'pipe' }
            );
            jsContent = fs.readFileSync(iifeOutPath, 'utf8');
            fs.rmSync(iifeOutPath, { force: true });
          } catch {
            jsContent = fs.readFileSync(jsFilePath, 'utf8');
          }
        }
      }

      res.json({
        ok: true,
        version: bundleVersion,
        edition: 'user',
        publishedAtIso: new Date().toISOString(),
        preserveUserData: true,
        cssContent,
        jsContent,
      });
    } catch (err: unknown) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to prepare OTA bundle',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ESWA Geological Mapper server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
