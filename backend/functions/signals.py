"""
Django signals for managing Celery Beat scheduled tasks via django-celery-beat.
"""
import json
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django_celery_beat.models import CrontabSchedule, PeriodicTask
from functions.models import FunctionTrigger, Function

logger = logging.getLogger(__name__)


def parse_cron_expression(cron_str):
    """
    Parse a cron expression string into django-celery-beat CrontabSchedule fields.

    Cron format: minute hour day_of_month month_of_year day_of_week
    Example: "*/5 * * * *" = every 5 minutes
    Example: "0 0 * * 0" = every Sunday at midnight

    Returns:
        dict with keys: minute, hour, day_of_month, month_of_year, day_of_week
    """
    parts = cron_str.strip().split()

    if len(parts) != 5:
        raise ValueError(f"Invalid cron expression: {cron_str}. Must have 5 parts.")

    return {
        'minute': parts[0],
        'hour': parts[1],
        'day_of_month': parts[2],
        'month_of_year': parts[3],
        'day_of_week': parts[4],
    }


def get_or_create_crontab_schedule(cron_str):
    """
    Get or create a CrontabSchedule from a cron expression string.

    Args:
        cron_str: Cron expression (e.g., "*/5 * * * *")

    Returns:
        CrontabSchedule instance
    """
    cron_parts = parse_cron_expression(cron_str)
    schedule, created = CrontabSchedule.objects.get_or_create(**cron_parts)

    if created:
        logger.info(f"Created new CrontabSchedule: {cron_str}")

    return schedule


@receiver(post_save, sender=FunctionTrigger)
def manage_scheduled_trigger(sender, instance, created, **kwargs):
    """
    Create or update a PeriodicTask when a FunctionTrigger is saved.

    - Creates a new PeriodicTask for enabled scheduled triggers
    - Updates existing PeriodicTask when trigger is modified
    - Deletes PeriodicTask when trigger is disabled or changed to non-scheduled
    """
    # Unique task name based on trigger UUID
    task_name = f"trigger-{instance.uuid}"

    try:
        # If it's a scheduled trigger and enabled, create/update the PeriodicTask
        if instance.trigger_type == 'scheduled' and instance.enabled and instance.schedule:
            # Parse the cron expression
            try:
                crontab_schedule = get_or_create_crontab_schedule(instance.schedule)
            except ValueError as e:
                logger.error(f"Failed to parse cron expression for trigger {instance.uuid}: {e}")
                return

            # Prepare the task arguments
            # Note: request_id is not included - let invoke_function_task generate a unique one per invocation
            task_kwargs = {
                'function_uuid': str(instance.function.uuid),
                'event_data': {
                    'trigger_type': 'scheduled',
                    'trigger_id': str(instance.uuid),
                    'trigger_name': instance.name,
                    'cron_expression': instance.schedule
                }
            }

            # Only enable the PeriodicTask if the function is deployed and active
            task_enabled = instance.function.status == 'active'

            # Create or update the PeriodicTask
            periodic_task, task_created = PeriodicTask.objects.update_or_create(
                name=task_name,
                defaults={
                    'crontab': crontab_schedule,
                    'task': 'functions.tasks.invoke_function_task',
                    'kwargs': json.dumps(task_kwargs),
                    'enabled': task_enabled,
                    'description': f"Scheduled trigger: {instance.name} for function {instance.function.name}"
                }
            )

            if task_created:
                status_msg = "enabled" if task_enabled else "disabled (function not active)"
                logger.info(f"Created PeriodicTask '{task_name}' for trigger {instance.uuid} ({status_msg})")
            else:
                status_msg = "enabled" if task_enabled else "disabled (function not active)"
                logger.info(f"Updated PeriodicTask '{task_name}' for trigger {instance.uuid} ({status_msg})")

        else:
            # If trigger is not scheduled or not enabled, delete any existing PeriodicTask
            deleted_count, _ = PeriodicTask.objects.filter(name=task_name).delete()

            if deleted_count > 0:
                logger.info(f"Deleted PeriodicTask '{task_name}' for trigger {instance.uuid} (disabled or non-scheduled)")

    except Exception as e:
        logger.error(f"Failed to manage PeriodicTask for trigger {instance.uuid}: {e}", exc_info=True)


@receiver(post_delete, sender=FunctionTrigger)
def delete_scheduled_trigger(sender, instance, **kwargs):
    """
    Delete the corresponding PeriodicTask when a FunctionTrigger is deleted.
    """
    task_name = f"trigger-{instance.uuid}"

    try:
        deleted_count, _ = PeriodicTask.objects.filter(name=task_name).delete()

        if deleted_count > 0:
            logger.info(f"Deleted PeriodicTask '{task_name}' for deleted trigger {instance.uuid}")

    except Exception as e:
        logger.error(f"Failed to delete PeriodicTask for trigger {instance.uuid}: {e}", exc_info=True)


@receiver(post_save, sender=Function)
def disable_triggers_on_undeploy(sender, instance, created, **kwargs):
    """
    Automatically disable PeriodicTasks when a function is undeployed.

    - When function becomes non-active (undeployed): disable all triggers
    - When function becomes active (deployed): do nothing (user must manually enable triggers)

    This asymmetric behavior ensures safety - triggers won't fire on non-existent functions,
    but won't automatically resume without explicit user action.
    """
    # Skip if this is a new function
    if created:
        return

    # Only act when function is NOT active (undeployed, draft, error, etc.)
    if instance.status == 'active':
        return

    try:
        # Get all scheduled triggers for this function
        triggers = FunctionTrigger.objects.filter(
            function=instance,
            trigger_type='scheduled'
        )

        if not triggers.exists():
            return

        updated_count = 0

        for trigger in triggers:
            task_name = f"trigger-{trigger.uuid}"

            try:
                # Disable both the FunctionTrigger and PeriodicTask
                if trigger.enabled:
                    trigger.enabled = False
                    trigger.save(update_fields=['enabled'])
                    updated_count += 1
                    logger.info(f"Disabled trigger '{trigger.name}' and PeriodicTask '{task_name}' (function undeployed, status: {instance.status})")

                # Also ensure PeriodicTask is disabled
                PeriodicTask.objects.filter(name=task_name).update(enabled=False)

            except Exception as e:
                logger.error(f"Failed to disable trigger {trigger.uuid}: {e}")
                continue

        if updated_count > 0:
            logger.info(f"Auto-disabled {updated_count} PeriodicTasks for undeployed function {instance.name}")

    except Exception as e:
        logger.error(f"Failed to disable triggers for function {instance.uuid}: {e}", exc_info=True)
