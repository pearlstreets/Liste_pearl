# Safety backups

This folder contains timestamped snapshots of the working tree taken before
risky refactors. Each subdirectory is named `YYYYMMDD-HHMMSS` and holds a copy
of the main source files at that moment, plus `HEAD.txt` with the git commit
SHA that was checked out.

To restore from a snapshot:

```bash
SNAP=backup/20260418-021904          # pick the snapshot you want
cp -r "$SNAP"/* .                    # overwrite current files
cat "$SNAP/HEAD.txt"                 # see which commit this came from
```

Alternatively, git itself is the real safety net:

```bash
git reflog                           # see every HEAD state
git reset --hard <sha>               # restore any past state
```

This folder is intentionally checked in so the safety net survives branch
switches and clones. Clean up snapshots you no longer need with:

```bash
rm -rf backup/20260418-021904
```
