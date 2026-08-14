# Linux Gym

A browser-first interactive Linux command-line trainer.

**Target Pages URL:** `https://markofornoliak.github.io/linux-gym/`

## What it is

Linux Gym is a static, zero-backend learning environment designed for GitHub Pages. It combines a realistic virtual shell with automatically verified training reps, course progression, hints, XP, streaks, local progress persistence, and a responsive mobile UI.

It is an original implementation and does not include or redistribute Shell Gym source code.

## Features

- Virtual filesystem and shell state
- 8 modules and 24 verified reps
- Automatic mission checks
- `pwd`, `ls`, `cd`, `mkdir`, `touch`, `cat`, redirects, `grep`, pipes, `head`, `tail`, `wc`, `chmod`, `ps`, `kill`, `ip`, `ss`, `curl` and more
- Command history and tab completion
- Persistent XP, streaks, achievements, and progress
- Daily randomized challenge
- Responsive mission / terminal / course mobile flow
- No framework, backend, build step, or external dependency

## Run locally

Open `index.html` directly or serve the folder with any static server.

```bash
python3 -m http.server 8000
```

## GitHub Pages

The repository includes a Pages workflow. In **Settings → Pages**, set **Source** to **GitHub Actions** once. After that, pushes to `main` deploy automatically.
