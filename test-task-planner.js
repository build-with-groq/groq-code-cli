import { planTasks } from './dist/tools/task-planner-tool.js';

// Test the planTasks function
async function testPlanTasks() {
  try {
    console.log('Testing planTasks function...');
    
    const result = await planTasks('Create a React todo app with authentication');
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('Task planning successful!');
    } else {
      console.log('Task planning failed:', result.error);
    }
  } catch (error) {
    console.error('Error testing planTasks:', error);
  }
}

testPlanTasks();