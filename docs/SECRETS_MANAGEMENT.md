# Secrets Management Guide

## Overview

This guide covers the recommended approach for managing secrets in the Dillanci Procurement Platform, from development through production deployment.

## Current State

**Development & Staging:** Using `.env` files (acceptable for non-production)
**Production:** Must migrate to a secrets management solution

## Secrets Classification

### Critical Secrets (Rotate Immediately if Exposed)

| Secret | Purpose | Rotation Frequency |
|--------|---------|-------------------|
| `SECRET_KEY` | Django cryptographic signing | 90 days |
| `DB_PASSWORD` | Database access | 90 days |
| `SENTRY_DSN` | Error reporting | On compromise |
| `AWS_SECRET_ACCESS_KEY` | S3 file storage | 90 days |

### Sensitive Secrets

| Secret | Purpose | Rotation Frequency |
|--------|---------|-------------------|
| `EMAIL_HOST_PASSWORD` | SendGrid/SMTP | 180 days |
| `REDIS_PASSWORD` | Cache/Celery broker | 180 days |
| `CELERY_BROKER_URL` | Contains Redis password | 180 days |

### Configuration Values (Not Secrets)

These can remain in `.env` or config files:
- `DEBUG` (boolean)
- `ALLOWED_HOSTS` (domain list)
- `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`
- `AWS_S3_REGION_NAME`, `AWS_STORAGE_BUCKET_NAME`
- `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE`

## Recommended Production Solutions

### Option 1: AWS Secrets Manager (Recommended for AWS Deployments)

**Pros:**
- Native AWS integration
- Automatic rotation support
- Fine-grained IAM policies
- Cross-region replication

**Cons:**
- AWS vendor lock-in
- Cost per secret stored

#### Setup

1. **Create Secrets in AWS Console or CLI:**

```bash
aws secretsmanager create-secret \
    --name dillanci/production/database \
    --secret-string '{"username":"dillanci","password":"secure-password"}'

aws secretsmanager create-secret \
    --name dillanci/production/django \
    --secret-string '{"secret_key":"your-secret-key"}'
```

2. **Install Django Integration:**

```bash
pip install boto3
```

3. **Update Django Settings:**

```python
# config/settings/production.py
import json
import boto3
from botocore.exceptions import ClientError

def get_secret(secret_name):
    """Retrieve secret from AWS Secrets Manager."""
    client = boto3.client('secretsmanager', region_name='us-east-1')
    try:
        response = client.get_secret_value(SecretId=secret_name)
        return json.loads(response['SecretString'])
    except ClientError as e:
        raise RuntimeError(f"Failed to retrieve secret: {e}")

# Load secrets
db_secrets = get_secret('dillanci/production/database')
django_secrets = get_secret('dillanci/production/django')

SECRET_KEY = django_secrets['secret_key']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DB_NAME'],
        'USER': db_secrets['username'],
        'PASSWORD': db_secrets['password'],
        'HOST': os.environ['DB_HOST'],
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}
```

4. **IAM Policy for EC2/ECS:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue"
            ],
            "Resource": [
                "arn:aws:secretsmanager:us-east-1:*:secret:dillanci/production/*"
            ]
        }
    ]
}
```

### Option 2: HashiCorp Vault (Recommended for Multi-Cloud)

**Pros:**
- Cloud-agnostic
- Dynamic secrets generation
- Powerful access policies
- Audit logging

**Cons:**
- Self-hosted complexity
- Additional infrastructure

#### Setup

1. **Install Vault Client:**

```bash
pip install hvac
```

2. **Django Integration:**

```python
# config/settings/production.py
import hvac

def get_vault_secrets():
    """Retrieve secrets from HashiCorp Vault."""
    client = hvac.Client(
        url=os.environ['VAULT_ADDR'],
        token=os.environ.get('VAULT_TOKEN'),
    )

    # For Kubernetes auth
    if os.environ.get('VAULT_ROLE'):
        client.auth.kubernetes.login(
            role=os.environ['VAULT_ROLE'],
            jwt=open('/var/run/secrets/kubernetes.io/serviceaccount/token').read()
        )

    return client.secrets.kv.v2.read_secret_version(
        path='dillanci/production'
    )['data']['data']

secrets = get_vault_secrets()
SECRET_KEY = secrets['django_secret_key']
```

### Option 3: Azure Key Vault

For Azure deployments:

```python
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient

credential = DefaultAzureCredential()
client = SecretClient(
    vault_url="https://dillanci-vault.vault.azure.net/",
    credential=credential
)

SECRET_KEY = client.get_secret("django-secret-key").value
```

### Option 4: Google Secret Manager

For GCP deployments:

```python
from google.cloud import secretmanager

