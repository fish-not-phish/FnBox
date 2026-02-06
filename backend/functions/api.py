from ninja import Router, Schema
from ninja.errors import HttpError
from typing import List, Any, Dict, Optional
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from django.utils.text import slugify
import logging
from .models import Function, FunctionInvocation, FunctionTrigger
from .schemas import FunctionListOut, FunctionDetailOut, FunctionCreateIn, FunctionUpdateIn, TriggerCreateIn, TriggerUpdateIn, TriggerOut, DeployOut, UndeployOut, DeploymentStatusOut, InvocationOut, InvocationListOut
from users.models import TeamMember, Team
from users.auth import session_mfa_auth
from depsets.models import Depset
from vault.models import Secret
from django.utils import timezone

logger = logging.getLogger(__name__)
router = Router(tags=["Functions"])


class ClusterLimitsOut(Schema):
    """Schema for cluster resource limits"""
    memory_mb: Dict[str, int]
    vcpu_count: Dict[str, float]
    timeout_seconds: Dict[str, int]


@router.get("/cluster-limits", response=ClusterLimitsOut)
def get_cluster_limits(request):
    """
    Get cluster resource limits for function configuration.
    These limits match the Kubernetes LimitRange and pod lifecycle constraints.
    """
    return ClusterLimitsOut(
        memory_mb={"min": 64, "max": 4096},
        vcpu_count={"min": 0.05, "max": 2},
        timeout_seconds={"min": 1, "max": 3600}
    )


@router.get("/", response=List[FunctionListOut])
def list_functions(request, team_id: int = None):
    """
    List all functions accessible to the current user.
    Optionally filter by team_id.
    Includes functions from user's teams and public functions.
    """
    if not request.user.is_authenticated:
        return []

    # Get user's team memberships
    user_teams = TeamMember.objects.filter(user=request.user).values_list('team_id', flat=True)

    # Build query filter
    query_filter = Q(team_id__in=user_teams) | Q(is_public=True)

    # If team_id is provided, filter by specific team
    if team_id is not None:
        # Verify user has access to this team
        if team_id not in user_teams:
            return []
        # Only show functions that belong to the selected team
        query_filter = Q(team_id=team_id)

    # Get functions
    functions = Function.objects.filter(query_filter).select_related('team', 'created_by').distinct()

    return [
        FunctionListOut(
            id=func.id,
            uuid=func.uuid,
            name=func.name,
            slug=func.slug,
            description=func.description,
            runtime=func.runtime,
            status=func.status,
            invocation_count=func.invocation_count,
            last_invoked_at=func.last_invoked_at,
            created_at=func.created_at,
        )
        for func in functions
    ]


# ============================================================================
# TRIGGER ENDPOINTS
# ============================================================================

@router.get("/triggers", response=List[TriggerOut])
def list_triggers(request, function_id: str = None, team_id: int = None):
    """
    List all triggers accessible to the current user.
    Optionally filter by function_id or team_id.
    """
    if not request.user.is_authenticated:
        return []

    # Get user's team memberships
    user_teams = TeamMember.objects.filter(user=request.user).values_list('team_id', flat=True)

    # Build query filter
    query_filter = Q(function__team_id__in=user_teams)

    # If team_id is provided, filter by specific team
    if team_id is not None:
        if team_id not in user_teams:
            return []
        query_filter = Q(function__team_id=team_id)

    # If function_id is provided, filter by specific function
    if function_id:
        func = get_object_or_404(Function, uuid=function_id)
        if func.team_id not in user_teams:
            raise HttpError(403, "You don't have access to this function")
        query_filter &= Q(function=func)

    triggers = FunctionTrigger.objects.filter(query_filter).select_related('function', 'created_by')

    return [
        TriggerOut(
            id=trigger.id,
            uuid=trigger.uuid,
            function_id=trigger.function.id,
            function_name=trigger.function.name,
            function_uuid=trigger.function.uuid,
            name=trigger.name,
            trigger_type=trigger.trigger_type,
            schedule=trigger.schedule,
            enabled=trigger.enabled,
            created_at=trigger.created_at,
            updated_at=trigger.updated_at,
            last_triggered_at=trigger.last_triggered_at,
            created_by_username=trigger.created_by.email if trigger.created_by else None,
        )
        for trigger in triggers
    ]


