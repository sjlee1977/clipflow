import { Composition } from 'remotion';
import { VideoComposition, VideoSchema, TRANSITION_FRAMES } from './VideoComposition';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 유튜브 쇼츠 (세로형 9:16) */}
      <Composition
        id="ClipFlowShorts"
        component={VideoComposition}
        durationInFrames={900}
        fps={30}
        width={1080}
        height={1920}
        schema={VideoSchema}
        defaultProps={{
          scenes: [],
          fps: 30,
        }}
        calculateMetadata={({ props }) => {
          const totalFrames = props.scenes.reduce((sum, s) => sum + s.durationInFrames, 0);
          const overlap = Math.max(0, props.scenes.length - 1) * TRANSITION_FRAMES;
          const finalFrames = Math.max(0, totalFrames - overlap);
          return {
            durationInFrames: finalFrames > 0 ? finalFrames : 900,
          };
        }}
      />

      {/* 유튜브 롱폼 (가로형 16:9) */}
      <Composition
        id="ClipFlowLandscape"
        component={VideoComposition}
        durationInFrames={18000}
        fps={30}
        width={1920}
        height={1080}
        schema={VideoSchema}
        defaultProps={{
          scenes: [],
          fps: 30,
        }}
        calculateMetadata={({ props }) => {
          const totalFrames = props.scenes.reduce(
            (sum, s) => sum + s.durationInFrames,
            0
          );
          return {
            durationInFrames: totalFrames > 0 ? totalFrames : 18000,
          };
        }}
      />
    </>
  );
};
