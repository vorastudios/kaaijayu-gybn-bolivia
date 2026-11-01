import {Composition} from 'remotion';
import {Anillo} from './Anillo';

export const RemotionRoot = () => (
  <>
    <Composition
      id="Anillo"
      component={Anillo}
      width={1080}
      height={1080}
      fps={30}
      durationInFrames={180}
    />
    <Composition
      id="AnilloVertical"
      component={Anillo}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={180}
    />
    <Composition
      id="AnilloWeb"
      component={Anillo}
      defaultProps={{soloAnillo: true}}
      width={1080}
      height={1080}
      fps={30}
      durationInFrames={180}
    />
  </>
);