@router.post("/triggers", response=TriggerOut, auth=session_mfa_auth)
def create_trigger(request, function_id: str, payload: TriggerCreateIn):
    """
    Create a new trigger for a function.
    User must be a member of the function's team with editor, admin, or owner role.
    """
    # Get function and check access
    func = get_object_or_404(Function, uuid=function_id)

    membership = TeamMember.objects.filter(
        user=request.user,
        team=func.team
    ).first()

    if not membership:
        raise HttpError(403, "You don't have access to this function")

    if not membership.has_role('editor'):
        raise HttpError(403, "You need editor permissions to create triggers")

    # Validate trigger type
    if payload.trigger_type not in ['scheduled', 'http']:
        raise HttpError(400, "Invalid trigger type")

    # For scheduled triggers, schedule is required
    if payload.trigger_type == 'scheduled' and not payload.schedule:
        raise HttpError(400, "Schedule is required for scheduled triggers")

    # Create trigger
    trigger = FunctionTrigger.objects.create(
        function=func,
        name=payload.name,
        trigger_type=payload.trigger_type,
        schedule=payload.schedule,
        enabled=payload.enabled,
        created_by=request.user
    )

    return TriggerOut(
        id=trigger.id,
        uuid=trigger.uuid,
        function_id=func.id,
        function_name=func.name,
        function_uuid=func.uuid,
        name=trigger.name,
        trigger_type=trigger.trigger_type,
        schedule=trigger.schedule,
        enabled=trigger.enabled,
        created_at=trigger.created_at,
        updated_at=trigger.updated_at,
        last_triggered_at=trigger.last_triggered_at,
        created_by_username=trigger.created_by.username if trigger.created_by else None,
    )


@router.put("/triggers/{trigger_id}", response=TriggerOut, auth=session_mfa_auth)
def update_trigger(request, trigger_id: str, payload: TriggerUpdateIn):
    """
    Update a trigger.
    User must be a member of the function's team with editor, admin, or owner role.
    """
    trigger = get_object_or_404(FunctionTrigger, uuid=trigger_id)

    membership = TeamMember.objects.filter(
        user=request.user,
        team=trigger.function.team
    ).first()

    if not membership:
        raise HttpError(403, "You don't have access to this trigger")

    if not membership.has_role('editor'):
        raise HttpError(403, "You need editor permissions to update triggers")

    # Update fields if provided
    if payload.name is not None:
        trigger.name = payload.name
    if payload.schedule is not None:
        trigger.schedule = payload.schedule
    if payload.enabled is not None:
        trigger.enabled = payload.enabled

    trigger.save()

    return TriggerOut(
        id=trigger.id,
        uuid=trigger.uuid,
        function_id=trigger.function.id,
        function_name=trigger.function.name,
        function_uuid=trigger.function.uuid,
        name=trigger.name,
        trigger_type=trigger.trigger_type,
        schedule=trigger.schedule,
        enabled=trigger.enabled,
        created_at=trigger.created_at,
        updated_at=trigger.updated_at,
        last_triggered_at=trigger.last_triggered_at,
        created_by_username=trigger.created_by.username if trigger.created_by else None,
    )


