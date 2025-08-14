#!/bin/bash
# Git operations script

# Set up Git configuration (replace with your actual name and email)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Create and switch to a new branch (replace 'branch-name' with your desired branch name)
git checkout -b branch-name

# Or if the branch already exists, switch to it
# git checkout branch-name

# Stage all changes
git add .

# Commit changes
git commit -m "Add new changes"

# Push to remote repository (assuming 'origin' is your remote)
git push origin branch-name

echo "Git operations completed!"