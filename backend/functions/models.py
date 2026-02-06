from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator
import uuid


class Function(models.Model):
    """
    Serverless function that can be deployed to Firecracker microVMs.
    """
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('deploying', 'Deploying'),
        ('active', 'Active'),
        ('undeploying', 'Undeploying'),
        ('inactive', 'Inactive'),
        ('error', 'Error'),
    ]

    RUNTIME_CHOICES = [
        # Python
        ('python3.14', 'Python 3.14'),
        ('python3.13', 'Python 3.13'),
        ('python3.12', 'Python 3.12'),
        ('python3.11', 'Python 3.11'),
        ('python3.10', 'Python 3.10'),
        ('python3.9', 'Python 3.9'),
        # Node.js
        ('nodejs25', 'Node.js 25'),
        ('nodejs24', 'Node.js 24'),
        ('nodejs20', 'Node.js 20'),
        # Ruby
        ('ruby3.4', 'Ruby 3.4'),
        # Java
        ('java27', 'Java 27'),
        # .NET
        ('dotnet10', '.NET 10'),
        ('dotnet9', '.NET 9'),
        ('dotnet8', '.NET 8'),
        # Bash
        ('bash5', 'Bash 5'),
        # Go
        ('go1.25', 'Go 1.25'),
    ]

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        help_text="Unique identifier for the function"
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the function"
    )
    slug = models.SlugField(
        max_length=255,
        unique=True,
        db_index=True,
        validators=[
            RegexValidator(
                regex=r'^[a-z0-9-]+$',
                message='Slug can only contain lowercase letters, numbers, and hyphens'
            )
        ]
    )
    description = models.TextField(
        blank=True,
        help_text="Description of what this function does"
    )
    team = models.ForeignKey(
        'users.Team',
        on_delete=models.CASCADE,
        related_name='functions',
        help_text="Team that owns this function"
    )

    # Code and runtime
    code = models.TextField(
        help_text="Python code for the function"
    )
    handler = models.CharField(
        max_length=255,
        default="handler",
        help_text="Function entry point (e.g., 'handler' for def handler(event, context))"
    )
    runtime = models.CharField(
        max_length=20,
        choices=RUNTIME_CHOICES,
        default='python3.11',
        help_text="Python runtime version"
    )

    # Configuration
    memory_mb = models.IntegerField(
        default=128,
        help_text="Memory allocation in MB (128-3008)"
    )
    vcpu_count = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=1.00,
        help_text="Number of vCPUs to allocate (0.25, 0.5, 1, 2, 3, 4)"
    )
    timeout_seconds = models.IntegerField(
        default=30,
        help_text="Execution timeout in seconds (1-900)"
    )

    # Dependencies
    depsets = models.ManyToManyField(
        'depsets.Depset',
        related_name='functions',
        blank=True,
        help_text="Dependency sets to include"
    )

    # Secrets (environment variables will reference secrets)
    secrets = models.ManyToManyField(
        'vault.Secret',
        related_name='functions',
        blank=True,
        help_text="Secrets to inject as environment variables"
    )

    # Status and metadata
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        help_text="Current status of the function"
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Whether this function is publicly accessible"
    )

    # Tracking
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_functions'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_deployed_at = models.DateTimeField(null=True, blank=True)

    # Kubernetes tracking (for deployed functions)
    deployment_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Kubernetes deployment name for deployed function"
    )
    service_name = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Kubernetes service name for deployed function"
    )
    k8s_namespace = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        default='fnbox-functions',
        help_text="Kubernetes namespace where function is deployed"
    )

    # Legacy VM tracking (deprecated, kept for backward compatibility)
    vm_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="[DEPRECATED] Firecracker VM ID for deployed function"
    )
    vm_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="[DEPRECATED] IP address of the deployed VM"
    )
    vm_status = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="[DEPRECATED] Status of the deployed VM (running, stopped, error)"
    )

    # Statistics
    invocation_count = models.IntegerField(
        default=0,
        help_text="Total number of times this function has been invoked"
    )
    last_invoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('team', 'name')]
        indexes = [
            models.Index(fields=['team', 'slug']),
            models.Index(fields=['status']),
            models.Index(fields=['is_public']),
        ]

    def __str__(self):
        return f"{self.name} ({self.runtime})"


class FunctionInvocation(models.Model):
    """
    Record of a function invocation/execution.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('error', 'Error'),
        ('timeout', 'Timeout'),
    ]

    function = models.ForeignKey(
        Function,
        on_delete=models.CASCADE,
        related_name='invocations'
    )

    # Invocation details
    request_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )

    # Input/Output
    input_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Input event data"
    )
    output_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Function return value"
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if execution failed"
    )

    # Execution metrics
    duration_ms = models.IntegerField(
        null=True,
        blank=True,
        help_text="Execution duration in milliseconds"
    )
    memory_used_mb = models.IntegerField(
        null=True,
        blank=True,
        help_text="Peak memory usage in MB"
    )

    # Logs
    logs = models.TextField(
        blank=True,
        help_text="Execution logs (stdout/stderr)"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['function', '-created_at']),
            models.Index(fields=['request_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.function.name} - {self.request_id} ({self.status})"


class FunctionTrigger(models.Model):
    """
    Trigger configuration for functions (scheduled or HTTP).
    """
    TRIGGER_TYPE_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('http', 'HTTP'),
    ]

    uuid = models.UUIDField(
        default=uuid.uuid4,
        editable=False,
        unique=True,
        db_index=True,
        help_text="Unique identifier for the trigger"
    )
    function = models.ForeignKey(
        Function,
        on_delete=models.CASCADE,
        related_name='triggers'
    )
    name = models.CharField(
        max_length=255,
        help_text="Name of the trigger"
    )
    trigger_type = models.CharField(
        max_length=20,
        choices=TRIGGER_TYPE_CHOICES,
        help_text="Type of trigger"
    )

    # For scheduled triggers
    schedule = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="Cron expression for scheduled triggers (e.g., '0 * * * *')"
    )

    # Status
    enabled = models.BooleanField(
        default=True,
        help_text="Whether this trigger is active"
    )

    # Tracking
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_triggers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_triggered_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time this trigger fired"
    )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['function', 'trigger_type']),
            models.Index(fields=['enabled']),
        ]
        unique_together = [('function', 'name')]

    def __str__(self):
        return f"{self.function.name} - {self.name} ({self.trigger_type})"