@router.delete("/triggers/{trigger_id}", auth=session_mfa_auth)
def delete_trigger(request, trigger_id: str):
    """
    Delete a trigger.
    User must be a member of the function's team with editor, admin, or owner role.
    """
    trigger = get_object_or_404(FunctionTrigger, uuid=trigger_id)

    membership = TeamMember.objects.filter(
        user=request.user,
        team=trigger.function.team
    ).first()

    if not membership:
        raise HttpError(403, "You don't have access to this trigger")

    if not membership.has_role('editor'):
        raise HttpError(403, "You need editor permissions to delete triggers")

    trigger.delete()

    return {"success": True, "message": "Trigger deleted successfully"}

@router.get("/{function_id}", response=FunctionDetailOut)
def get_function(request, function_id: str):
    """
    Get detailed information about a specific function by UUID.
    User must be a member of the function's team or the function must be public.
    """
    func = get_object_or_404(Function, uuid=function_id)

    # Check access permissions
    if not func.is_public:
        if not request.user.is_authenticated:
            raise HttpError(403, "Authentication required")

        # Check if user is a member of the function's team
        membership = TeamMember.objects.filter(
            user=request.user,
            team=func.team
        ).first()

        if not membership:
            raise HttpError(403, "You don't have access to this function")

    # Count depsets, secrets, and triggers
    depset_count = func.depsets.count()
    secret_count = func.secrets.count()
    trigger_count = func.triggers.count()

    # Get IDs of attached depsets and secrets
    depset_ids = list(func.depsets.values_list('id', flat=True))
    secret_ids = list(func.secrets.values_list('id', flat=True))

    return FunctionDetailOut(
        id=func.id,
        uuid=func.uuid,
        name=func.name,
        slug=func.slug,
        description=func.description,
        team_id=func.team.id,
        team_name=func.team.name,
        code=func.code,
        handler=func.handler,
        runtime=func.runtime,
        memory_mb=func.memory_mb,
        vcpu_count=func.vcpu_count,
        timeout_seconds=func.timeout_seconds,
        status=func.status,
        is_public=func.is_public,
        invocation_count=func.invocation_count,
        last_invoked_at=func.last_invoked_at,
        last_deployed_at=func.last_deployed_at,
        created_at=func.created_at,
        updated_at=func.updated_at,
        created_by_username=func.created_by.email if func.created_by else None,
        depset_count=depset_count,
        secret_count=secret_count,
        depset_ids=depset_ids,
        secret_ids=secret_ids,
        trigger_count=trigger_count,
        deployment_name=func.deployment_name,
        service_name=func.service_name,
        k8s_namespace=func.k8s_namespace,
    )


