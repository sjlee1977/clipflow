import {Composition} from 'remotion';

export const MyComposition: React.FC = () => {
  return (
    <div style={{flex: 1, backgroundColor: '#000'}} />
  );
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="ClipFlow"
      component={MyComposition}
      durationInFrames={150}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
