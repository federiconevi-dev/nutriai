import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont as loadAnton } from '@remotion/google-fonts/Anton';
import { loadFont as loadSerif } from '@remotion/google-fonts/InstrumentSerif';

const { fontFamily: anton } = loadAnton('normal', { weights: ['400'], subsets: ['latin', 'latin-ext'] });
const { fontFamily: serif } = loadSerif('italic', { weights: ['400'], subsets: ['latin', 'latin-ext'] });

export const reelSchemaDefaults = { big: '16 AÑOS', small: 'guardá este video', accent: '#FFE14D' };
type Props = typeof reelSchemaDefaults;

// Starter composition: giant word that slams in + smaller italic serif crossing it.
export const Reel: React.FC<Props> = ({ big, small, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame, fps, config: { damping: 12, mass: 0.6 } });
  const wipe = interpolate(frame, [12, 30], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #2a1650, #07070b 70%)', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'relative', textAlign: 'center' }}>
        <div style={{ fontFamily: anton, fontSize: 300, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap', transform: `scale(${1.7 - 0.7 * slam})`, filter: `blur(${(1 - slam) * 14}px)` }}>
          {big}
        </div>
        <div style={{ position: 'absolute', left: '55%', top: '72%', transform: 'translate(-50%, -50%) rotate(-4deg)', fontFamily: serif, fontStyle: 'italic', fontSize: 130, color: accent, whiteSpace: 'nowrap', clipPath: `inset(0 ${100 - wipe}% 0 0)`, textShadow: '0 4px 18px rgba(0,0,0,.45)' }}>
          {small}
        </div>
      </div>
    </AbsoluteFill>
  );
};
