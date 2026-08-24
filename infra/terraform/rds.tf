# Postgres, in the data tier.
#
# Single-AZ, smallest Graviton instance, no backups, no deletion protection.
# All four are wrong for a real deployment and right for one that exists for an
# afternoon and has to tear down cleanly.

resource "aws_db_subnet_group" "main" {
  name       = local.name
  subnet_ids = [for subnet in aws_subnet.data : subnet.id]

  tags = { Name = local.name }
}

resource "random_password" "database" {
  length = 32
  # RDS rejects several punctuation characters in a master password.
  # `resolveDatabaseUrl` percent-encodes what it is given, but there is no
  # reason to lean on that here.
  override_special = "-_"
  special          = true
}

resource "aws_db_instance" "main" {
  identifier     = local.name
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = "cvjobs"
  username = "cvjobs"
  password = random_password.database.result

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.database.id]
  publicly_accessible    = false
  multi_az               = false

  # Nothing in here survives the demo, so there is nothing to back up and no
  # final snapshot worth the minutes it adds to destroy.
  backup_retention_period = 0
  skip_final_snapshot     = true
  deletion_protection     = false

  auto_minor_version_upgrade = false
  apply_immediately          = true

  tags = { Name = local.name }
}

# Postgres 15 and later default `rds.force_ssl` to 1, so the connection is
# encrypted either way. This bundle is what turns it from encrypted-but-
# unverified into verified: without it ProductionConfigService falls back to
# `rejectUnauthorized: false`.
#
# Public information, so it travels as a plain environment variable. It is also
# 4.6 KB - just over the 4 KB ceiling on a standard SSM parameter, so SSM was
# not an option even had it been the right home.
data "http" "rds_ca_bundle" {
  url = "https://truststore.pki.rds.amazonaws.com/${var.aws_region}/${var.aws_region}-bundle.pem"

  lifecycle {
    postcondition {
      condition     = self.status_code == 200
      error_message = "Could not fetch the RDS CA bundle for ${var.aws_region} (HTTP ${self.status_code})."
    }
  }
}
