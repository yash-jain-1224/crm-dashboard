# 🚀 Quick Restart & Test Guide

## Issue Fixed
Progress indicator was stuck at "0 of 50001 records processed (0.0%)"

## What Was Changed
- Fixed duplicate task completion call
- Enhanced result handling to extract success/failed counts
- Added error logging for debugging

## ⚡ Quick Restart Steps

### 1. Stop Backend (if running)
```bash
# Find the process
ps aux | grep uvicorn

# Kill it (replace XXXX with actual PID)
kill XXXX

# OR use pkill
pkill -f "uvicorn main:app"
```

### 2. Start Backend Fresh
```bash
cd "/Users/yashjain/Documents/Code/Databricks Apps/backend"

# Start with reload enabled
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. Test the Upload

1. **Open Accounts Page**
   - Go to http://localhost:5173/accounts (or your frontend URL)

2. **Prepare Test File**
   - Click "Upload Excel" → "Download Template"
   - Fill with at least 10,000 rows
   - Save as `test_accounts.xlsx`

3. **Upload and Watch**
   - Click "Upload Excel"
   - Drag your file to the modal
   - Click "Upload File"

4. **Expected Behavior**
   ```
   Processing Upload...
   [████░░░░░░░░░░░░] 20%
   10,000 of 50,000 records processed (20.0%)
   ✓ 9,950 successful
   ✗ 50 failed
   ```

   Progress should update every 5-10 seconds as batches complete!

### 4. Verify in DevTools

Open DevTools (F12) → Network tab:

Look for requests to `/upload-progress/{task_id}`:
- Should appear every 1 second
- Response should show increasing `processed` count
- `progress_percentage` should go 0 → 10 → 20 → ... → 100

---

## 🔍 Debugging Tips

### Backend Not Starting?
```bash
# Check if port 8000 is in use
lsof -i :8000

# Check for syntax errors
cd backend
python -m py_compile app/api/v1/endpoints/accounts.py
python -m py_compile app/core/background_tasks.py
```

### Progress Still Stuck?
Check backend terminal for:
```
Error in background task abc123-...: [error message]
Traceback (most recent call last):
  ...
```

### Want More Debug Info?
Add logging to see progress updates:

Edit `backend/app/core/background_tasks.py`, add this in `update_task()`:
```python
def update_task(self, task_id: str, **kwargs):
    """Update task progress"""
    print(f"📊 Updating task {task_id}: {kwargs}")  # ADD THIS
    with self._lock:
        task = self.tasks.get(task_id)
        if task:
            task.update(**kwargs)
```

Then restart backend and watch terminal during upload.

---

## ✅ Success Indicators

### Backend Terminal
```
INFO:  POST /api/v1/accounts/bulk-upload 200 OK
INFO:  GET /api/v1/accounts/upload-progress/abc123-... 200 OK
INFO:  GET /api/v1/accounts/upload-progress/abc123-... 200 OK
...
```

### Browser Console
```
No errors ✓
```

### Frontend UI
```
Processing Upload...
[████████████░░░░] 75%
37,500 of 50,000 records processed (75.0%)
✓ 37,200 successful
✗ 300 failed
```

### After Completion
```
✓ Upload Complete
Successfully imported: 49,500 accounts
Time taken: 45.2s
```

---

## 📝 Quick Test Checklist

- [ ] Backend restarted
- [ ] No errors in backend startup
- [ ] Frontend accessible
- [ ] Can open Accounts page
- [ ] Can click "Upload Excel"
- [ ] Can download template
- [ ] Can upload file (10k+ rows)
- [ ] Progress bar updates (not stuck at 0%)
- [ ] Counter shows increasing numbers
- [ ] Success/failed counts update
- [ ] "Upload Complete" appears
- [ ] Accounts list refreshes
- [ ] Modal auto-closes

---

## 🎉 Expected Result

The progress bar should now update smoothly from 0% to 100%, with counters showing:

```
0s:   [░░░░░░░░░░░░░░░░] 0%    - 0 of 50,000 (0.0%)
5s:   [███░░░░░░░░░░░░░] 15%   - 7,500 of 50,000 (15.0%)
10s:  [██████░░░░░░░░░░] 30%   - 15,000 of 50,000 (30.0%)
15s:  [█████████░░░░░░░] 45%   - 22,500 of 50,000 (45.0%)
20s:  [████████████░░░░] 60%   - 30,000 of 50,000 (60.0%)
25s:  [███████████████░] 75%   - 37,500 of 50,000 (75.0%)
30s:  [██████████████████] 100% - 50,000 of 50,000 (100.0%)

✓ Upload Complete!
```

---

## 🆘 Still Having Issues?

1. **Check Files Modified**:
   - `backend/app/api/v1/endpoints/accounts.py`
   - `backend/app/core/background_tasks.py`

2. **Verify Changes Applied**:
   ```bash
   cd backend
   grep -n "run_task_async" app/core/background_tasks.py
   # Should show the updated version with result extraction
   ```

3. **Check Python Version**:
   ```bash
   python --version
   # Should be 3.8+
   ```

4. **Reinstall Dependencies** (if needed):
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

---

**Status**: ✅ Ready to Test!

**Remember**: Always restart the backend after code changes!
