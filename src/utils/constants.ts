// Files and directories to ignore
export const IGNORE_PATTERNS = new Set([
  'node_modules', '.git', '__pycache__', 'venv', '.venv', 'build', 'dist', 'target',
  '.idea', '.vscode', '.DS_Store', 'Thumbs.db', 'desktop.ini',
  '*.pyc', '*.log', '*.tmp', '*.swp', '*.o',
  '.pytest_cache'
]);