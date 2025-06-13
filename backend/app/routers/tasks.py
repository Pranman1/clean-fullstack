from fastapi import APIRouter, HTTPException
from app.models.task import Task, TaskCreate
from typing import List
from datetime import datetime
import time

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Simulate a database with a list
TASKS_DB = []
task_id_counter = 1

@router.get("/", response_model=List[Task])
async def get_tasks():
    return TASKS_DB

@router.post("/", response_model=Task)
async def create_task(task: TaskCreate):
    global task_id_counter
    
    new_task = Task(
        id=task_id_counter,
        created_at=datetime.now(),
        **task.dict()
    )
    
    TASKS_DB.append(new_task)
    task_id_counter += 1
    
    return new_task

@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: int):
    for task in TASKS_DB:
        if task.id == task_id:
            return task
    
    raise HTTPException(status_code=404, detail="Task not found")

@router.put("/{task_id}", response_model=Task)
async def update_task(task_id: int, task_update: TaskCreate):
    for i, task in enumerate(TASKS_DB):
        if task.id == task_id:
            updated_task = Task(
                id=task_id,
                created_at=task.created_at,
                **task_update.dict()
            )
            TASKS_DB[i] = updated_task
            return updated_task
    
    raise HTTPException(status_code=404, detail="Task not found")

@router.delete("/{task_id}")
async def delete_task(task_id: int):
    for i, task in enumerate(TASKS_DB):
        if task.id == task_id:
            TASKS_DB.pop(i)
            return {"message": "Task deleted successfully"}
    
    raise HTTPException(status_code=404, detail="Task not found") 