/**
 * S3 버킷에 Lifecycle 정책을 적용합니다.
 * - 모든 객체: 7일 후 자동 삭제
 *
 * 실행: npx tsx scripts/setup-s3-lifecycle.ts
 */
import { S3Client, PutBucketLifecycleConfigurationCommand, GetBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BUCKET = process.env.S3_BUCKET ?? 'remotionlambda-apnortheast2-17lxfxukvf';
const REGION = process.env.AWS_REGION ?? 'ap-northeast-2';

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

async function main() {
  console.log(`버킷: ${BUCKET} (${REGION})`);

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

  console.log('Lifecycle 정책 적용 완료.');

  // 적용 확인
  const res = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: BUCKET }));
  console.log('현재 정책:', JSON.stringify(res.Rules, null, 2));
}

main().catch(e => {
  console.error('실패:', e.message);
  process.exit(1);
});
