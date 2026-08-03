# Getting started with the AWS CLI (Cutline)

Use **AWS CLI v2** on a local PC (or [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/)) for bucket bootstrap and ops scripts. The Thermal API does not require the CLI — it uses the AWS SDK (`server/s3Storage.ts`).

Official chapter: [Getting started with the AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html).

## Steps

1. **[Prerequisites](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-prereqs.html)** — AWS account + IAM credentials (not root). Prefer least-privilege IAM for CLI tasks; prefer an **IAM role** on production hosts instead of permanent access keys.

2. **Install or access the CLI** (pick one):
   - **(Recommended)** [Install or update to the latest AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
   - [Install a past v2 release](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-version.html) (team version pin)
   - [Build from source](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-source-install.html) (unsupported platforms)
   - [ECR Public / Docker images](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-docker.html)
   - [AWS CloudShell](https://docs.aws.amazon.com/cloudshell/latest/userguide/) in the console (no local install)

3. **[Configure for first use](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-quickstart.html)** — typically `aws configure` with access key + region (`us-east-1` for Cutline), or env vars / instance role.

**Troubleshooting:** [AWS CLI troubleshooting](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-troubleshooting.html).

## Cutline after configure

```bash
# Confirm identity
aws sts get-caller-identity

# Media bucket helpers (see scripts/aws/media_bootstrap.sh)
CUTLINE_MEDIA_BUCKET=thermal-video-clips ./scripts/aws/media_bootstrap.sh create-bucket
```

App / `.env` clip storage (SDK, not CLI):

| Variable | Kind |
|----------|------|
| `AWS_ACCESS_KEY_ID` | secret (local/dev; omit with IAM role) |
| `AWS_SECRET_ACCESS_KEY` | secret (local/dev; omit with IAM role) |
| `AWS_REGION` | config |
| `AWS_S3_BUCKET_NAME` | config |
| `AWS_CLOUDFRONT_DOMAIN` | optional config |

Console: [IAM users](https://console.aws.amazon.com/iam/home#/users) · [S3 buckets](https://s3.console.aws.amazon.com/s3/buckets) · [CloudFront](https://console.aws.amazon.com/cloudfront/v4/home#/distributions)

See also [PLATFORM.md](./PLATFORM.md#aws) and [THERMAL-MISSION-CONTROL.md](./THERMAL-MISSION-CONTROL.md).
