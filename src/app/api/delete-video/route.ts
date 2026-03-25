import { NextRequest, NextResponse } from 'next/server';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function urlToKey(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('.amazonaws.com')) {
      return decodeURIComponent(u.pathname.slice(1));
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id가 필요합니다' }, { status: 400 });

    // 1. Supabase에서 영상 정보 조회
    const { data: video, error: fetchError } = await supabase
      .from('videos')
      .select('video_url, scenes')
      .eq('id', id)
      .single();

    if (fetchError || !video) {
      return NextResponse.json({ error: '영상을 찾을 수 없습니다' }, { status: 404 });
    }

    // 2. 삭제할 S3 키 수집
    const urlsToDelete: string[] = [];

    if (video.video_url) urlsToDelete.push(video.video_url);

    if (Array.isArray(video.scenes)) {
      for (const scene of video.scenes) {
        if (scene.imageUrl) urlsToDelete.push(scene.imageUrl);
        if (scene.audioUrl) urlsToDelete.push(scene.audioUrl);
        if (scene.videoUrl) urlsToDelete.push(scene.videoUrl);
      }
    }

    const keys = urlsToDelete
      .map(urlToKey)
      .filter((k): k is string => k !== null);

    // 3. S3 일괄 삭제 (최대 1000개 단위)
    if (keys.length > 0) {
      const chunks: string[][] = [];
      for (let i = 0; i < keys.length; i += 1000) {
        chunks.push(keys.slice(i, i + 1000));
      }
      await Promise.all(
        chunks.map(chunk =>
          s3.send(new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: { Objects: chunk.map(Key => ({ Key })) },
          }))
        )
      );
    }

    // 4. Supabase 레코드 삭제
    const { error: deleteError } = await supabase.from('videos').delete().eq('id', id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true, deletedFiles: keys.length });
  } catch (err: unknown) {
    console.error('[delete-video]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
