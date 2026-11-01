import {loadFont as loadDMSans} from '@remotion/google-fonts/DMSans';
import {loadFont as loadIBMPlexMono} from '@remotion/google-fonts/IBMPlexMono';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// The font loader waits for these exact weights before allowing rendering.
// El nombre va en DM Sans: la «j» de Fraunces era demasiado decorativa.
const {fontFamily: displayFont} = loadDMSans('normal', {
  weights: ['500'],
  subsets: ['latin'],
});
const {fontFamily: monoFont} = loadIBMPlexMono('normal', {
  weights: ['400'],
  subsets: ['latin'],
});

const PALETTE = {
  fondo: '#FFFFFF',
  tinta: '#1E2A24',
  verde: '#14964B',
  brote: '#8CC63D',
  agua: '#0E92C8',
  cielo: '#72CDEA',
  morado: '#66348E',
  sol: '#F37225',
  maiz: '#F7AD2D',
} as const;

const LETTER_COLORS = [
  PALETTE.verde,
  PALETTE.agua,
  PALETTE.morado,
  PALETTE.sol,
  PALETTE.maiz,
];
const RADIUS = 380;
const RING = Array.from('#YOUTHINTOACTION · '.repeat(4));
const ENTRY_EASING = Easing.bezier(0.23, 1, 0.32, 1);
const MOVE_EASING = Easing.bezier(0.77, 0, 0.175, 1);
const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;
const ENTRY = {...CLAMP, easing: ENTRY_EASING};

const BLOBS = [
  {color: PALETTE.cielo, x: 0.14, y: 0.25, size: 480, dx: 32, dy: 20},
  {color: PALETTE.brote, x: 0.84, y: 0.48, size: 440, dx: -28, dy: 26},
  {color: PALETTE.morado, x: 0.38, y: 0.87, size: 420, dx: 24, dy: -20},
];

