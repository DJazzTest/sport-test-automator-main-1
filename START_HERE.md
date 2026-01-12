# 🚀 START HERE - Run Tests in 3 Simple Steps

## For Windows Users

### Step 1: Open Command Prompt
- Press **Windows key**, type `cmd`, press **Enter**

### Step 2: Go to the project folder
Copy and paste this (press Enter after):
```cmd
cd Desktop\sport-test-automator-main-1
```

### Step 3: Run setup (first time only) OR Run tests

**Option A: Use the setup script (EASIEST)**
```cmd
setup.bat
```
Then after setup is done, run:
```cmd
run-tests.bat
```

**Option B: Use commands directly**
**First time ever:**
```cmd
npm run test:setup
```

**Every other time:**
```cmd
npm run test:all
```

---

## For Mac Users

### Step 1: Open Terminal
- Press **Command + Space**, type `Terminal`, press **Enter**

### Step 2: Go to the project folder
Copy and paste this (press Enter after):

**If the folder is on Desktop:**
```bash
cd ~/Desktop/sport-test-automator-main-1
```

**If the folder is in Documents:**
```bash
cd ~/Documents/sport-test-automator-main-1
```

**Not sure where it is?** Type `ls ~/Desktop` and `ls ~/Documents` to check both locations.

### Step 3: Run setup (first time only) OR Run tests

**Option A: Use the setup script (EASIEST)**
```bash
./setup.sh
```
Then after setup is done, run:
```bash
./run-tests.sh
```

**⚠️ IMPORTANT:** On Mac, you MUST type `./` before script names!

**Option B: Use commands directly**
**First time ever:**
```bash
npm run test:setup
```

**Every other time:**
```bash
npm run test:all
```

---

## That's It! 🎉

The tests will run automatically. Wait for them to finish (5-10 minutes).

---

## Run Just One Test (Like F1)

**Windows:**
```cmd
run-f1-test.bat
```

**Mac:**
```bash
./run-f1-test.sh
```

**Important for Mac:** You MUST use `./` before the script name!

**Or use the menu to choose:**
- Windows: `run-single-test.bat`
- Mac: `./run-single-test.sh` (remember the `./`!)

**Or use commands directly:**
```bash
npm run test:planetf1    # F1 test only
npm run test:cricket     # Cricket only
npm run test:football    # Football only
npm run test:tennis      # Tennis only
npm run test:nfl         # NFL only
```

---

## Need More Help?

See [SIMPLE_SETUP.md](SIMPLE_SETUP.md) for detailed instructions.
