import {
  renderMediaOnLambda,
  getRenderProgress,
  speculateFunctionName,
} from '@remotion/lambda/client';

const REGION = (process.env.AWS_REGION ?? 'ap-northeast-2') as Parameters<typeof renderMediaOnLambda>[0]['region'];
const SERVE_URL = process.env.REMOTION_SERVE_URL ?? 'https://remotionlambda-apnortheast2-17lxfxukvf.s3.ap-northeast-2.amazonaws.com/sites/clipflow/index.html';
const FUNCTION_NAME = process.env.REMOTION_FUNCTION_NAME || speculateFunctionName({ memorySizeInMb: 3008, diskSizeInMb: 2048, timeoutInSeconds: 900 });

export type RenderInput = {
  compositionId: string;
  inputProps: Record<string, unknown>;
};

/**
 * Lambda에 렌더링을 요청합니다.
 */
export async function startRender({ compositionId, inputProps }: RenderInput) {
  const { renderId, bucketName } = await renderMediaOnLambda({
    region: REGION,
    functionName: FUNCTION_NAME,
    serveUrl: SERVE_URL,
    composition: compositionId,
    inputProps,
    codec: 'h264',
    outName: `${compositionId}-${Date.now()}.mp4`,
    concurrencyPerLambda: 2,
    framesPerLambda: 30,
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
  });

  return {
    done: progress.done,
    overallProgress: progress.overallProgress,
    outputFile: progress.outputFile,
    fatalErrorEncountered: progress.fatalErrorEncountered,
    errors: progress.errors,
  };
}
