"""
Celery tasks for asynchronous function operations.
"""
from celery import shared_task
from django.utils import timezone
from django.conf import settings
import logging
import time
import uuid as uuid_module

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def deploy_function_task(self, function_uuid: str):
    """
    Async task to deploy a function to Kubernetes.

    Args:
        function_uuid: UUID of the function to deploy

    Returns:
        dict with deployment info (deployment_name, service_name, status)
    """
    from functions.models import Function
    from functions.kubernetes import KubernetesManager

    try:
        func = Function.objects.get(uuid=function_uuid)

        # Update status to deploying
        func.status = 'deploying'
        func.save(update_fields=['status'])

        logger.info(f"[TASK] Starting deployment for function {function_uuid}")

        # Get dependencies from depsets
        depset_packages = []
        for depset in func.depsets.prefetch_related('packages').all():
            runtime_type = depset.runtime_type
            for pkg in depset.packages.all().order_by('order'):
                if pkg.version_spec:
                    # Format based on runtime type
                    version = pkg.version_spec.strip()

                    # If version already has operator/prefix, use as-is (backward compatibility)
                    if version.startswith(('==', '>=', '<=', '>', '<', '~', '^', '@')):
                        depset_packages.append(f"{pkg.package_name}{version}")
                    else:
                        # Auto-format based on runtime
                        if runtime_type == 'python':
                            depset_packages.append(f"{pkg.package_name}=={version}")
                        elif runtime_type == 'nodejs':
                            depset_packages.append(f"{pkg.package_name}@{version}")
                        elif runtime_type == 'ruby':
                            depset_packages.append(f"{pkg.package_name} -v {version}")
                        else:
                            depset_packages.append(f"{pkg.package_name}=={version}")
                else:
                    depset_packages.append(pkg.package_name)

        # Deploy using Kubernetes manager
        k8s_manager = KubernetesManager()
        deployment = k8s_manager.deploy_function(
            function_id=str(func.uuid),
            runtime=func.runtime,
            code=func.code,
            dependencies=depset_packages,
            memory_mb=func.memory_mb,
            timeout_seconds=func.timeout_seconds,
            vcpu_count=func.vcpu_count
        )

        # Update function with deployment info
        func.deployment_name = deployment['deployment_name']
        func.service_name = deployment['service_name']
        func.k8s_namespace = settings.KUBERNETES_NAMESPACE
        func.status = 'active'
        func.last_deployed_at = timezone.now()
        func.save()

        logger.info(f"[TASK] Successfully deployed function {function_uuid} to {deployment['deployment_name']}")

        return {
            'success': True,
            'deployment_name': deployment['deployment_name'],
            'service_name': deployment['service_name'],
            'status': deployment['status'],
            'deployed_at': func.last_deployed_at.isoformat()
        }

    except Function.DoesNotExist:
        logger.error(f"[TASK] Function {function_uuid} not found")
        return {'success': False, 'error': 'Function not found'}

    except Exception as e:
        logger.error(f"[TASK] Failed to deploy function {function_uuid}: {str(e)}", exc_info=True)

        # Mark function as error state
        try:
            func = Function.objects.get(uuid=function_uuid)
            func.status = 'error'
            func.save(update_fields=['status'])
        except Exception:
            pass

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=60)  # Retry after 60 seconds

        return {'success': False, 'error': str(e)}


@shared_task(bind=True, max_retries=3)
def undeploy_function_task(self, function_uuid: str):
    """
    Async task to undeploy a function from Kubernetes.

    Args:
        function_uuid: UUID of the function to undeploy

    Returns:
        dict with success status
    """
    from functions.models import Function
    from functions.kubernetes import KubernetesManager

    try:
        func = Function.objects.get(uuid=function_uuid)

        # Update status to undeploying
        func.status = 'undeploying'
        func.save(update_fields=['status'])

        logger.info(f"[TASK] Starting undeployment for function {function_uuid}")

        # Undeploy using Kubernetes manager
        if func.deployment_name:
            k8s_manager = KubernetesManager()
            k8s_manager.delete_function(deployment_name=func.deployment_name)

        # Update function status
        func.deployment_name = None
        func.service_name = None
        func.k8s_namespace = None
        func.status = 'draft'
        func.save()

        logger.info(f"[TASK] Successfully undeployed function {function_uuid}")

        return {'success': True}

    except Function.DoesNotExist:
        logger.error(f"[TASK] Function {function_uuid} not found")
        return {'success': False, 'error': 'Function not found'}

    except Exception as e:
        logger.error(f"[TASK] Failed to undeploy function {function_uuid}: {str(e)}", exc_info=True)

        # Mark function as error state but try to clean up
        try:
            func = Function.objects.get(uuid=function_uuid)
            func.status = 'error'
            func.save(update_fields=['status'])
        except Exception:
            pass

        # Retry on failure
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e, countdown=30)  # Retry after 30 seconds

        return {'success': False, 'error': str(e)}


