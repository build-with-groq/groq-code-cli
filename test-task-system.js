// Simple test to verify the task system is working
import { executeTool } from './dist/tools/tools.js';

async function testTaskSystem() {
  console.log('Testing Task System...\n');
  
  // Test 1: Plan tasks automatically
  console.log('1. Testing plan_tasks:');
  const planResult = await executeTool('plan_tasks', { 
    user_query: 'Build a React todo app with authentication' 
  });
  console.log('Plan result:', planResult.success ? '✓ Success' : '✗ Failed');
  if (planResult.content) {
    console.log('Generated tasks:', planResult.content.tasks.length);
    planResult.content.tasks.forEach(task => {
      console.log(`  - ${task.id}: ${task.description} [${task.status}]`);
    });
  }
  console.log();
  
  // Test 2: Create custom tasks
  console.log('2. Testing create_tasks:');
  const createResult = await executeTool('create_tasks', {
    user_query: 'Build a simple counter app',
    tasks: [
      { id: '1', description: 'Create HTML structure', status: 'pending' },
      { id: '2', description: 'Add CSS styling', status: 'pending' },
      { id: '3', description: 'Implement JavaScript logic', status: 'pending' }
    ]
  });
  console.log('Create result:', createResult.success ? '✓ Success' : '✗ Failed');
  if (createResult.content) {
    console.log('Created tasks:', createResult.content.tasks.length);
  }
  console.log();
  
  // Test 3: Update task status
  console.log('3. Testing update_tasks:');
  const updateResult = await executeTool('update_tasks', {
    task_updates: [
      { id: '1', status: 'completed', notes: 'HTML structure complete' },
      { id: '2', status: 'in_progress' }
    ]
  });
  console.log('Update result:', updateResult.success ? '✓ Success' : '✗ Failed');
  if (updateResult.content) {
    console.log('Updated task list:');
    updateResult.content.tasks.forEach(task => {
      console.log(`  - ${task.id}: ${task.description} [${task.status}]${task.notes ? ' - ' + task.notes : ''}`);
    });
  }
  console.log();
  
  console.log('Task system test complete!');
}

testTaskSystem().catch(console.error);
