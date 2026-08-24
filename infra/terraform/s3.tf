# The resume bucket.
#
# The browser PUTs straight here with a presigned URL - files never pass through
# the API - which is the only reason this needs a CORS policy. Everything else
# about the bucket is closed.

resource "aws_s3_bucket" "resumes" {
  bucket = "${local.name}-resumes-${local.account_id}"

  # Destroy fails on a bucket with objects in it, and there will be objects.
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# A presigned PUT is cross-origin by construction: the page comes from the load
# balancer, the upload goes to S3. Mirrors MINIO_API_CORS_ALLOW_ORIGIN in
# docker-compose.yml, which exists so this is exercised locally rather than
# discovered here.
resource "aws_s3_bucket_cors_configuration" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  cors_rule {
    allowed_origins = [local.app_origin]
    allowed_methods = ["PUT"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