@shared_task(bind=True)
def test_function_task(self, function_uuid: str, event_data: dict):
    """
    Async task to test invoke a function.

    Args:
        function_uuid: UUID of the function to test
        event_data: Event data to pass to the function

    Returns:
        dict with invocation ID for polling
    """
    from functions.models import Function, FunctionInvocation
    from functions.kubernetes import KubernetesManager

    try:
        func = Function.objects.get(uuid=function_uuid)

        # Check if function is deployed
        if func.status != 'active' or not func.service_name:
            return {
                'success': False,
                'error': 'Function must be deployed before testing',
                'invocation_id': None
            }

        # Circuit breaker: check recent failure rate to prevent resource exhaustion
        recent_invocations = FunctionInvocation.objects.filter(
            function=func,
            created_at__gte=timezone.now() - timezone.timedelta(minutes=5)
        ).order_by('-created_at')[:10]

        if recent_invocations.count() >= 10:
            failures = sum(1 for inv in recent_invocations if inv.status == 'error')
            if failures >= 8:  # 80% failure rate
                logger.warning(f"[CIRCUIT BREAKER] Function {function_uuid} has high failure rate ({failures}/10), throttling")
                return {
                    'success': False,
                    'error': 'Function has high failure rate. Please check function code and try again later.',
                    'invocation_id': None
                }

        # Check for too many concurrent invocations
        running_invocations = FunctionInvocation.objects.filter(
            function=func,
            status__in=['pending', 'running']
        ).count()

        if running_invocations >= 5:
            logger.warning(f"[RATE LIMIT] Function {function_uuid} has {running_invocations} concurrent invocations, rejecting")
            return {
                'success': False,
                'error': f'Too many concurrent invocations ({running_invocations}). Please wait for previous invocations to complete.',
                'invocation_id': None
            }

        start_time = time.time()
        request_id = f"req-{uuid_module.uuid4().hex[:12]}"

        # Create invocation record
        invocation = FunctionInvocation.objects.create(
            function=func,
            request_id=request_id,
            status='pending',
            input_data=event_data,
            started_at=timezone.now()
        )

        logger.info(f"[TASK] Starting test invocation {invocation.id} for function {function_uuid}")

        try:
            invocation.status = 'running'
            invocation.save(update_fields=['status'])

            # Fetch secrets for environment variables
            secrets_dict = {}
            for secret in func.secrets.all():
                try:
                    secrets_dict[secret.key] = secret.get_value()
                except Exception as e:
                    logger.warning(f"Failed to decrypt secret {secret.id} for function {func.uuid}: {e}")

            # Add secrets to event context
            event_with_secrets = {
                **event_data,
                '__secrets__': secrets_dict
            }

            # Invoke function via Kubernetes service
            k8s_manager = KubernetesManager()
            invocation_result = k8s_manager.invoke_function(
                service_name=func.service_name,
                event=event_with_secrets,
                timeout_seconds=func.timeout_seconds,
                code=func.code,
                handler=func.handler
            )

            execution_time = (time.time() - start_time) * 1000

            # Update invocation record with results
            invocation.status = 'success' if invocation_result.get('success', True) else 'error'
            invocation.output_data = invocation_result.get('result')
            invocation.error_message = invocation_result.get('error', '')
            invocation.logs = invocation_result.get('logs', '')
            invocation.duration_ms = int(invocation_result.get('execution_time_ms', execution_time))
            invocation.memory_used_mb = invocation_result.get('memory_used_mb')
            invocation.completed_at = timezone.now()
            invocation.save()

            # Update function statistics
            func.invocation_count += 1
            func.last_invoked_at = timezone.now()
            func.save(update_fields=['invocation_count', 'last_invoked_at'])

            logger.info(f"[TASK] Test invocation {invocation.id} completed successfully")

            return {
                'success': True,
                'invocation_id': invocation.id
            }

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000

            # Update invocation record with error
            invocation.status = 'error'
            invocation.error_message = str(e)
            invocation.duration_ms = int(execution_time)
            invocation.completed_at = timezone.now()
            invocation.save()

            logger.error(f"[TASK] Test invocation {invocation.id} failed: {str(e)}", exc_info=True)

            return {
                'success': False,
                'error': str(e),
                'invocation_id': invocation.id
            }

    except Function.DoesNotExist:
        logger.error(f"[TASK] Function {function_uuid} not found")
        return {
            'success': False,
            'error': 'Function not found',
            'invocation_id': None
        }

    except Exception as e:
        logger.error(f"[TASK] Failed to test function {function_uuid}: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'invocation_id': None
        }


