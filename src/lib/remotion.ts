import {
  renderMediaOnLambda,
  getRenderProgress,
  speculateFunctionName,
} from '@remotion/lambda/client';

const REGION = (process.env.AWS_REGION ?? 'ap-northeast-2') as Parameters<typeof renderMediaOnLambda>[0]['region'];
const SERVE_URL = process.env.REMOTION_SERVE_URL ?? 'https://remotionlambda-apnortheast2-17lxfxukvf.s3.ap-northeast-2.amazonaws.com/sites/clipflow/index.html';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME || speculateFunctionName({ memorySizeInMb: 2048, diskSizeInMb: 2048, timeoutInSeconds: 300 });

const ASSETS_BUCKET = process.env.S3_BUCKET || 'remotionlambda-apnortheast2-17lxfxukvf';

const credentials = {
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

export type RenderInput = {
  compositionId: string;
  inputProps: Record<string, unknown>;
  framesPerLambda?: number;
};

/**
 * Lambda에 렌더링을 요청합니다.
 */
const MAX_LAMBDA_FUNCTIONS = 180; // 200 한도에서 안전 마진 확보
const MIN_FRAMES_PER_LAMBDA = 50;

export async function startRender({ compositionId, inputProps, framesPerLambda: overrideFramesPerLambda }: RenderInput) {
  const framesPerLambda = overrideFramesPerLambda ?? MIN_FRAMES_PER_LAMBDA;

  const { renderId, bucketName } = await renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SERVE_URL,
    composition: compositionId,
    inputProps,
    codec: 'h264',
    outName: `${compositionId}-${Date.now()}.mp4`,
    concurrencyPerLambda: 2,
    framesPerLambda,
    ...credentials,
  });

  return { renderId, bucketName };
}

/**
 * 렌더링 진행 상태를 폴링합니다.
 */
export async function waitForRender(renderId: string, bucketName: string): Promise<string> {
  while (true) {
    const progress = await getRenderProgress({
      renderId,
      bucketName,
      functionName: FUNCTION_NAME,
      region: REGION,
      ...credentials,
    });

    if (progress.done) {
      if (!progress.outputFile) throw new Error('렌더링 완료됐지만 출력 파일이 없습니다');
      return progress.outputFile;
    }

    if (progress.fatalErrorEncountered) {
      throw new Error(progress.errors.map((e) => e.message).join(', '));
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

/**
 * 렌더링 상태를 한 번 확인합니다. (비동기 폴링용)
 */
export async function getRenderStatus(renderId: string, bucketName: string) {
  const progress = await getRenderProgress({
    renderId,
    bucketName,
    functionName: FUNCTION_NAME,
    region: REGION,
    ...credentials,
  });

  return {
    done: progress.done,
    overallProgress: progress.overallProgress,
    outputFile: progress.outputFile,
    fatalErrorEncountered: progress.fatalErrorEncountered,
    errors: progress.errors,
  };
}
