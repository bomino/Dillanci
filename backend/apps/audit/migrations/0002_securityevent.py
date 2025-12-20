# Generated manually for SecurityEvent model

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('organizations', '0001_initial'),
        ('audit', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='SecurityEvent',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('timestamp', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('event_type', models.CharField(
                    choices=[
                        ('LOGIN_SUCCESS', 'Login Success'),
                        ('LOGIN_FAILED', 'Login Failed'),
                        ('LOGOUT', 'Logout'),
                        ('SESSION_EXPIRED', 'Session Expired'),
                        ('PASSWORD_CHANGE', 'Password Change'),
                        ('PASSWORD_RESET_REQUEST', 'Password Reset Request'),
                        ('PASSWORD_RESET_COMPLETE', 'Password Reset Complete'),
                        ('ROLE_ASSIGNED', 'Role Assigned'),
                        ('ROLE_REMOVED', 'Role Removed'),
                        ('PERMISSION_DENIED', 'Permission Denied'),
                        ('RATE_LIMIT_EXCEEDED', 'Rate Limit Exceeded'),
                        ('API_KEY_CREATED', 'API Key Created'),
                        ('API_KEY_REVOKED', 'API Key Revoked'),
                        ('API_KEY_USED', 'API Key Used'),
                        ('BULK_EXPORT', 'Bulk Data Export'),
                        ('SENSITIVE_DATA_ACCESS', 'Sensitive Data Access'),
                        ('ACCOUNT_CREATED', 'Account Created'),
                        ('ACCOUNT_ACTIVATED', 'Account Activated'),
                        ('ACCOUNT_DEACTIVATED', 'Account Deactivated'),
                        ('ACCOUNT_SUSPENDED', 'Account Suspended'),
                        ('ACCOUNT_LOCKED', 'Account Locked'),
                        ('PORTAL_LOGIN_SUCCESS', 'Portal Login Success'),
                        ('PORTAL_LOGIN_FAILED', 'Portal Login Failed'),
                        ('PORTAL_REGISTRATION', 'Portal Registration'),
                    ],
                    db_index=True,
                    max_length=50,
                )),
                ('severity', models.CharField(
                    choices=[
                        ('INFO', 'Info'),
                        ('WARNING', 'Warning'),
                        ('ERROR', 'Error'),
                        ('CRITICAL', 'Critical'),
                    ],
                    db_index=True,
                    default='INFO',
                    max_length=20,
                )),
                ('user_email', models.EmailField(blank=True, db_index=True, default='', max_length=254)),
                ('ip_address', models.GenericIPAddressField(blank=True, db_index=True, null=True)),
                ('user_agent', models.CharField(blank=True, default='', max_length=512)),
                ('description', models.TextField(blank=True, default='')),
                ('details', models.JSONField(blank=True, default=dict, help_text='Event-specific details in JSON format')),
                ('target_email', models.EmailField(blank=True, default='', max_length=254)),
                ('correlation_id', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('success', models.BooleanField(default=True)),
                ('failure_reason', models.CharField(blank=True, default='', max_length=255)),
                ('organization', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='security_events',
                    to='organizations.organization',
                )),
                ('target_user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='security_events_as_target',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('user', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='security_events',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Security Event',
                'verbose_name_plural': 'Security Events',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='securityevent',
            index=models.Index(fields=['event_type', 'timestamp'], name='audit_secur_event_t_6dc45e_idx'),
        ),
        migrations.AddIndex(
            model_name='securityevent',
            index=models.Index(fields=['user', 'timestamp'], name='audit_secur_user_id_c80d69_idx'),
        ),
        migrations.AddIndex(
            model_name='securityevent',
            index=models.Index(fields=['organization', 'timestamp'], name='audit_secur_organiz_afc6c0_idx'),
        ),
        migrations.AddIndex(
            model_name='securityevent',
            index=models.Index(fields=['ip_address', 'timestamp'], name='audit_secur_ip_addr_8b45e9_idx'),
        ),
        migrations.AddIndex(
            model_name='securityevent',
            index=models.Index(fields=['severity', 'timestamp'], name='audit_secur_severit_7f1234_idx'),
        ),
    ]