@router.post("/", response=FunctionDetailOut, auth=session_mfa_auth)
def create_function(request, payload: FunctionCreateIn):
    """
    Create a new function.
    User must be a member of the team with editor, admin, or owner role.
    """
    # Check team access
    team = get_object_or_404(Team, id=payload.team_id)
    membership = TeamMember.objects.filter(user=request.user, team=team).first()

    if not membership:
        raise HttpError(403, "You don't have access to this team")

    # Check if user has required role
    if not membership.has_role('editor') and not membership.has_role('admin') and not membership.has_role('owner'):
        raise HttpError(403, "You need editor, admin, or owner role to create functions")

    # Generate slug if not provided
    if not payload.slug:
        base_slug = slugify(payload.name)
        slug = base_slug
        counter = 1
        while Function.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
    else:
        slug = slugify(payload.slug)
        if Function.objects.filter(slug=slug).exists():
            raise HttpError(400, "Slug already exists")

    # Create function
    func = Function.objects.create(
        name=payload.name,
        slug=slug,
        description=payload.description,
        code=payload.code,
        handler=payload.handler,
        runtime=payload.runtime,
        memory_mb=payload.memory_mb,
        vcpu_count=payload.vcpu_count,
        timeout_seconds=payload.timeout_seconds,
        status=payload.status,
        is_public=payload.is_public,
        team=team,
        created_by=request.user
    )

    # Add depsets
    if payload.depset_ids:
        depsets = Depset.objects.filter(
            Q(id__in=payload.depset_ids),
            Q(team=team) | Q(is_public=True)
        )
        func.depsets.set(depsets)

    # Add secrets
    if payload.secret_ids:
        secrets = Secret.objects.filter(
            id__in=payload.secret_ids,
            team=team
        )
        func.secrets.set(secrets)

    # Count depsets, secrets, and triggers
    depset_count = func.depsets.count()
    secret_count = func.secrets.count()
    trigger_count = func.triggers.count()

    # Get IDs of attached depsets and secrets
    depset_ids = list(func.depsets.values_list('id', flat=True))
    secret_ids = list(func.secrets.values_list('id', flat=True))

    return FunctionDetailOut(
        id=func.id,
        uuid=func.uuid,
        name=func.name,
        slug=func.slug,
        description=func.description,
        team_id=func.team.id,
        team_name=func.team.name,
        code=func.code,
        handler=func.handler,
        runtime=func.runtime,
        memory_mb=func.memory_mb,
        vcpu_count=func.vcpu_count,
        timeout_seconds=func.timeout_seconds,
        status=func.status,
        is_public=func.is_public,
        invocation_count=func.invocation_count,
        last_invoked_at=func.last_invoked_at,
        last_deployed_at=func.last_deployed_at,
        created_at=func.created_at,
        updated_at=func.updated_at,
        created_by_username=func.created_by.email if func.created_by else None,
        depset_count=depset_count,
        secret_count=secret_count,
        depset_ids=depset_ids,
        secret_ids=secret_ids,
        trigger_count=trigger_count,
        deployment_name=func.deployment_name,
        service_name=func.service_name,
        k8s_namespace=func.k8s_namespace,
    )


@router.get("/{function_id}/deployment-status", response=DeploymentStatusOut, auth=session_mfa_auth)
def get_deployment_status(request, function_id: str):
    """
    Get the current deployment status of a function.
    Used for polling during async deployment/undeployment.
    User must be a member of the function's team.
    """
    func = get_object_or_404(Function, uuid=function_id)

    # Check permissions
    membership = TeamMember.objects.filter(
        user=request.user,
        team=func.team
    ).first()

    if not membership:
        raise HttpError(403, "You don't have access to this function")

    return DeploymentStatusOut(
        status=func.status,
        deployment_name=func.deployment_name,
        service_name=func.service_name,
        k8s_namespace=func.k8s_namespace,
        last_deployed_at=func.last_deployed_at
    )


