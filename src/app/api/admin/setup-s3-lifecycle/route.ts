/**
 * GET /api/admin/setup-s3-lifecycle
 * S3 버킷에 7일 자동 삭제 Lifecycle 정책을 적용합니다.
 * 한 번만 실행하면 됩니다.
 */
import { NextResponse } from 'next/server';
import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
} from '@aws-sdk/client-s3';

export const runtime = 'nodejs';

const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'ap-northeast-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';

export async function GET() {
  try {
    await s3.send(new PutBucketLifecycleConfigurationCommand({
      Bucket: BUCKET,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'auto-delete-7days',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Expiration: { Days: 7 },
            NoncurrentVersionExpiration: { NoncurrentDays: 1 },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          },
        ],
      },
    }));

    const res = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET }));

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      rules: res.Rules,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
