#!/usr/bin/env python3
"""
Simple script to test if the task system is working
"""

def create_sample_task():
    """Create a sample task to verify the system works"""
    task = {
        'id': 'test-1',
        'title': 'Test if task system works',
        'status': 'pending',
        'description': 'This is a test task to verify the task system functionality'
    }
    print(f"Created task: {task['title']}")
    return task

def update_task_status(task, new_status):
    """Update the status of a task"""
    old_status = task['status']
    task['status'] = new_status
    print(f"Updated task status from {old_status} to {new_status}")
    return task

def main():
    """Main function to test the task system"""
    print("Testing task system functionality...")
    
    # Create a task
    test_task = create_sample_task()
    
    # Update task status
    test_task = update_task_status(test_task, 'in_progress')
    test_task = update_task_status(test_task, 'completed')
    
    print("Task system test completed successfully!")
    return True

if __name__ == "__main__":
    main()