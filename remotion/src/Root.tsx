import { Composition } from 'remotion';
import { Reel, reelSchemaDefaults } from './Reel';

export const Root: React.FC = () => (
  <Composition
    id="Reel"
    component={Reel}
    durationInFrames={90}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={reelSchemaDefaults}
  />
);
