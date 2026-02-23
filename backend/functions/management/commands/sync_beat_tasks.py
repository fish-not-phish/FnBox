"""
Management command to sync Celery Beat periodic tasks from settings.

This command creates or updates PeriodicTask entries in the database
based on environment-driven settings. Run this during deployment to
register scheduled tasks.

Usage:
    python manage.py sync_beat_tasks
"""
import json
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django_celery_beat.models import PeriodicTask, IntervalSchedule

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync Celery Beat PeriodicTasks from settings'

    def handle(self, *args, **options):
        self.stdout.write('Syncing Celery Beat PeriodicTasks...')

        # Kind image reload task
        interval_days = getattr(settings, 'KIND_IMAGE_RELOAD_INTERVAL_DAYS', 1)
        task_name = 'reload-kind-images'
        celery_task = 'functions.tasks.reload_kind_images_task'

        if interval_days <= 0:
            deleted, _ = PeriodicTask.objects.filter(name=task_name).delete()
            self.stdout.write(self.style.WARNING(
                f'{task_name}: disabled (interval_days={interval_days}). Deleted={deleted}'
            ))
        else:
            seconds = int(interval_days) * 24 * 60 * 60

            schedule, _ = IntervalSchedule.objects.get_or_create(
                every=seconds,
                period=IntervalSchedule.SECONDS,
            )
            schedule_desc = f'every {interval_days} day(s)'

            periodic, created = PeriodicTask.objects.update_or_create(
                name=task_name,
                defaults={
                    'task': celery_task,
                    'interval': schedule,
                    'enabled': True,
                    'kwargs': json.dumps({}),
                },
            )
            action = 'Created' if created else 'Updated'
            self.stdout.write(self.style.SUCCESS(
                f'{action} {task_name}: {schedule_desc} -> {celery_task}'
            ))

        self.stdout.write(self.style.SUCCESS('Done syncing PeriodicTasks.'))