client = secretmanager.SecretManagerServiceClient()
name = f"projects/dillanci-prod/secrets/django-secret-key/versions/latest"
response = client.access_secret_version(request={"name": name})
SECRET_KEY = response.payload.data.decode("UTF-8")
```

## Environment-Specific Configuration

### Development (.env file)

```bash
# .env.development - OK to check into repo for development
DEBUG=True
SECRET_KEY=dev-only-insecure-key-do-not-use-in-production
POSTGRES_PASSWORD=devpassword
```

### CI/CD (GitHub Actions Secrets)

```yaml
# .github/workflows/test.yml
env:
  SECRET_KEY: ${{ secrets.DJANGO_SECRET_KEY }}
  POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
```

### Production (Secrets Manager)

```bash
# Only non-sensitive config in env
DEBUG=False
ALLOWED_HOSTS=app.dillanci.com
DB_HOST=dillanci-db.rds.amazonaws.com
SECRETS_BACKEND=aws_secrets_manager
SECRETS_PREFIX=dillanci/production
```

## Secret Rotation

### Automatic Rotation (AWS Secrets Manager)

1. Create rotation Lambda function
2. Configure rotation schedule
3. Update application to handle credential refresh

```python
# Lambda rotation function template
def rotate_secret(event, context):
    step = event['Step']

    if step == 'createSecret':
        # Generate new password
        pass
    elif step == 'setSecret':
        # Update database with new password
        pass
    elif step == 'testSecret':
        # Verify new password works
        pass
    elif step == 'finishSecret':
        # Mark new version as current
        pass
```

### Manual Rotation Procedure

1. Generate new secret value
2. Update secrets manager
3. Deploy application (picks up new secret)
4. Verify application works
5. Revoke old secret

### Django SECRET_KEY Rotation

```bash
# Generate new key
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"

# Update in secrets manager
aws secretsmanager update-secret \
    --secret-id dillanci/production/django \
    --secret-string '{"secret_key":"new-key-here"}'

# Deploy to apply
# Note: This will invalidate all sessions
```

## Docker & Kubernetes Integration

### Docker Compose (Staging)

```yaml
services:
  backend:
    environment:
      - SECRETS_BACKEND=aws_secrets_manager
    # Use IAM role from host or ECS task role
```

### Kubernetes (Production)

```yaml
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: dillanci-app
  containers:
    - name: app
      env:
        - name: SECRETS_BACKEND
          value: "aws_secrets_manager"
      volumeMounts:
        - name: secrets
          mountPath: "/mnt/secrets"
          readOnly: true
  volumes:
    - name: secrets
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: dillanci-secrets
```

### External Secrets Operator (Kubernetes)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: dillanci-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: dillanci-app-secrets
  data:
    - secretKey: django_secret_key
      remoteRef:
        key: dillanci/production/django
        property: secret_key
```

## Migration Plan: .env to Secrets Manager

### Phase 1: Setup (Week 1)

1. [ ] Choose secrets management solution
2. [ ] Set up secrets manager instance/account
3. [ ] Create secrets for all environments
4. [ ] Update IAM/access policies

### Phase 2: Integration (Week 2)

1. [ ] Add secrets client to requirements
2. [ ] Create secrets loading utility
3. [ ] Update production settings
4. [ ] Update deployment scripts

### Phase 3: Migration (Week 3)

1. [ ] Deploy to staging with secrets manager
2. [ ] Verify all secrets load correctly
3. [ ] Run full test suite
4. [ ] Deploy to production
5. [ ] Remove .env files from production servers

### Phase 4: Cleanup (Week 4)

1. [ ] Rotate all secrets (old values may be exposed)
2. [ ] Remove secrets from .env files
3. [ ] Update documentation
4. [ ] Train team on new procedures

## Security Best Practices

### Do

- Use different secrets per environment
- Enable audit logging for secret access
- Set up alerting for unusual access patterns
- Document rotation procedures
- Test secret rotation before production
- Use short-lived tokens where possible

### Don't

- Commit secrets to git (even encrypted)
- Share secrets via email/Slack
- Use the same secret across services
- Store secrets in application logs
- Hard-code secrets in Docker images
- Skip rotation after personnel changes

## Audit & Compliance

### Logging Requirements

All secret access should be logged:
- Who accessed the secret
- When it was accessed
- From where (IP/service)
- Which version was accessed

### Compliance Considerations

- **SOC 2**: Secrets must be encrypted at rest and in transit
- **PCI-DSS**: Database credentials must be rotated every 90 days
- **GDPR**: Encryption keys for personal data must be managed securely

## Emergency Procedures

### Suspected Secret Exposure

1. **Immediately** rotate the exposed secret
2. Check access logs for unauthorized use
3. Revoke any sessions/tokens using old secret
4. Notify security team
5. Document incident

### Lost Access to Secrets Manager

1. Use break-glass account (stored securely offline)
2. Restore from backup if available
3. Re-create secrets from secure backups
4. Update application configuration
5. Review access controls

## Contact

For secrets-related emergencies:
- Security Team: security@dillanci.com
- On-call: Check PagerDuty schedule