@router.put("/{function_id}", response=FunctionDetailOut, auth=session_mfa_auth)
def update_function(request, function_id: str, payload: FunctionUpdateIn):
    """
    Update an existing function by UUID.
    User must be a member of the function's team with editor, admin, or owner role.
    """
    func = get_object_or_404(Function, uuid=function_id)

    # Check team access
    membership = TeamMember.objects.filter(user=request.user, team=func.team).first()

    if not membership:
        raise HttpError(403, "You don't have access to this team")

    # Check if user has required role
    if not membership.has_role('editor') and not membership.has_role('admin') and not membership.has_role('owner'):
        raise HttpError(403, "You need editor, admin, or owner role to update functions")

    # Update fields if provided
    if payload.name is not None:
        func.name = payload.name
    if payload.description is not None:
        func.description = payload.description
    if payload.code is not None:
        func.code = payload.code
    if payload.handler is not None:
        func.handler = payload.handler
    if payload.runtime is not None:
        func.runtime = payload.runtime
    if payload.memory_mb is not None:
        func.memory_mb = payload.memory_mb
    if payload.vcpu_count is not None:
        func.vcpu_count = payload.vcpu_count
    if payload.timeout_seconds is not None:
        func.timeout_seconds = payload.timeout_seconds
    if payload.status is not None:
        func.status = payload.status
    if payload.is_public is not None:
        func.is_public = payload.is_public

    func.save()

    # Update depsets if provided
    if payload.depset_ids is not None:
        depsets = Depset.objects.filter(
            Q(id__in=payload.depset_ids),
            Q(team=func.team) | Q(is_public=True)
        )
        func.depsets.set(depsets)

    # Update secrets if provided
    if payload.secret_ids is not None:
        secrets = Secret.objects.filter(
            id__in=payload.secret_ids,
            team=func.team
        )
        func.secrets.set(secrets)

    # Count depsets, secrets, and triggers
    depset_count = func.depsets.count()
    secret_count = func.secrets.count()
    trigger_count = func.triggers.count()

    # Get IDs of attached depsets and secrets
    depset_ids = list(func.depsets.values_list('id', flat=True))
    secret_ids = list(func.secrets.values_list('id', flat=True))

    return FunctionDetailOut(
        id=func.id,
        uuid=func.uuid,
        name=func.name,
        slug=func.slug,
        description=func.description,
        team_id=func.team.id,
        team_name=func.team.name,
        code=func.code,
        handler=func.handler,
        runtime=func.runtime,
        memory_mb=func.memory_mb,
        vcpu_count=func.vcpu_count,
        timeout_seconds=func.timeout_seconds,
        status=func.status,
        is_public=func.is_public,
        invocation_count=func.invocation_count,
        last_invoked_at=func.last_invoked_at,
        last_deployed_at=func.last_deployed_at,
        created_at=func.created_at,
        updated_at=func.updated_at,
        created_by_username=func.created_by.email if func.created_by else None,
        depset_count=depset_count,
        secret_count=secret_count,
        depset_ids=depset_ids,
        secret_ids=secret_ids,
        trigger_count=trigger_count,
        deployment_name=func.deployment_name,
        service_name=func.service_name,
        k8s_namespace=func.k8s_namespace,
    )


class TestInvocationIn(Schema):
    """Schema for test invocation input"""
    event: Dict[str, Any] = {}


class TestInvocationOut(Schema):
    """Schema for test invocation output"""
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: float = 0


@router.post("/{function_id}/deploy", response=DeployOut, auth=session_mfa_auth)
def deploy_function(request, function_id: str):
    """
    Deploy a function to Kubernetes asynchronously.
    User must have editor permissions.
    """
    from functions.tasks import deploy_function_task

    func = get_object_or_404(Function, uuid=function_id)

    # Check permissions
    membership = TeamMember.objects.filter(
        user=request.user,
        team=func.team
    ).first()

    if not membership:
        raise HttpError(403, "You don't have access to this function")

    if not membership.has_role('editor'):
        raise HttpError(403, "You need editor permissions to deploy functions")

    # Check if already deployed or deploying
    if func.status == 'active' and func.deployment_name:
        raise HttpError(400, "Function is already deployed. Undeploy first to redeploy.")

    if func.status == 'deploying':
        raise HttpError(400, "Function is already being deployed. Please wait.")

    # Mark as deploying immediately
    func.status = 'deploying'
    func.save(update_fields=['status'])

    # Trigger async deployment task
    deploy_function_task.delay(str(func.uuid))

    return DeployOut(
        success=True,
        message="Function deployment started. Use the status endpoint to check progress.",
        deployment_name=None,
        service_name=None,
        status='deploying',
        deployed_at=timezone.now()
    )


@router.post("/{function_id}/undeploy", response=UndeployOut, auth=session_mfa_auth)
def undeploy_function(request, function_id: str):
    """
    Undeploy a function from Kubernetes asynchronously.
    User must have editor permissions.
    """
    from functions.tasks import undeploy_function_task

    func = get_object_or_404(Function, uuid=function_id)

    # Check permissions
    membership = TeamMember.objects.filter(
        user=request.user,
        team=func.team
    ).first()

    if not membership:
        raise HttpError(403, "You don't have access to this function")

    if not membership.has_role('editor'):
        raise HttpError(403, "You need editor permissions to undeploy functions")

    # Check if deployed or undeploying
    if not func.deployment_name and func.status != 'active':
        raise HttpError(400, "Function is not deployed")

    if func.status == 'undeploying':
        raise HttpError(400, "Function is already being undeployed. Please wait.")

    # Mark as undeploying immediately
    func.status = 'undeploying'
    func.save(update_fields=['status'])

    # Trigger async undeployment task
    undeploy_function_task.delay(str(func.uuid))

    return UndeployOut(
        success=True,
        message="Function undeployment started. Use the status endpoint to check progress."
    )


