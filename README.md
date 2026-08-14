# Linux Gym

A browser-first Linux and DevOps practice platform built for learning by doing.

**Live:** `https://markofornoliak.github.io/linux-gym/`

## Platform

Linux Gym runs as a static GitHub Pages application with a stateful virtual Linux environment. It does not execute commands on the visitor's real operating system and does not require a backend.

The curriculum contains **124 missions across 13 tracks**, including **4 multi-step scenario exams**:

1. Shell Fundamentals
2. Files & Directories
3. Text & Pipelines
4. Permissions & Identity
5. Processes & Jobs
6. Networking
7. Bash Scripting
8. Git
9. Docker
10. SSH & Remote
11. DevOps Operations
12. Troubleshooting
13. Scenario Exams

## Training engine

- Stateful virtual filesystem, environment variables and permissions
- Processes, jobs and signals
- Network interfaces, routes, sockets, DNS and HTTP simulations
- Git repository state: staging, commits, branches, remotes and stash
- Docker images and container lifecycle state
- SSH key and remote-session exercises
- systemd services, journal, disk and memory diagnostics
- Pipes, redirects, `&&`, `||`, `;`, variables and command substitution
- Command history and tab completion
- Automatic objective validation against command history and system state
- XP, mastery and per-track progress
- Adaptive practice that prioritizes incomplete work in weaker tracks
- Hints and contextual correction with execution-score penalties
- Local progress persistence with `localStorage`

## Interface

The UI is intentionally restrained: a light neutral learning workspace, a graphite terminal, muted blue interaction accents and sage progress states. Desktop keeps course, mission and terminal visible together; mobile uses persistent Mission / Terminal / Course switching.

## Quality checks

Every change runs GitHub Actions checks before Pages deployment:

- JavaScript syntax validation
- Curriculum integrity checks
- Stateful shell regression tests
- Static asset/link validation
- Headless Chrome smoke test
- GitHub Pages deployment only after the test job passes on `main`

Run the core test locally with:

```bash
node tests/selftest.cjs
```

Serve the UI locally with:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Architecture

- `index.html` — application shell
- `styles.css` — core visual system
- `responsive.css` — mobile workspace behavior
- `data.js` — curriculum and validation definitions
- `shell.js` — stateful Linux/DevOps emulator
- `runtime-fixes.js` — small runtime compatibility/regression guards
- `app.js` — training UI, progress and adaptive practice
- `tests/selftest.cjs` — curriculum and shell regression suite

Linux Gym is an original implementation and does not include or redistribute Shell Gym source code.