const Background = () => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();

  return (
    <AbsoluteFill aria-hidden style={{pointerEvents: 'none'}}>
      {BLOBS.map((blob) => (
        <div
          key={blob.color}
          style={{
            position: 'absolute',
            left: width * blob.x - blob.size / 2,
            top: height * blob.y - blob.size / 2,
            width: blob.size,
            height: blob.size,
            borderRadius: '50%',
            backgroundColor: blob.color,
            opacity: 0.25,
            filter: 'blur(100px)',
            translate: interpolate(
              frame,
              [0, durationInFrames - 1],
              ['0px 0px', `${blob.dx}px ${blob.dy}px`],
              CLAMP,
            ),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const LetterRing = ({fontSize = 34}: {fontSize?: number}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const letterDuration = 0.3 * fps;
  // The last letter finishes at 2.5 s, including its individual entrance.
  const lastLetterStart = 2.5 * fps - letterDuration;
  let colorIndex = 0;

  return (
    <AbsoluteFill
      aria-label={'#YOUTHINTOACTION · '.repeat(4).trim()}
      style={{
        rotate: interpolate(frame, [0, durationInFrames - 1], ['0deg', '20deg'], CLAMP),
      }}
    >
      {RING.map((letter, index) => {
        const angle = (index / RING.length) * Math.PI * 2 - Math.PI / 2;
        const start = interpolate(index, [0, RING.length - 1], [0.3 * fps, lastLetterStart]);
        const color = LETTER_COLORS[colorIndex % LETTER_COLORS.length];
        if (letter !== ' ') colorIndex += 1;

        return (
          <div
            key={index}
            aria-hidden
            style={{
              position: 'absolute',
              left: 540 + Math.cos(angle) * RADIUS,
              top: 540 + Math.sin(angle) * RADIUS,
              width: 42,
              height: 48,
              marginLeft: -21,
              marginTop: -24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              rotate: `${(angle * 180) / Math.PI + 90}deg`,
              fontFamily: monoFont,
              fontSize,
              fontWeight: fontSize > 34 ? 500 : 400,
              lineHeight: 1,
              whiteSpace: 'pre',
              color,
              opacity: interpolate(frame, [start, start + letterDuration], [0, 1], ENTRY),
              filter: `blur(${interpolate(frame, [start, start + letterDuration], [6, 0], ENTRY)}px)`,
            }}
          >
            {letter}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// soloAnillo: versión para la web, sin el nombre (va como texto HTML en la página) y sin achicarse.
export const Anillo = ({soloAnillo = false}: {soloAnillo?: boolean}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const vertical = height > width;
  const moveRange = [3.2 * fps, 4.6 * fps];
  const emblemEntrance = spring({
    frame: frame - 1.6 * fps,
    fps,
    durationInFrames: 1.6 * fps,
    config: {damping: 200, stiffness: 100, mass: 1, overshootClamping: true},
  });

  return (
    <AbsoluteFill
      style={{backgroundColor: PALETTE.fondo, color: PALETTE.tinta, overflow: 'hidden'}}
    >
      <Background />
      {/* One parent moves and scales the whole lockup; only the ring rotates. */}
      <div
        style={{
          position: 'absolute',
          width: 1080,
          height: 1080,
          left: (width - 1080) / 2,
          top: (height - 1080) / 2,
          transformOrigin: 'center center',
          // `transform` en vez de las propiedades sueltas `scale`/`translate`,
          // que el render ignoraba y dejaban el anillo encima del texto.
          transform: soloAnillo ? undefined : `translateY(${interpolate(frame, moveRange, [0, vertical ? -160 : -110], {
            ...CLAMP,
            easing: MOVE_EASING,
          })}px) scale(${interpolate(frame, moveRange, [1, vertical ? 0.8 : 0.66], {
            ...CLAMP,
            easing: MOVE_EASING,
          })})`,
        }}
      >
        <LetterRing fontSize={soloAnillo ? 44 : 34} />
        <div
          style={{
            position: 'absolute',
            left: 280,
            top: 280,
            width: 520,
            height: 520,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            scale: interpolate(emblemEntrance, [0, 1], [0.92, 1], CLAMP),
            opacity: interpolate(frame, [1.6 * fps, 3.2 * fps], [0, 1], ENTRY),
            filter: `blur(${interpolate(frame, [1.6 * fps, 3.2 * fps], [12, 0], ENTRY)}px)`,
          }}
        >
          <Img
            src={staticFile('logo-emblema.png')}
            alt="Emblema de Kaaijayu, GYBN Bolivia"
            style={{width: 520, height: 520, objectFit: 'contain'}}
          />
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          top: vertical ? 1280 : 766,
          textAlign: 'center',
          display: soloAnillo ? 'none' : undefined,
          fontFamily: displayFont,
          fontWeight: 500,
          fontSize: 60,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          opacity: interpolate(frame, [3.2 * fps, 4.3 * fps], [0, 1], ENTRY),
          translate: interpolate(frame, [3.2 * fps, 4.3 * fps], ['0px 16px', '0px 0px'], ENTRY),
        }}
      >
        Kaaijayu · GYBN Bolivia
      </div>
      <div
        style={{
          position: 'absolute',
          left: 80,
          right: 80,
          top: vertical ? 1392 : 878,
          textAlign: 'center',
          display: soloAnillo ? 'none' : undefined,
          fontFamily: monoFont,
          fontWeight: 400,
          fontSize: 22,
          lineHeight: 1.4,
          letterSpacing: '0.12em',
          whiteSpace: 'nowrap',
          color: PALETTE.morado,
          opacity: interpolate(frame, [3.4 * fps, 4.6 * fps], [0, 1], ENTRY),
          translate: interpolate(frame, [3.4 * fps, 4.6 * fps], ['0px 16px', '0px 0px'], ENTRY),
        }}
      >
        CAPÍTULO BOLIVIANO DE GYBN · DESDE 2019
      </div>
    </AbsoluteFill>
  );
};