@router.post("/{function_id}/test", auth=session_mfa_auth)
def test_function(request, function_id: str, payload: TestInvocationIn):
    """
    Test invoke a function with provided event data by UUID (async via Celery).
    User must be a member of the function's team.
    Returns message - frontend should poll invocations endpoint for results.
    """
    from functions.tasks import test_function_task

    func = get_object_or_404(Function, uuid=function_id)

    # Check access permissions
    if not func.is_public:
        membership = TeamMember.objects.filter(
            user=request.user,
            team=func.team
        ).first()

        if not membership:
            raise HttpError(403, "You don't have access to this function")

    # Check if function is deployed
    if func.status != 'active' or not func.service_name:
        raise HttpError(400, "Function must be deployed before testing. Deploy the function first.")

    # Trigger async test task
    test_function_task.delay(str(func.uuid), payload.event)

    return {
        'success': True,
        'message': 'Test invocation started',
        'status': 'pending'
    }


@router.post("/{function_id}/invoke", response=TestInvocationOut)
def invoke_function_sync(request, function_id: str, payload: TestInvocationIn):
    """
    Synchronously invoke a function and return the result immediately.
    This is the main invocation endpoint that returns the actual function output as JSON.

    No authentication required - functions can be called via public URL.
    For private functions, check is_public flag.

    Returns the actual function output data.
    """
    import time
    import uuid as uuid_module
    from functions.kubernetes import KubernetesManager
    from functions.models import FunctionInvocation

    func = get_object_or_404(Function, uuid=function_id)

    # Check if function is public
    if not func.is_public:
        raise HttpError(403, "This function is private and cannot be invoked via public URL")

    # Check if function is deployed
    if func.status != 'active' or not func.service_name:
        raise HttpError(400, "Function is not deployed")

    start_time = time.time()
    request_id = f"req-{uuid_module.uuid4().hex[:12]}"

    # Create invocation record
    invocation = FunctionInvocation.objects.create(
        function=func,
        request_id=request_id,
        status='pending',
        input_data=payload.event,
        started_at=timezone.now()
    )

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
            **payload.event,
            '__secrets__': secrets_dict
        }

        # Invoke function directly via Kubernetes service (synchronous)
        k8s_manager = KubernetesManager()
        result = k8s_manager.invoke_function(
            service_name=func.service_name,
            event=event_with_secrets,
            timeout_seconds=func.timeout_seconds,
            code=func.code,
            handler=func.handler
        )

        execution_time = (time.time() - start_time) * 1000

        # Update invocation record with results
        invocation.status = 'success' if result.get('success', True) else 'error'
        invocation.output_data = result.get('result')
        invocation.error_message = result.get('error', '')
        invocation.logs = result.get('logs', '')
        invocation.duration_ms = int(result.get('execution_time_ms', execution_time))
        invocation.memory_used_mb = result.get('memory_used_mb')
        invocation.completed_at = timezone.now()
        invocation.save()

        # Update function statistics
        func.invocation_count += 1
        func.last_invoked_at = timezone.now()
        func.save(update_fields=['invocation_count', 'last_invoked_at'])

        # Return the actual function output
        if result.get('success', True):
            return {
                'success': True,
                'result': result.get('result'),
                'error': None,
                'execution_time_ms': result.get('execution_time_ms', 0)
            }
        else:
            return {
                'success': False,
                'result': None,
                'error': result.get('error', 'Unknown error'),
                'execution_time_ms': result.get('execution_time_ms', 0)
            }

    except Exception as e:
        execution_time = (time.time() - start_time) * 1000

        # Update invocation record with error
        invocation.status = 'error'
        invocation.error_message = str(e)
        invocation.duration_ms = int(execution_time)
        invocation.completed_at = timezone.now()
        invocation.save()

        logger.error(f"Failed to invoke function {function_id}: {e}")
        return {
            'success': False,
            'result': None,
            'error': str(e),
            'execution_time_ms': 0
        }


