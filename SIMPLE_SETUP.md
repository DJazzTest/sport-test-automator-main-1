# Simple Setup Guide - For Non-Technical Users

## 🎯 What You Need
- A computer (Windows or Mac)
- Internet connection

---

## 📥 Step 1: Get the Project Files

### Option A: Download from Git
1. Go to the project on Git (ask your team lead for the link)
2. Click the green "Code" button
3. Click "Download ZIP"
4. Extract the ZIP file to your Desktop
5. You should see a folder called `sport-test-automator-main-1` on your Desktop

### Option B: If someone gave you the files
- Make sure the folder is on your Desktop

---

## 🖥️ Step 2: Open Terminal/Command Prompt

### On Windows:
1. Press the **Windows key** (or click Start)
2. Type: `cmd`
3. Press **Enter**
4. A black window will open - this is Command Prompt

### On Mac:
1. Press **Command + Space** (or click the magnifying glass)
2. Type: `Terminal`
3. Press **Enter**
4. A window will open - this is Terminal

---

## 📂 Step 3: Go to the Project Folder

**Copy and paste this command** (then press Enter):

### On Windows:
```cmd
cd Desktop\sport-test-automator-main-1
```

**If not on Desktop, try:**
```cmd
cd Documents\sport-test-automator-main-1
```

### On Mac:
```bash
cd ~/Desktop/sport-test-automator-main-1
```

**If not on Desktop, try:**
```bash
cd ~/Documents/sport-test-automator-main-1
```

**Not sure where the folder is?**
- Windows: Type `dir Desktop` and `dir Documents` to check both
- Mac: Type `ls ~/Desktop` and `ls ~/Documents` to check both

**💡 Tip**: After typing `cd Desktop` (Windows) or `cd ~/Desktop` (Mac), you can type `dir` (Windows) or `ls` (Mac) to see all folders and copy the exact name.

---

## ⚙️ Step 4: First-Time Setup (Do This Once)

**EASIEST WAY - Use the setup script:**

### On Windows:
```cmd
setup.bat
```

### On Mac:
```bash
chmod +x setup.sh
./setup.sh
```

**OR use the command directly:**
```bash
npm run test:setup
```

⏳ **Wait for it to finish** - This takes 3-5 minutes. You'll see lots of text scrolling. That's normal!

✅ **When it's done**, you'll see something like "added X packages" or "Setup Complete!" and you can move to Step 5.

---

## ▶️ Step 5: Run the Tests

**EASIEST WAY - Use the run script:**

### On Windows:
```cmd
run-tests.bat
```

### On Mac:
```bash
chmod +x run-tests.sh
./run-tests.sh
```

**OR use the command directly:**
```bash
npm run test:all
```

⏳ **Wait for tests to run** - This takes 5-10 minutes depending on how many tests there are.

✅ **When it's done**, you'll see a summary showing which tests passed or failed.

---

## 🎯 Running Specific Tests

### Easy Way - Use Scripts:

**Windows:**
- Run F1 test: Double-click `run-f1-test.bat` OR type `run-f1-test.bat` in Command Prompt
- Choose from menu: Double-click `run-single-test.bat` OR type `run-single-test.bat`

**Mac:**
- Run F1 test: Type `./run-f1-test.sh` (note the `./` at the start!)
- Choose from menu: Type `./run-single-test.sh` (note the `./` at the start!)

**⚠️ Mac Users:** You MUST type `./` before the script name, or it won't work!

### Or Use Commands Directly:

**Popular Tests:**
```bash
npm run test:cricket     # Cricket tests
npm run test:football    # Football tests
npm run test:tennis      # Tennis tests
npm run test:nfl         # NFL tests
npm run test:planetf1    # PlanetF1 test
```

**Other Tests:**
```bash
npm run test:starsports:cricket      # StarSports Cricket
npm run test:starsports:football     # StarSports Football
npm run test:starsports:tennis       # StarSports Tennis
npm run test:starsports:nfl          # StarSports NFL
npm run test:vodacom:comprehensive   # Vodacom Comprehensive
npm run test:vodacom:quick           # Vodacom Quick
```

**See all available tests**: Check [TEST_COMMANDS.md](TEST_COMMANDS.md)

---

## ❓ Troubleshooting

### Problem: "npm is not recognized" or "command not found"
**Solution:** You need to install Node.js first:
1. Go to: https://nodejs.org/
2. Download the version that says "LTS" (Long Term Support)
3. Install it (just click Next, Next, Next)
4. **Close and reopen** your Command Prompt/Terminal
5. Try Step 4 again

### Problem: "Cannot find the path specified" or "No such file or directory"
**Solution:** 
- Make sure the folder is on your Desktop
- Check the folder name matches what you typed
- Try typing `cd Desktop` first, then `dir` (Windows) or `ls` (Mac) to see the folder name

### Problem: Setup takes forever or gets stuck
**Solution:**
- Make sure you have internet connection
- Wait at least 10 minutes (first setup is slow)
- If it's been more than 15 minutes, close the window and try again

### Problem: Tests fail immediately
**Solution:**
- Make sure you completed Step 4 (setup) first
- Try running `npm run test:setup` again

---

## 📋 Quick Reference Card

**First time ever:**
```bash
cd Desktop\sport-test-automator-main-1    (Windows)
cd ~/Desktop/sport-test-automator-main-1  (Mac)
npm run test:setup
```

**Every time after that:**
```bash
cd Desktop\sport-test-automator-main-1    (Windows)
cd ~/Desktop/sport-test-automator-main-1  (Mac)
npm run test:all
```

---

## 💡 Tips

- **Don't close the window** while tests are running
- **Wait for each command to finish** before typing the next one
- **Copy and paste** commands instead of typing them (fewer mistakes)
- If something goes wrong, **read the error message** - it usually tells you what's wrong

---

## 🆘 Need Help?

Contact your team lead with:
- A screenshot of the error
- What step you were on
- What command you ran
