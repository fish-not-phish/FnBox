"""
Management command to sync Kubernetes pod status with Django Function model.

This command:
1. Queries Kubernetes for running function pods
2. Matches them with Django Function records by function-id label
3. Updates Django's deployment_name, service_name, k8s_namespace, and status
4. Marks missing/removed pods as 'inactive' in Django

Usage:
    python manage.py sync_k8s_status
    python manage.py sync_k8s_status --dry-run
"""
import logging
from django.core.management.base import BaseCommand
from django.utils import timezone

from functions.kubernetes import KubernetesManager
from functions.models import Function

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync Kubernetes pod status with Django Function model'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without making changes',
        )
        parser.add_argument(
            '--namespace',
            default='fnbox-functions',
            help='Kubernetes namespace to scan (default: fnbox-functions)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        namespace = options['namespace']

        self.stdout.write(f'Scanning namespace: {namespace}')

        try:
            k8s = KubernetesManager()
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to connect to Kubernetes: {e}'))
            return

        # Get all pods in the namespace
        try:
            pods = k8s.core_v1.list_namespaced_pod(namespace=namespace)
        except Exception as e:
            self.stderr.write(self.style.ERROR(f'Failed to list pods: {e}'))
            return

        # Build a mapping of function_id -> pod info
        running_functions = {}
        for pod in pods.items:
            labels = pod.metadata.labels or {}
            function_id = labels.get('function-id')

            if function_id and pod.status.phase == 'Running':
                # Extract deployment name from app label (e.g., "func-e7c05696")
                deployment_name = labels.get('app', '')
                running_functions[function_id] = {
                    'deployment_name': deployment_name,
                    'service_name': f'{deployment_name}-svc',
                    'namespace': namespace,
                    'pod_name': pod.metadata.name,
                    'phase': pod.status.phase,
                }

        self.stdout.write(f'Found {len(running_functions)} running function pods')

        # Track which Django functions should be marked as inactive
        all_functions = set(Function.objects.values_list('id', flat=True))
        active_functions = set(running_functions.keys())

        # Update or create Function records based on running pods
        updated_count = 0
        for function_id, pod_info in running_functions.items():
            func = Function.objects.filter(id=function_id).first()

            if not func:
                self.stdout.write(
                    self.style.WARNING(
                        f'Pod running for unknown function: {function_id} ({pod_info["pod_name"]})'
                    )
                )
                continue

            changes = []
            if func.deployment_name != pod_info['deployment_name']:
                changes.append(f'deployment_name: "{func.deployment_name}" -> "{pod_info["deployment_name"]}"')
            if func.service_name != pod_info['service_name']:
                changes.append(f'service_name: "{func.service_name}" -> "{pod_info["service_name"]}"')
            if func.k8s_namespace != pod_info['namespace']:
                changes.append(f'k8s_namespace: "{func.k8s_namespace}" -> "{pod_info["namespace"]}"')
            if func.status != 'active':
                changes.append(f'status: "{func.status}" -> "active"')

            if changes:
                self.stdout.write(f'\nFunction {func.name} ({func.id}):')
                for change in changes:
                    self.stdout.write(f'  - {change}')

                if not dry_run:
                    func.deployment_name = pod_info['deployment_name']
                    func.service_name = pod_info['service_name']
                    func.k8s_namespace = pod_info['namespace']
                    func.status = 'active'
                    func.last_deployed_at = timezone.now()
                    func.save(update_fields=[
                        'deployment_name', 'service_name', 'k8s_namespace',
                        'status', 'last_deployed_at', 'updated_at'
                    ])
                    self.stdout.write(self.style.SUCCESS(f'  -> Updated successfully'))
                else:
                    self.stdout.write(self.style.WARNING(f'  -> Dry run, no changes made'))

                updated_count += 1

        # Mark functions as inactive if their pods are no longer running
        missing_functions = all_functions - active_functions
        for func_id in missing_functions:
            func = Function.objects.get(id=func_id)
            if func.status == 'active' and func.deployment_name:
                self.stdout.write(f'\nFunction {func.name} ({func.id}):')
                self.stdout.write(f'  - status: "{func.status}" -> "inactive" (pod no longer running)')
                self.stdout.write(f'  - deployment_name: cleared')
                self.stdout.write(f'  - service_name: cleared')

                if not dry_run:
                    func.status = 'inactive'
                    func.deployment_name = ''
                    func.service_name = ''
                    func.k8s_namespace = ''
                    func.save(update_fields=[
                        'status', 'deployment_name', 'service_name',
                        'k8s_namespace', 'updated_at'
                    ])
                    self.stdout.write(self.style.SUCCESS(f'  -> Updated successfully'))
                else:
                    self.stdout.write(self.style.WARNING(f'  -> Dry run, no changes made'))

        if dry_run:
            self.stdout.write(self.style.WARNING(f'\nDry run complete. No changes were made.'))
        else:
            self.stdout.write(self.style.SUCCESS(f'\nSync complete. {updated_count} functions updated.'))