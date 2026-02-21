"""
Background Task Management for Long-Running Operations
Handles bulk uploads and other time-consuming tasks
"""

import uuid
import asyncio
import threading
import logging
from typing import Dict, Any, Optional, Callable
from datetime import datetime, timezone
from enum import Enum

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskProgress:
    """Tracks progress of a background task"""
    
    def __init__(self, task_id: str, total: int = 0):
        self.task_id = task_id
        self.status = TaskStatus.PENDING
        self.total = total
        self.processed = 0
        self.success_count = 0
        self.failed_count = 0
        self.errors = []
        self.started_at = None
        self.completed_at = None
        self.result = None
        self.error_message = None
    
    def start(self):
        """Mark task as started"""
        self.status = TaskStatus.PROCESSING
        self.started_at = datetime.now(timezone.utc)
    
    def update(self, processed: int = None, success: int = None, failed: int = None, 
               success_count: int = None, failed_count: int = None, errors: list = None):
        """Update progress"""
        if processed is not None:
            self.processed = processed
        # Support both parameter names for backward compatibility
        if success_count is not None:
            self.success_count = success_count
        elif success is not None:
            self.success_count = success
        if failed_count is not None:
            self.failed_count = failed_count
        elif failed is not None:
            self.failed_count = failed
        if errors:
            self.errors.extend(errors)
    
    def complete(self, result: Any = None):
        """Mark task as completed"""
        self.status = TaskStatus.COMPLETED
        self.completed_at = datetime.now(timezone.utc)
        self.result = result
    
    def fail(self, error_message: str):
        """Mark task as failed"""
        self.status = TaskStatus.FAILED
        self.completed_at = datetime.now(timezone.utc)
        self.error_message = error_message
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response"""
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "total": self.total,
            "processed": self.processed,
            "success_count": self.success_count,
            "failed_count": self.failed_count,
            "errors": self.errors[:100],  # Limit to first 100 errors
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "result": self.result,
            "error_message": self.error_message,
            "progress_percentage": round((self.processed / self.total * 100) if self.total > 0 else 0, 2)
        }


class BackgroundTaskManager:
    """Manages background tasks with progress tracking"""
    
    def __init__(self):
        self.tasks: Dict[str, TaskProgress] = {}
        self._lock = threading.Lock()
        self._cleanup_interval = 3600  # Clean up old tasks after 1 hour
        self._start_cleanup_task()
    
    def create_task(self, total: int = 0) -> str:
        """Create a new task and return its ID"""
        task_id = str(uuid.uuid4())
        with self._lock:
            self.tasks[task_id] = TaskProgress(task_id, total)
        return task_id
    
    def get_task(self, task_id: str) -> Optional[TaskProgress]:
        """Get task progress by ID"""
        with self._lock:
            return self.tasks.get(task_id)
    
    def update_task(self, task_id: str, **kwargs):
        """Update task progress"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.update(**kwargs)
    
    def start_task(self, task_id: str):
        """Mark task as started"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.start()
    
    def complete_task(self, task_id: str, result: Any = None, success_count: int = None, 
                     failed_count: int = None, errors: list = None):
        """Mark task as completed"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                if success_count is not None:
                    task.success_count = success_count
                if failed_count is not None:
                    task.failed_count = failed_count
                if errors:
                    task.errors = errors
                task.complete(result)
    
    def fail_task(self, task_id: str, error_message: str):
        """Mark task as failed"""
        with self._lock:
            task = self.tasks.get(task_id)
            if task:
                task.fail(error_message)
    
    def cleanup_old_tasks(self):
        """Remove completed/failed tasks older than 1 hour"""
        with self._lock:
            now = datetime.now(timezone.utc)
            to_remove = []
            for task_id, task in self.tasks.items():
                if task.completed_at:
                    age = (now - task.completed_at).total_seconds()
                    if age > self._cleanup_interval:
                        to_remove.append(task_id)
            
            for task_id in to_remove:
                del self.tasks[task_id]
    
    def _start_cleanup_task(self):
        """Start background thread to clean up old tasks"""
        def cleanup_loop():
            while True:
                try:
                    self.cleanup_old_tasks()
                except Exception as e:
                    logger.exception("Error in cleanup task")
                # Sleep for 5 minutes between cleanups
                threading.Event().wait(300)
        
        cleanup_thread = threading.Thread(target=cleanup_loop, daemon=True)
        cleanup_thread.start()
    
    async def run_task_async(self, task_id: str, func: Callable, *args, **kwargs):
        """Run a task asynchronously in a thread pool"""
        loop = asyncio.get_event_loop()
        
        def run_in_thread():
            try:
                self.start_task(task_id)
                result = func(task_id, *args, **kwargs)
                
                # Extract counts from result if it's a dict
                if isinstance(result, dict):
                    self.complete_task(
                        task_id, 
                        result=result,
                        success_count=result.get('success_count', 0),
                        failed_count=result.get('failed_count', 0),
                        errors=result.get('failed_records', [])
                    )
                else:
                    self.complete_task(task_id, result)
            except Exception as e:
                logger.exception("Error in background task %s", task_id)
                self.fail_task(task_id, str(e))
        
        # Run in thread pool executor to avoid blocking
        await loop.run_in_executor(None, run_in_thread)


# Global task manager instance
task_manager = BackgroundTaskManager()
