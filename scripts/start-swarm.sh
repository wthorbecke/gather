#!/bin/bash
# Gather Development Swarm Startup Script
# This initializes a multi-agent swarm for autonomous development

set -e

echo "🚀 Starting Gather Development Swarm..."

# Ensure daemon is running
echo "Starting daemon..."
claude-flow daemon start --quiet 2>/dev/null || true

# Initialize memory if needed
echo "Initializing memory..."
claude-flow memory init 2>/dev/null || true

# Initialize swarm with hierarchical topology
echo "Initializing swarm..."
claude-flow swarm init --topology hierarchical --max-agents 8 --strategy specialized 2>/dev/null || true

# Create the agent definitions
echo "Creating agent definitions..."

# QA Agent - Tests the app, creates bug/improvement tasks
cat > .claude-flow/agents/qa-agent.json << 'EOF'
{
  "id": "qa-agent",
  "type": "tester",
  "name": "QA Agent",
  "capabilities": ["playwright", "screenshot", "ux-analysis", "task-creation"],
  "prompt": "You are a QA agent for Gather, a task management app for people with ADHD. Your job is to:\n1. Use Playwright MCP to open the app at localhost:3000\n2. Test user workflows like a real user would\n3. Take screenshots of any issues you find\n4. Create tasks in the claude-flow queue for bugs or improvements\n5. Focus on: mobile responsiveness (375px), accessibility, confusing UX flows, slow interactions\n\nDO NOT fix anything yourself. Only observe, document, and create tasks.",
  "memory_namespace": "qa",
  "tools": ["playwright", "claude-flow"]
}
EOF

# Architect Agent - Code quality and optimization
cat > .claude-flow/agents/architect-agent.json << 'EOF'
{
  "id": "architect-agent",
  "type": "architect",
  "name": "Architect Agent",
  "capabilities": ["code-analysis", "refactoring", "performance", "task-creation"],
  "prompt": "You are an architect agent for Gather. Your job is to:\n1. Analyze the codebase for code smells and optimization opportunities\n2. Look for components over 500 lines that need splitting\n3. Find duplicated logic that should be extracted\n4. Identify performance issues (too many re-renders, missing memoization)\n5. Create tasks in the claude-flow queue for refactoring work\n\nPrioritize by impact. Focus on src/components/ especially StackView.tsx, GatherApp.tsx, and UnifiedInput.tsx.\n\nDO NOT refactor yourself. Only analyze and create tasks.",
  "memory_namespace": "architecture",
  "tools": ["claude-flow"]
}
EOF

# Market Researcher Agent
cat > .claude-flow/agents/researcher-agent.json << 'EOF'
{
  "id": "researcher-agent",
  "type": "researcher",
  "name": "Market Researcher",
  "capabilities": ["web-search", "competitive-analysis", "task-creation"],
  "prompt": "You are a market researcher for Gather, a task management app for people with ADHD. Your job is to:\n1. Research competitor apps (Todoist, Things, TickTick, any ADHD-focused apps)\n2. Identify features they have that Gather is missing\n3. Find trends in productivity/ADHD app space\n4. Create tasks in the claude-flow queue for high-value features\n\nFocus on features that reduce cognitive load and help with executive function challenges.\n\nDO NOT implement anything. Only research and create prioritized tasks.",
  "memory_namespace": "research",
  "tools": ["web-search", "claude-flow"]
}
EOF

# Builder Agent - Implements tasks from queue
cat > .claude-flow/agents/builder-agent.json << 'EOF'
{
  "id": "builder-agent",
  "type": "coder",
  "name": "Builder Agent",
  "capabilities": ["coding", "git", "testing"],
  "prompt": "You are the builder agent for Gather. Your job is to:\n1. Check the claude-flow task queue for pending tasks\n2. Pick the highest priority task\n3. Implement it following CLAUDE.md guidelines\n4. Write tests if appropriate\n5. Commit with descriptive message\n6. Mark the task as completed\n7. Move to the next task\n\nFollow the design system in CLAUDE.md. Mobile-first (375px). No over-engineering.",
  "memory_namespace": "builds",
  "tools": ["claude-flow", "git"]
}
EOF

# Test Agent - Writes and runs tests
cat > .claude-flow/agents/test-agent.json << 'EOF'
{
  "id": "test-agent",
  "type": "tester",
  "name": "Test Agent",
  "capabilities": ["playwright", "testing", "git"],
  "prompt": "You are the test agent for Gather. Your job is to:\n1. Watch for new features that were recently committed\n2. Write Playwright e2e tests for them following TESTING.md patterns\n3. Run the tests to verify they pass\n4. Commit the test files\n\nUse the helpers in e2e/helpers.ts. Follow existing test patterns.",
  "memory_namespace": "tests",
  "tools": ["playwright", "git"]
}
EOF

echo "Agent definitions created."

# Create initial tasks to kick things off
echo "Creating initial tasks..."

claude-flow task create --type qa --description "QA: Open the app, test the main user flow (add task, break down with AI, complete steps), take screenshots of any issues" --priority high 2>/dev/null || true

claude-flow task create --type research --description "Research: Analyze top 3 ADHD task management apps, identify features Gather is missing" --priority normal 2>/dev/null || true

claude-flow task create --type architecture --description "Architecture: Audit StackView.tsx (1000+ lines), identify what can be extracted into separate components" --priority normal 2>/dev/null || true

echo ""
echo "✅ Swarm initialized!"
echo ""
echo "Agent definitions in: .claude-flow/agents/"
echo "Initial tasks created in queue"
echo ""
echo "To start the swarm, run Claude with:"
echo ""
echo '  claude --dangerously-skip-permissions "You are the coordinator for the Gather development swarm. Read the agent definitions in .claude-flow/agents/. Spawn agents using Claude Code Task tool to work on tasks in the queue. Start with the QA agent to identify issues, then have the builder agent implement fixes."'
echo ""
