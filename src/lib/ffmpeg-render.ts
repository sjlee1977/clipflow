/**
 * FFmpeg 영상 합성
 * 이미지 + 오디오 + 자막 → Ken Burns 효과 → 최종 MP4
 */
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createWriteStream, promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

export type RenderScene = {
  imageUrl: string;   // S3 이미지 URL
  audioUrl: string;   // MiniMax TTS URL
  text: string;       // 자막 텍스트
  durationMs: number; // 오디오 길이 (ms)
  aspectRatio?: '9:16' | '16:9';
};

/** URL에서 파일 다운로드 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: ${url}`);
  const fileStream = createWriteStream(destPath);
  await pipeline(Readable.fromWeb(res.body as any), fileStream);
}

/** SRT 자막 파일 생성 */
function buildSrt(scenes: RenderScene[]): string {
  let srt = '';
  let time = 0;
  scenes.forEach((scene, i) => {
    const start = msToSrt(time);
    const end = msToSrt(time + scene.durationMs);
    srt += `${i + 1}\n${start} --> ${end}\n${scene.text}\n\n`;
    time += scene.durationMs;
  });
  return srt;
}

function msToSrt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mil = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(mil).padStart(3, '0')}`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

/** Ken Burns 효과 변형 패턴 (장면별 다양화) */
function getKenBurnsFilter(sceneIndex: number, w: number, h: number, durationSec: number): string {
  const fps = 25;
  const d = Math.ceil(fps * durationSec);
  const patterns = [
    // 줌인 (중앙)
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`,
    // 줌아웃 (중앙)
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='if(lte(zoom,1.0),1.5,max(1.0,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`,
    // 줌인 + 왼쪽으로 패닝
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.001,1.4)':x='0':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`,
    // 줌인 + 오른쪽으로 패닝
    `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},zoompan=z='min(zoom+0.001,1.4)':x='iw-iw/zoom':y='ih/2-(ih/zoom/2)':d=${d}:s=${w}x${h}:fps=${fps}`,
  ];
  return patterns[sceneIndex % patterns.length] + ',format=yuv420p';
}

/** 단일 장면: 이미지 + Ken Burns 효과 + 오디오 → MP4 */
function renderSceneFromImage(
  imagePath: string,
  audioPath: string,
  outputPath: string,
  durationSec: number,
  sceneIndex: number,
  aspectRatio: '9:16' | '16:9' = '9:16',
): Promise<void> {
  const [w, h] = aspectRatio === '16:9' ? [1920, 1080] : [1080, 1920];
  const vf = getKenBurnsFilter(sceneIndex, w, h, durationSec);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .input(audioPath)
      .outputOptions([
        `-vf ${vf}`,
        `-t ${durationSec}`,
        '-c:v libx264',
        '-c:a aac',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-shortest',
      ])
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', reject)
      .run();
  });
}

/** 여러 장면 MP4를 하나로 이어붙이기 + 자막 */
function concatAndSubtitle(
  scenePaths: string[],
  srtPath: string,
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    scenePaths.forEach(p => cmd.input(p));

    const srt = srtPath.replace(/\\/g, '/');
    const subFilter = `subtitles='${srt}':force_style='FontName=Arial,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2'`;
    const concatFilter = `${scenePaths.map((_, i) => `[${i}:v][${i}:a]`).join('')}concat=n=${scenePaths.length}:v=1:a=1[cv][outa];[cv]${subFilter}[outv]`;

    cmd
      .on('end', () => resolve())
      .on('error', reject)
      .outputOptions([
        `-filter_complex`, concatFilter,
        '-map', '[outv]',
        '-map', '[outa]',
        '-c:v libx264',
        '-c:a aac',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
      ])
      .output(outputPath)
      .run();
  });
}

/** 전체 파이프라인: 장면들 → 최종 MP4 → S3 URL */
export async function renderVideo(scenes: RenderScene[], userId?: string): Promise<string> {
  const tmp = tmpdir();
  const jobId = `cf-${Date.now()}`;
  const aspectRatio = scenes[0]?.aspectRatio ?? '9:16';
  const sceneOutputs: string[] = [];

  try {
    // 1. 각 장면 이미지 + 오디오 다운로드 → Ken Burns 영상 생성 (순차 처리 - FFmpeg CPU 부하)
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const imagePath = join(tmp, `${jobId}-img${i}.jpg`);
      const audioPath = join(tmp, `${jobId}-a${i}.mp3`);
      const scenePath = join(tmp, `${jobId}-s${i}.mp4`);

      await Promise.all([
        downloadFile(scene.imageUrl, imagePath),
        downloadFile(scene.audioUrl, audioPath),
      ]);

      await renderSceneFromImage(imagePath, audioPath, scenePath, scene.durationMs / 1000, i, aspectRatio);
      sceneOutputs.push(scenePath);
    }

    // 2. SRT 자막 파일 생성
    const srtPath = join(tmp, `${jobId}.srt`);
    await fs.writeFile(srtPath, buildSrt(scenes), 'utf-8');

    // 3. 장면 이어붙이기 + 자막
    const finalPath = join(tmp, `${jobId}-final.mp4`);
    await concatAndSubtitle(sceneOutputs, srtPath, finalPath);

    // 4. S3 업로드
    const key = userId ? `users/${userId}/videos/${jobId}.mp4` : `videos/${jobId}.mp4`;
    const videoBuffer = await fs.readFile(finalPath);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: videoBuffer,
      ContentType: 'video/mp4',
      ACL: 'public-read',
    }));

    return `https://${BUCKET}.s3.${process.env.AWS_REGION ?? 'ap-northeast-2'}.amazonaws.com/${key}`;
  } finally {
    // 5. 임시 파일 정리
    const files = [
      ...scenes.flatMap((_, i) => [
        join(tmp, `${jobId}-img${i}.jpg`),
        join(tmp, `${jobId}-a${i}.mp3`),
        join(tmp, `${jobId}-s${i}.mp4`),
      ]),
      join(tmp, `${jobId}.srt`),
      join(tmp, `${jobId}-final.mp4`),
    ];
    await Promise.all(files.map(f => fs.rm(f, { force: true })));
  }
}