@router.get("/{function_id}/invocations", response=List[InvocationOut], auth=session_mfa_auth)
def get_function_invocations(request, function_id: str, limit: int = 50):
    """
    Get invocation logs for a function.
    Returns the most recent invocations with their logs.
    """
    func = get_object_or_404(Function, uuid=function_id)

    # Check access permissions
    if not func.is_public:
        membership = TeamMember.objects.filter(
            user=request.user,
            team=func.team
        ).first()

        if not membership:
            raise HttpError(403, "You don't have access to this function")

    # Get recent invocations
    invocations = FunctionInvocation.objects.filter(
        function=func
    ).order_by('-created_at')[:limit]

    return [
        InvocationOut(
            id=inv.id,
            request_id=inv.request_id,
            status=inv.status,
            input_data=inv.input_data,
            output_data=inv.output_data,
            error_message=inv.error_message or "",
            duration_ms=inv.duration_ms,
            memory_used_mb=inv.memory_used_mb,
            logs=inv.logs or "",
            created_at=inv.created_at,
            started_at=inv.started_at,
            completed_at=inv.completed_at,
        )
        for inv in invocations
    ]



@router.delete("/{function_id}", auth=session_mfa_auth)
def delete_function(request, function_id: str):
    """
    Delete a function permanently.
    Function must be undeployed first.
    """
    user = request.auth
    function = get_object_or_404(Function, uuid=function_id)

    # Check if user has access to this function's team
    if not TeamMember.objects.filter(team=function.team, user=user).exists():
        raise HttpError(403, "You don't have permission to delete this function")

    # Check if function is deployed
    if function.status not in ['draft', 'inactive', 'error']:
        raise HttpError(400, "Function must be undeployed before deletion")

    # Delete the function (cascading deletes will handle related objects)
    function_name = function.name
    function.delete()

    logger.info(f"Function '{function_name}' (UUID: {function_id}) deleted by user {user.username}")

    return {"success": True, "message": f"Function '{function_name}' deleted successfully"}


@router.get("/invocations/team/{team_id}", response=List[InvocationListOut], auth=session_mfa_auth)
def get_team_invocations(request, team_id: int, limit: int = 100):
    """
    Get all invocation logs for a team across all functions.
    Returns the most recent invocations with function details.
    """
    user = request.auth
    team = get_object_or_404(Team, id=team_id)

    # Check if user is a member of this team
    if not TeamMember.objects.filter(team=team, user=user).exists():
        raise HttpError(403, "You don't have access to this team")

    # Get recent invocations for all functions in the team
    invocations = FunctionInvocation.objects.filter(
        function__team=team
    ).select_related('function').order_by('-created_at')[:limit]

    return [
        InvocationListOut(
            id=inv.id,
            request_id=inv.request_id,
            status=inv.status,
            function_id=inv.function.id,
            function_uuid=inv.function.uuid,
            function_name=inv.function.name,
            input_data=inv.input_data,
            output_data=inv.output_data,
            error_message=inv.error_message or "",
            duration_ms=inv.duration_ms,
            memory_used_mb=inv.memory_used_mb,
            logs=inv.logs or "",
            created_at=inv.created_at,
            started_at=inv.started_at,
            completed_at=inv.completed_at,
        )
        for inv in invocations
    ]
