# Finding Your Project Folder

If you get "no such file or directory" error, you might be in the wrong folder!

## How to Find the Project Folder

### Step 1: Check where you are
Type this in Terminal:
```bash
pwd
```

### Step 2: Look for the project folder

The project folder might be in different places. Try these commands:

**Check Desktop:**
```bash
ls ~/Desktop | grep sport
```

**Check Documents:**
```bash
ls ~/Documents | grep sport
```

**Check current directory:**
```bash
ls | grep sport
```

### Step 3: Navigate to the project folder

Once you find it, go there:

**If it's on Desktop:**
```bash
cd ~/Desktop/sport-test-automator-main-1
```

**If it's in Documents:**
```bash
cd ~/Documents/sport-test-automator-main-1
```

**If it's somewhere else:**
```bash
cd /path/to/sport-test-automator-main-1
```

### Step 4: Verify you're in the right place

Type this to see the files:
```bash
ls *.sh
```

You should see files like:
- run-f1-test.sh
- run-tests.sh
- setup.sh

If you see these files, you're in the right place!

### Step 5: Now run the script

```bash
./run-f1-test.sh
```

---

## Quick Check Command

Run this to find where your project is:
```bash
find ~ -name "run-f1-test.sh" -type f 2>/dev/null
```

This will show you the full path to the script. Then `cd` to that directory.