@shared_task(bind=True)
def invoke_function_task(self, function_uuid: str, event_data: dict, request_id: str = None):
    """
    Async task to invoke a function (for triggers, API calls, etc).

    Args:
        function_uuid: UUID of the function to invoke
        event_data: Event data to pass to the function
        request_id: Optional request ID (generated if not provided)

    Returns:
        dict with invocation ID for polling
    """
    from functions.models import Function, FunctionInvocation
    from functions.kubernetes import KubernetesManager

    try:
        func = Function.objects.get(uuid=function_uuid)

        # Check if function is deployed
        if func.status != 'active' or not func.service_name:
            return {
                'success': False,
                'error': 'Function is not deployed',
                'invocation_id': None
            }

        # Circuit breaker: check recent failure rate to prevent resource exhaustion
        recent_invocations = FunctionInvocation.objects.filter(
            function=func,
            created_at__gte=timezone.now() - timezone.timedelta(minutes=5)
        ).order_by('-created_at')[:10]

        if recent_invocations.count() >= 10:
            failures = sum(1 for inv in recent_invocations if inv.status == 'error')
            if failures >= 8:  # 80% failure rate
                logger.warning(f"[CIRCUIT BREAKER] Function {function_uuid} has high failure rate ({failures}/10), throttling")
                return {
                    'success': False,
                    'error': 'Function has high failure rate. Please check function code and try again later.',
                    'invocation_id': None
                }

        # Check for too many concurrent invocations
        running_invocations = FunctionInvocation.objects.filter(
            function=func,
            status__in=['pending', 'running']
        ).count()

        if running_invocations >= 5:
            logger.warning(f"[RATE LIMIT] Function {function_uuid} has {running_invocations} concurrent invocations, rejecting")
            return {
                'success': False,
                'error': f'Too many concurrent invocations ({running_invocations}). Please wait for previous invocations to complete.',
                'invocation_id': None
            }

        start_time = time.time()
        if not request_id:
            request_id = f"req-{uuid_module.uuid4().hex[:12]}"

        # Create invocation record
        invocation = FunctionInvocation.objects.create(
            function=func,
            request_id=request_id,
            status='pending',
            input_data=event_data,
            started_at=timezone.now()
        )

        logger.info(f"[TASK] Starting invocation {invocation.id} for function {function_uuid}")

        try:
            invocation.status = 'running'
            invocation.save(update_fields=['status'])

            # Fetch secrets for environment variables
            secrets_dict = {}
            for secret in func.secrets.all():
                try:
                    secrets_dict[secret.key] = secret.get_value()
                except Exception as e:
                    logger.warning(f"Failed to decrypt secret {secret.id} for function {func.uuid}: {e}")

            # Add secrets to event context
            event_with_secrets = {
                **event_data,
                '__secrets__': secrets_dict
            }

            # Invoke function via Kubernetes service
            k8s_manager = KubernetesManager()
            invocation_result = k8s_manager.invoke_function(
                service_name=func.service_name,
                event=event_with_secrets,
                timeout_seconds=func.timeout_seconds,
                code=func.code,
                handler=func.handler
            )

            execution_time = (time.time() - start_time) * 1000

            # Update invocation record with results
            invocation.status = 'success' if invocation_result.get('success', True) else 'error'
            invocation.output_data = invocation_result.get('result')
            invocation.error_message = invocation_result.get('error', '')
            invocation.logs = invocation_result.get('logs', '')
            invocation.duration_ms = int(invocation_result.get('execution_time_ms', execution_time))
            invocation.memory_used_mb = invocation_result.get('memory_used_mb')
            invocation.completed_at = timezone.now()
            invocation.save()

            # Update function statistics
            func.invocation_count += 1
            func.last_invoked_at = timezone.now()
            func.save(update_fields=['invocation_count', 'last_invoked_at'])

            logger.info(f"[TASK] Invocation {invocation.id} completed successfully")

            return {
                'success': True,
                'invocation_id': invocation.id
            }

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000

            # Update invocation record with error
            invocation.status = 'error'
            invocation.error_message = str(e)
            invocation.duration_ms = int(execution_time)
            invocation.completed_at = timezone.now()
            invocation.save()

            logger.error(f"[TASK] Invocation {invocation.id} failed: {str(e)}", exc_info=True)

            return {
                'success': False,
                'error': str(e),
                'invocation_id': invocation.id
            }

    except Function.DoesNotExist:
        logger.error(f"[TASK] Function {function_uuid} not found")
        return {
            'success': False,
            'error': 'Function not found',
            'invocation_id': None
        }

    except Exception as e:
        logger.error(f"[TASK] Failed to invoke function {function_uuid}: {str(e)}", exc_info=True)
        return {
            'success': False,
            'error': str(e),
            'invocation_id': None
        }
