#!/bin/bash
# Script to commit and push all changes

echo "Adding all changes..."
git add .

echo "Committing changes..."
git commit -m "feat: Add task system implementation and Cerebras integration improvements"

echo "Pushing to remote repository..."
git push origin feature/cerebras-integration

echo "Done!"