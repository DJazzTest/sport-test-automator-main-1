# Quick Start Guide

## For New Users (Windows, Mac, or Linux)

### Step 1: Install Node.js
If you don't have Node.js installed, download it from [nodejs.org](https://nodejs.org/) (version 18 or higher).

### Step 2: Clone/Download the Repository
Get the project files on your computer.

### Step 3: Open Terminal/Command Prompt
- **Windows**: Press `Win + R`, type `cmd`, press Enter
- **Mac**: Press `Cmd + Space`, type `Terminal`, press Enter
- **Linux**: Open your terminal application

### Step 4: Navigate to Project Folder
```bash
cd /path/to/sport-test-automator-main-1
```

### Step 5: One-Time Setup
```bash
npm run test:setup
```
This installs all dependencies and Playwright browsers (takes a few minutes).

### Step 6: Run Tests (One Line!)
```bash
npm run test:all
```

That's it! The tests will run automatically.

## Common Commands

| Command | What It Does |
|---------|-------------|
| `npm run test:setup` | First-time setup (install dependencies) |
| `npm run test:all` | Run all tests |
| `npm run test:cricket` | Run only Cricket tests |
| `npm run test:football` | Run only Football tests |
| `npm run test:tennis` | Run only Tennis tests |
| `npm run test:nfl` | Run only NFL tests |
| `npm run test:all -- --headed` | Run tests with browser visible (for debugging) |

## Troubleshooting

**Problem**: `npm: command not found`
- **Solution**: Install Node.js from [nodejs.org](https://nodejs.org/)

**Problem**: Tests fail with browser errors
- **Solution**: Run `npm run test:setup` again to reinstall browsers

**Problem**: Permission errors on Mac/Linux
- **Solution**: You may need to run with `sudo` (not recommended) or fix permissions

## Need Help?

Check the main [README.md](README.md) for more detailed information.
