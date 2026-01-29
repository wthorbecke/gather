# Gather App Multi-Agent Analysis System

A comprehensive analysis system using 10 specialized AI agents to evaluate every aspect of your app, followed by a synthesis agent that consolidates findings into actionable priorities.

## Quick Start

### Option 1: One Command (Recommended)

```bash
# Copy agent-prompts folder to your project, then:
cd /path/to/your/gather/app
chmod +x agent-prompts/*.sh
./agent-prompts/run.sh
```

This runs all 10 agents in parallel, shows live progress, then runs the synthesizer.

### Option 2: tmux (if you want to watch)

```bash
# Requires: brew install tmux
./agent-prompts/run_tmux.sh
```

Opens a tmux session with all agents in split panes so you can watch them work.

### Option 3: Separate Terminal Windows

```bash
./agent-prompts/run_parallel.sh
```

Opens 10 macOS Terminal windows, one per agent.

### Option 4: Manual (Full Control)

```bash
# Open 10 terminals and run one agent each:
claude "$(cat agent-prompts/agent01_info_architecture.md)"
claude "$(cat agent-prompts/agent02_interaction_design.md)"
# ... etc

# After all complete:
claude "$(cat agent-prompts/agent_synthesizer.md)"
```

## Scripts

| Script | What It Does |
|--------|--------------|
| `run.sh` | **Best option** - Runs all agents in background, shows progress, then synthesizes |
| `run_tmux.sh` | Runs agents in tmux panes (requires `brew install tmux`) |
| `run_parallel.sh` | Opens 10 macOS Terminal windows |
| `run_sequential.sh` | Runs agents one at a time (slowest but simplest) |
| `run_synthesizer.sh` | Just runs the synthesizer (after agents complete) |

## Prerequisites

1. **Claude Code CLI** installed and authenticated
2. **App running** at `localhost:3000`
3. **Chrome closed** (Playwright MCP conflicts with open Chrome sessions)

## The Agents

| # | Agent | Focus Area |
|---|-------|------------|
| 01 | Information Architecture | Data structure, mental models, hierarchy |
| 02 | Interaction Design | Every clickable element, feedback, timing |
| 03 | Visual Design | Colors, typography, spacing, consistency |
| 04 | Animation & Motion | Transitions, timing, easing, performance |
| 05 | ADHD UX | Executive function, dopamine, task initiation |
| 06 | AI Integration | AI features, latency, value assessment |
| 07 | Code Quality | Architecture, tech debt, maintainability |
| 08 | Competitive Analysis | Market positioning, differentiation |
| 09 | First-Time Experience | Onboarding, time-to-value, abandonment |
| 10 | Delight & Emotion | Joy, craft, personality, reward loops |
| S | Synthesizer | Consolidates all reports into action plan |

## Output

All agents write reports to `/reports/`:

```
reports/
├── 01_information_architecture.md
├── 02_interaction_design.md
├── 03_visual_design.md
├── 04_animation_motion.md
├── 05_adhd_ux.md
├── 06_ai_integration.md
├── 07_code_quality.md
├── 08_competitive_analysis.md
├── 09_first_time_experience.md
├── 10_delight_emotion.md
└── MASTER_SYNTHESIS.md          <- Start here
```

## Time Estimates

- Each agent: 2-5 minutes
- All 10 in parallel: ~10 minutes
- All 10 sequential: ~30-50 minutes
- Synthesizer: 3-5 minutes

## Tips

### For Best Results

1. **Close Chrome** before running agents that use Playwright
2. **Run in parallel** if you want speed (separate terminals)
3. **Run sequentially** if you want to monitor progress
4. **Read synthesizer first** — it prioritizes everything

### Playwright Conflicts

If you see "Failed to launch browser", Chrome is intercepting Playwright:

```bash
# Kill all Chrome processes
pkill -f "Google Chrome"
```

Or use headless mode by modifying prompts to specify `headless: true`.

### Customizing Prompts

Each prompt is self-contained in `agent-prompts/agentXX_*.md`. Modify:
- Questions to answer
- Output format
- Specific concerns for your app

### Running Subset of Agents

Only care about UX? Run just:
```bash
claude "$(cat agent-prompts/agent02_interaction_design.md)"
claude "$(cat agent-prompts/agent05_adhd_ux.md)"
claude "$(cat agent-prompts/agent09_first_time_experience.md)"
```

## Philosophy

These prompts are designed to be:
- **Brutal** — No softening, no "consider", only "this is broken"
- **Specific** — File:line references, not vague suggestions
- **Opinionated** — Strong views on what's right and wrong
- **Actionable** — Clear next steps, not analysis paralysis

The goal is feedback that hurts a little but creates clarity.
