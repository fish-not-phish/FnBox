from django.db import models
from django.conf import settings
from cryptography.fernet import Fernet
import base64
import hashlib
import uuid


def get_encryption_key():
    """Get or generate encryption key from settings."""
    secret_key = settings.SECRET_KEY.encode()
    # Use the first 32 bytes of the hash for Fernet key
    key = base64.urlsafe_b64encode(hashlib.sha256(secret_key).digest())
    return key


class Secret(models.Model):
    """
    Stores encrypted secrets at the team level.
    Secrets are injected as environment variables into Firecracker microVMs.
    """
    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        help_text="Unique identifier for the secret"
    )
    team = models.ForeignKey(
        'users.Team',
        on_delete=models.CASCADE,
        related_name='secrets'
    )
    key = models.CharField(
        max_length=255,
        help_text="Environment variable name (e.g., DATABASE_URL, API_KEY)"
    )
    encrypted_value = models.TextField(
        help_text="Encrypted secret value"
    )
    description = models.TextField(
        blank=True,
        help_text="Optional description of what this secret is for"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_secrets'
    )

    class Meta:
        ordering = ['key']
        unique_together = ('team', 'key')
        indexes = [
            models.Index(fields=['team', 'key']),
        ]

    def __str__(self):
        return f"{self.team.name}: {self.key}"

    def set_value(self, plain_value: str):
        """Encrypt and store a secret value."""
        cipher = Fernet(get_encryption_key())
        encrypted = cipher.encrypt(plain_value.encode())
        self.encrypted_value = encrypted.decode()

    def get_value(self) -> str:
        """Decrypt and return the secret value."""
        cipher = Fernet(get_encryption_key())
        decrypted = cipher.decrypt(self.encrypted_value.encode())
        return decrypted.decode()

    def save(self, *args, **kwargs):
        # Ensure key is uppercase and follows env var naming conventions
        self.key = self.key.upper().replace(' ', '_').replace('-', '_')
        super().save(*args, **kwargs)
