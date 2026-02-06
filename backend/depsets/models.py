from django.db import models
from django.contrib.auth.models import User


class Depset(models.Model):
    """
    Depset (Dependency Set) - A reusable collection of runtime dependencies.
    Similar to AWS Lambda layers, allows sharing dependencies across functions.
    Supports Python, Node.js, Ruby, Java, .NET, Bash, and Go runtimes.
    """
    RUNTIME_TYPE_CHOICES = [
        ('python', 'Python'),
        ('nodejs', 'Node.js'),
        ('ruby', 'Ruby'),
        ('java', 'Java'),
        ('dotnet', '.NET'),
        ('bash', 'Bash'),
        ('go', 'Go'),
    ]

    name = models.CharField(max_length=255, help_text="Name of the dependency set")
    slug = models.SlugField(max_length=255, db_index=True)  # Not unique - same name allowed for different runtimes
    description = models.TextField(blank=True, help_text="Description of what packages this depset provides")
    team = models.ForeignKey(
        'users.Team',
        on_delete=models.CASCADE,
        related_name='depsets',
        help_text="Team that owns this depset"
    )
    runtime_type = models.CharField(
        max_length=20,
        choices=RUNTIME_TYPE_CHOICES,
        default='python',
        help_text="Runtime type (python, nodejs, go, dotnet)"
    )
    runtime_version = models.CharField(
        max_length=20,
        default="3.11",
        help_text="Runtime version (e.g., 3.11 for Python, 20 for Node.js, 1.22 for Go, 8 for .NET)"
    )
    # Keep python_version for backward compatibility, but will be deprecated
    python_version = models.CharField(
        max_length=10,
        default="3.11",
        help_text="DEPRECATED: Use runtime_version instead. Compatible Python version (e.g., 3.11, 3.10)"
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Whether this depset can be used by other teams"
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_depsets'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = [('team', 'name', 'runtime_type', 'runtime_version')]
        indexes = [
            models.Index(fields=['team', 'slug']),
            models.Index(fields=['is_public']),
            models.Index(fields=['runtime_type', 'runtime_version']),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_runtime_type_display()} {self.runtime_version})"

    def get_requirements_txt(self):
        """Generate a requirements.txt format string for Python packages."""
        if self.runtime_type != 'python':
            return ""
        return "\n".join([pkg.to_requirement_line() for pkg in self.packages.all()])

    def get_package_json_dependencies(self):
        """Generate dependencies object for Node.js package.json."""
        if self.runtime_type != 'nodejs':
            return {}
        return {pkg.package_name: pkg.version_spec or "latest" for pkg in self.packages.all()}


class DepsetPackage(models.Model):
    """
    Individual package/dependency within a Depset.
    Stores package name and version specification for any runtime type.
    """
    depset = models.ForeignKey(
        Depset,
        on_delete=models.CASCADE,
        related_name='packages'
    )
    package_name = models.CharField(
        max_length=255,
        help_text="Package name (e.g., 'requests' for Python, 'express' for Node.js, 'sinatra' for Ruby)"
    )
    version_spec = models.CharField(
        max_length=100,
        blank=True,
        help_text="Version number (e.g., '2.31.0', '1.5.2'). System auto-formats for runtime (Python: ==, Node.js: @, Ruby: -v)"
    )
    order = models.IntegerField(
        default=0,
        help_text="Installation order (lower numbers install first)"
    )
    notes = models.TextField(
        blank=True,
        help_text="Optional notes about this package dependency"
    )

    class Meta:
        ordering = ['order', 'package_name']
        unique_together = [('depset', 'package_name')]

    def __str__(self):
        return f"{self.package_name}{self.version_spec}"

    def to_requirement_line(self):
        """Convert to a pip requirements.txt line (Python only)."""
        return f"{self.package_name}{self.version_spec}"
