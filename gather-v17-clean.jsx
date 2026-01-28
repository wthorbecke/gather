import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * GATHER v17
 * - Suggestions visible before clicking input
 * - AI responses appear as inline cards (no takeover)
 * - Single input that handles everything
 * - Subtle send button
 * - Clickable task after creation
 */

// =============================================================================
// DESIGN SYSTEM
// =============================================================================
const space = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80];
const text = { xs: 11, sm: 13, md: 15, lg: 17, xl: 22, xxl: 28, hero: 36 };
const radius = { sm: 6, md: 10, lg: 14, xl: 20, full: 999 };

const dark = {
  bg: '#0f0f0e',
  bgElevated: '#161615',
  card: '#1b1b1a',
  cardHover: '#212120',
  subtle: '#1e1e1d',
  
  text: '#eeeeed',
  textSecondary: '#989894',
  textMuted: '#5a5a56',
  
  border: 'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.04)',
  borderFocus: 'rgba(200,170,130,0.5)',
  
  accent: '#c9a87c',
  accentMuted: 'rgba(201,168,124,0.12)',
  accentText: '#c9a87c',
  success: '#70c492',
  successMuted: 'rgba(112,196,146,0.12)',
  link: '#80b4dc',
  linkMuted: 'rgba(128,180,220,0.1)',
  
  aiBg: '#1e1e1d',
  aiBorder: 'rgba(255,255,255,0.06)',
  userBg: 'rgba(201,168,124,0.15)',
};

const light = {
  bg: '#f7f7f5',
  bgElevated: '#ffffff',
  card: '#ffffff',
  cardHover: '#fafaf8',
  subtle: '#f0f0ee',
  
  text: '#1a1a18',
  textSecondary: '#5a5a56',
  textMuted: '#989894',
  
  border: 'rgba(0,0,0,0.08)',
  borderSubtle: 'rgba(0,0,0,0.04)',
  borderFocus: 'rgba(160,120,70,0.4)',
  
  accent: '#a07846',
  accentMuted: 'rgba(160,120,70,0.1)',
  accentText: '#8a6538',
  success: '#4a9968',
  successMuted: 'rgba(74,153,104,0.1)',
  link: '#4a8cba',
  linkMuted: 'rgba(74,140,186,0.1)',
  
  aiBg: '#f5f5f3',
  aiBorder: 'rgba(0,0,0,0.06)',
  userBg: 'rgba(160,120,70,0.1)',
};

// =============================================================================
// DATA
// =============================================================================
const initialTasks = [
  {
    id: 'real-id',
    name: 'Get Real ID',
    context: 'Required for domestic flights May 7, 2025',
    steps: [
      { id: 1, text: 'Find your birth certificate or passport', done: true, summary: 'A valid passport is easiest.', detail: 'If using birth certificate, must be certified with raised seal.', alternatives: ['U.S. Passport', 'Certificate of Citizenship', 'Certificate of Naturalization'], source: { name: 'CA DMV', url: '#' } },
      { id: 2, text: 'Find your Social Security card', done: true, summary: 'Must show full 9-digit SSN.', source: { name: 'CA DMV', url: '#' } },
      { id: 3, text: 'Gather 2 proofs of California residency', done: false, summary: 'Dated within 90 days.', detail: 'Bring 3 if possible—clerks sometimes reject one.', examples: ['Utility bill', 'Bank statement', 'Lease', 'Cell phone bill'], source: { name: 'CA DMV', url: '#' } },
      { id: 4, text: 'Complete DL 44 application online', done: false, summary: 'Saves 15-20 min at DMV.', time: '10-15 min', source: { name: 'CA DMV', url: '#' }, action: { text: 'Start application', url: '#' } },
      { id: 5, text: 'Book DMV appointment', done: false, summary: 'Walk-ins wait 2+ hours.', source: { name: 'CA DMV', url: '#' }, action: { text: 'Book appointment', url: '#' } },
      { id: 6, text: 'Attend with documents + $39', done: false, summary: 'Missing anything = reschedule.', checklist: ['Birth certificate or passport', 'Social Security card', '2-3 proofs of residency', 'DL 44 confirmation', '$39'], source: { name: 'CA DMV', url: '#' } },
    ],
  },
  {
    id: 'taxes',
    name: 'File 2024 taxes',
    context: 'Refund expected',
    steps: [
      { id: 1, text: 'Gather W-2s and 1099s', done: true, summary: 'Income documentation.', source: { name: 'IRS', url: '#' } },
      { id: 2, text: 'Download last year\'s return', done: true, source: { name: 'IRS', url: '#' } },
      { id: 3, text: 'Complete return on FreeTaxUSA', done: true, summary: 'Free federal filing.', source: { name: 'IRS', url: '#' } },
      { id: 4, text: 'Submit and save confirmation', done: false, summary: 'Keep the PDF.', source: { name: 'IRS', url: '#' } },
    ],
  },
];

const homeSuggestions = ['Get a Real ID', 'Renew my passport', 'File my taxes', 'Dispute a bill'];

// =============================================================================
// APP
// =============================================================================
export default function Gather() {
  const [darkMode, setDarkMode] = useState(true);
  const c = darkMode ? dark : light;
  
  const [tasks, setTasks] = useState(initialTasks);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [expandedStepId, setExpandedStepId] = useState(null);
  
  // Input
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  
  // AI conversation (inline cards, not takeover)
  const [aiCard, setAiCard] = useState(null); // { message, quickReplies?, taskCreated?, thinking? }
  const [pendingInput, setPendingInput] = useState(null); // What user typed that triggered AI
  
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  
  const currentTask = tasks.find(t => t.id === currentTaskId);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setInputFocused(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setInputFocused(false);
        setAiCard(null);
        setPendingInput(null);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // ==================== SEARCH ====================
  const searchResults = useMemo(() => {
    const q = inputValue.toLowerCase().trim();
    if (!q) return [];
    
    const results = [];
    for (const task of tasks) {
      if (task.name.toLowerCase().includes(q)) {
        results.push({ type: 'task', task });
      }
      for (const step of task.steps) {
        if (step.text.toLowerCase().includes(q)) {
          results.push({ type: 'step', task, step });
        }
      }
    }
    return results.slice(0, 4);
  }, [inputValue, tasks]);

  // ==================== ACTIONS ====================
  const handleSubmit = (e) => {
    e?.preventDefault();
    const value = inputValue.trim();
    if (!value) return;
    
    setPendingInput(value);
    setInputValue('');
    setInputFocused(false);
    
    // Show thinking state
    setAiCard({ thinking: true });
    
    // Simulate AI response
    setTimeout(() => {
      const lower = value.toLowerCase();
      
      if (currentTask) {
        // Context-aware response for current task
        setAiCard({
          message: `For ${currentTask.name}, here's what I found...`,
          taskId: currentTask.id,
        });
      } else if (lower.includes('real id') || lower.includes('dmv')) {
        setAiCard({
          message: "I'll help you get a Real ID. Do you have a valid U.S. passport? It makes the process simpler.",
          quickReplies: ['Yes, I have one', 'No, using birth certificate'],
          pendingTaskName: value,
        });
      } else if (lower.includes('passport')) {
        setAiCard({
          message: "I can help with passport. Is this a renewal or first-time application?",
          quickReplies: ['Renewal', 'First time', 'Replacing lost'],
          pendingTaskName: value,
        });
      } else if (lower.includes('tax')) {
        setAiCard({
          message: "I'll help you file taxes. What's your situation?",
          quickReplies: ['W-2 employee', 'Self-employed', 'Multiple sources'],
          pendingTaskName: value,
        });
      } else {
        setAiCard({
          message: `I'll research "${value}" and create a personalized plan. What's your timeline?`,
          quickReplies: ['No rush', 'This month', 'ASAP'],
          pendingTaskName: value,
        });
      }
    }, 800);
  };

  const handleQuickReply = (reply) => {
    // Show thinking briefly
    const taskName = aiCard?.pendingTaskName || pendingInput || 'New task';
    setAiCard({ thinking: true });
    
    setTimeout(() => {
      // Create the task
      const newTask = {
        id: 'task-' + Date.now(),
        name: taskName,
        context: reply === 'ASAP' ? 'High priority' : null,
        steps: [
          { id: 1, text: 'Research requirements', done: false, summary: 'Understand what\'s needed.' },
          { id: 2, text: 'Gather documents', done: false, summary: 'Collect everything required.' },
          { id: 3, text: 'Submit application', done: false, summary: 'Complete the process.' },
          { id: 4, text: 'Follow up', done: false, summary: 'Confirm completion.' },
        ],
      };
      
      setTasks(prev => [newTask, ...prev]);
      setAiCard({
        message: "Done! I've created your personalized plan.",
        taskCreated: newTask,
      });
    }, 600);
  };

  const handleQuickAdd = () => {
    const value = inputValue.trim();
    if (!value) return;
    
    const newTask = {
      id: 'task-' + Date.now(),
      name: value,
      context: null,
      steps: [{ id: 1, text: value, done: false }],
    };
    setTasks(prev => [newTask, ...prev]);
    setInputValue('');
    setInputFocused(false);
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
    inputRef.current?.focus();
  };

  const selectResult = (result) => {
    if (result.type === 'task') {
      setCurrentTaskId(result.task.id);
    } else {
      setCurrentTaskId(result.task.id);
      setTimeout(() => setExpandedStepId(result.step.id), 50);
    }
    setInputValue('');
    setInputFocused(false);
    setAiCard(null);
  };

  const dismissAiCard = () => {
    setAiCard(null);
    setPendingInput(null);
  };

  const goToTask = (taskId) => {
    setCurrentTaskId(taskId);
    setAiCard(null);
    setPendingInput(null);
  };

  const toggleStep = (taskId, stepId) => {
    setTasks(prev => prev.map(t => 
      t.id === taskId 
        ? { ...t, steps: t.steps.map(s => s.id === stepId ? { ...s, done: !s.done } : s) }
        : t
    ));
  };

  const getNextStep = () => {
    for (const task of tasks) {
      const step = task.steps.find(s => !s.done);
      if (step) return { task, step };
    }
    return null;
  };

  const nextStep = getNextStep();

  const highlight = (str, q) => {
    if (!q) return str;
    const i = str.toLowerCase().indexOf(q.toLowerCase());
    if (i === -1) return str;
    return <>{str.slice(0, i)}<span style={{ color: c.accent, fontWeight: 600 }}>{str.slice(i, i + q.length)}</span>{str.slice(i + q.length)}</>;
  };

  // ==================== COMPONENTS ====================
  const Check = ({ checked, onChange, size = 20 }) => (
    <button onClick={(e) => { e.stopPropagation(); onChange(); }} style={{
      width: size, height: size, borderRadius: '50%',
      border: `1.5px solid ${checked ? c.success : c.textMuted}`,
      backgroundColor: checked ? c.success : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
    }}>
      {checked && <svg width={10} height={10} viewBox="0 0 12 12"><path d="M2.5 6L5 8.5L9.5 3.5" stroke={darkMode ? '#111' : '#fff'} strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>}
    </button>
  );

  const Progress = ({ done, total }) => (
    <div style={{ height: 3, backgroundColor: c.border, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${(done / total) * 100}%`, backgroundColor: c.success, transition: 'width 0.3s' }}/>
    </div>
  );

  const Pill = ({ children }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', backgroundColor: c.subtle, color: c.textMuted,
      borderRadius: radius.full, fontSize: text.xs, fontWeight: 500,
    }}>{children}</span>
  );

  // ==================== RENDER ====================
  return (
    <div style={{
      minHeight: '100vh', backgroundColor: c.bg, color: c.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: ${c.textMuted}; }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ========== HOME VIEW ========== */}
      {!currentTaskId && (
        <div style={{ minHeight: '100vh', padding: `${space[8]}px ${space[5]}px` }}>
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space[7] }}>
              <h1 style={{ fontSize: text.hero, fontWeight: 600, letterSpacing: '-0.02em' }}>Gather</h1>
              <button onClick={() => setDarkMode(!darkMode)} style={{
                width: 36, height: 36, borderRadius: radius.md,
                border: 'none', backgroundColor: c.subtle,
                color: c.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{darkMode ? '☀' : '☾'}</button>
            </div>

            {/* Input Area */}
            <div ref={containerRef} style={{ marginBottom: space[5] }}>
              {/* Input Box */}
              <form onSubmit={handleSubmit}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  backgroundColor: c.bgElevated,
                  border: `1.5px solid ${inputFocused ? c.borderFocus : c.border}`,
                  borderRadius: radius.lg,
                  padding: `${space[4]}px ${space[4]}px`,
                  transition: 'all 0.15s',
                  boxShadow: inputFocused ? `0 0 0 4px ${c.accentMuted}` : 'none',
                }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    placeholder="What do you need to get done?"
                    style={{
                      flex: 1, fontSize: text.lg, border: 'none', outline: 'none',
                      backgroundColor: 'transparent', color: c.text,
                    }}
                  />
                  {inputValue && (
                    <button type="submit" style={{
                      background: 'none', border: 'none', padding: space[2],
                      color: c.accent, cursor: 'pointer', display: 'flex',
                    }}>
                      <svg width={20} height={20} viewBox="0 0 24 24">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </button>
                  )}
                </div>
              </form>

              {/* Dropdown (only when focused AND typing) */}
              {inputFocused && inputValue && (
                <div style={{
                  marginTop: space[2],
                  backgroundColor: c.card,
                  border: `1px solid ${c.border}`,
                  borderRadius: radius.lg,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  overflow: 'hidden',
                  animation: 'fadeIn 0.15s ease',
                }}>
                  {searchResults.map((r, i) => (
                    <div key={i} onClick={() => selectResult(r)} style={{
                      padding: `${space[3]}px ${space[4]}px`,
                      display: 'flex', alignItems: 'center', gap: space[3],
                      cursor: 'pointer',
                    }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = c.cardHover}
                       onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <div style={{ width: 24, height: 24, borderRadius: radius.sm, backgroundColor: c.subtle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {r.type === 'task' ? (
                          <svg width={12} height={12} viewBox="0 0 16 16" style={{ color: c.textMuted }}><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                        ) : (
                          <div style={{ width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${c.textMuted}` }}/>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: text.sm }}>{highlight(r.type === 'task' ? r.task.name : r.step.text, inputValue)}</div>
                        {r.type === 'step' && <div style={{ fontSize: text.xs, color: c.textMuted }}>in {r.task.name}</div>}
                      </div>
                    </div>
                  ))}
                  
                  {searchResults.length > 0 && <div style={{ height: 1, backgroundColor: c.borderSubtle }}/>}
                  
                  <div onClick={handleQuickAdd} style={{
                    padding: `${space[3]}px ${space[4]}px`,
                    display: 'flex', alignItems: 'center', gap: space[3], cursor: 'pointer',
                  }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = c.cardHover}
                     onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <div style={{ width: 24, height: 24, borderRadius: radius.sm, backgroundColor: c.successMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={12} height={12} viewBox="0 0 16 16" style={{ color: c.success }}><path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: text.sm }}>Add "{inputValue}"</div>
                      <div style={{ fontSize: text.xs, color: c.textMuted }}>Quick add</div>
                    </div>
                  </div>
                  
                  <div onClick={handleSubmit} style={{
                    padding: `${space[3]}px ${space[4]}px`,
                    display: 'flex', alignItems: 'center', gap: space[3], cursor: 'pointer',
                  }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = c.cardHover}
                     onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <div style={{ width: 24, height: 24, borderRadius: radius.sm, backgroundColor: c.accentMuted, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width={12} height={12} viewBox="0 0 16 16" style={{ color: c.accent }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 5V8.5L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: text.sm }}>Help me with "{inputValue}"</div>
                      <div style={{ fontSize: text.xs, color: c.textMuted }}>AI breakdown</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions - Always visible */}
            {!aiCard && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2], marginBottom: space[7] }}>
                {homeSuggestions.map(s => (
                  <button key={s} onClick={() => handleSuggestionClick(s)} style={{
                    padding: `${space[2]}px ${space[4]}px`,
                    backgroundColor: 'transparent',
                    border: `1px solid ${c.border}`,
                    borderRadius: radius.full,
                    fontSize: text.sm, color: c.textSecondary, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
                     onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textSecondary; }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* AI Response Card (inline, not takeover) */}
            {aiCard && (
              <div style={{
                backgroundColor: c.aiBg,
                border: `1px solid ${c.aiBorder}`,
                borderRadius: radius.lg,
                padding: space[5],
                marginBottom: space[6],
                animation: 'slideIn 0.2s ease',
                position: 'relative',
              }}>
                {/* Dismiss button */}
                <button onClick={dismissAiCard} style={{
                  position: 'absolute', top: space[3], right: space[3],
                  background: 'none', border: 'none', padding: 4,
                  color: c.textMuted, cursor: 'pointer', opacity: 0.6,
                }}>
                  <svg width={16} height={16} viewBox="0 0 16 16">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>

                {aiCard.thinking ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: '50%', backgroundColor: c.textMuted,
                          animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
                        }}/>
                      ))}
                    </div>
                    <span style={{ fontSize: text.sm, color: c.textMuted }}>Thinking...</span>
                  </div>
                ) : (
                  <>
                    {/* User's input */}
                    {pendingInput && (
                      <div style={{
                        fontSize: text.sm, color: c.textMuted, marginBottom: space[3],
                        paddingBottom: space[3], borderBottom: `1px solid ${c.borderSubtle}`,
                      }}>
                        "{pendingInput}"
                      </div>
                    )}

                    {/* AI message */}
                    <div style={{ fontSize: text.md, lineHeight: 1.55, marginBottom: aiCard.quickReplies || aiCard.taskCreated ? space[4] : 0 }}>
                      {aiCard.message}
                    </div>

                    {/* Quick replies */}
                    {aiCard.quickReplies && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[2] }}>
                        {aiCard.quickReplies.map(reply => (
                          <button key={reply} onClick={() => handleQuickReply(reply)} style={{
                            padding: `${space[2]}px ${space[4]}px`,
                            backgroundColor: c.bg,
                            border: `1px solid ${c.border}`,
                            borderRadius: radius.full,
                            fontSize: text.sm, color: c.text, cursor: 'pointer',
                            transition: 'all 0.15s',
                          }} onMouseEnter={(e) => e.currentTarget.style.borderColor = c.accent}
                             onMouseLeave={(e) => e.currentTarget.style.borderColor = c.border}>
                            {reply}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Task created */}
                    {aiCard.taskCreated && (
                      <div 
                        onClick={() => goToTask(aiCard.taskCreated.id)}
                        style={{
                          padding: space[4],
                          backgroundColor: c.successMuted,
                          borderRadius: radius.md,
                          display: 'flex', alignItems: 'center', gap: space[3],
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          backgroundColor: c.success + '30',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width={16} height={16} viewBox="0 0 16 16" style={{ color: c.success }}>
                            <path d="M3 8L6.5 11.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                          </svg>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: text.md, fontWeight: 500 }}>{aiCard.taskCreated.name}</div>
                          <div style={{ fontSize: text.sm, color: c.textSecondary }}>{aiCard.taskCreated.steps.length} steps · Click to view</div>
                        </div>
                        <svg width={16} height={16} viewBox="0 0 16 16" style={{ color: c.textMuted }}>
                          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        </svg>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Next Step */}
            {nextStep && (
              <div style={{ marginBottom: space[6] }}>
                <div style={{
                  fontSize: text.xs, fontWeight: 600, color: c.accent,
                  textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[3],
                }}>Next step</div>
                
                <div onClick={() => goToTask(nextStep.task.id)} style={{
                  backgroundColor: c.card, borderRadius: radius.lg,
                  boxShadow: `0 0 0 1px ${c.border}`, cursor: 'pointer', overflow: 'hidden',
                }}>
                  <div style={{ padding: space[5], display: 'flex', gap: space[4] }}>
                    <Check checked={false} onChange={() => toggleStep(nextStep.task.id, nextStep.step.id)} size={22}/>
                    <div>
                      <div style={{ fontSize: text.md, fontWeight: 500, marginBottom: space[1] }}>{nextStep.step.text}</div>
                      {nextStep.step.summary && <div style={{ fontSize: text.sm, color: c.textSecondary }}>{nextStep.step.summary}</div>}
                    </div>
                  </div>
                  <div style={{
                    padding: `${space[3]}px ${space[5]}px`, backgroundColor: c.subtle,
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: text.sm, color: c.textSecondary }}>{nextStep.task.name}</span>
                    <span style={{ fontSize: text.sm, color: c.textMuted }}>{nextStep.task.steps.filter(s => s.done).length}/{nextStep.task.steps.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* All Tasks */}
            <div>
              <div style={{
                fontSize: text.xs, fontWeight: 600, color: c.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: space[3],
              }}>All tasks</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                {tasks.map(task => {
                  const done = task.steps.filter(s => s.done).length;
                  return (
                    <div key={task.id} onClick={() => goToTask(task.id)} style={{
                      backgroundColor: c.card, borderRadius: radius.md, padding: space[4],
                      cursor: 'pointer', boxShadow: `0 0 0 1px ${c.border}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space[3] }}>
                        <div>
                          <div style={{ fontSize: text.md, fontWeight: 500 }}>{task.name}</div>
                          {task.context && <div style={{ fontSize: text.sm, color: c.textMuted, marginTop: 2 }}>{task.context}</div>}
                        </div>
                        <svg width={16} height={16} viewBox="0 0 16 16" style={{ color: c.textMuted }}>
                          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                        <div style={{ flex: 1 }}><Progress done={done} total={task.steps.length}/></div>
                        <span style={{ fontSize: text.xs, color: c.textMuted }}>{done}/{task.steps.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== TASK VIEW ========== */}
      {currentTaskId && currentTask && (
        <div style={{ minHeight: '100vh', padding: `${space[6]}px ${space[5]}px` }}>
          <div style={{ maxWidth: 540, margin: '0 auto' }}>
            
            {/* Back + Title row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: space[3], marginBottom: space[5] }}>
              <button onClick={() => { setCurrentTaskId(null); setExpandedStepId(null); setAiCard(null); }} style={{
                width: 36, height: 36, borderRadius: radius.md,
                border: 'none', backgroundColor: c.subtle,
                color: c.textSecondary, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width={16} height={16} viewBox="0 0 16 16">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
                </svg>
              </button>
              <h1 style={{ flex: 1, fontSize: text.xl, fontWeight: 600 }}>{currentTask.name}</h1>
              <button onClick={() => setDarkMode(!darkMode)} style={{
                width: 36, height: 36, borderRadius: radius.md,
                border: 'none', backgroundColor: c.subtle,
                color: c.textMuted, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{darkMode ? '☀' : '☾'}</button>
            </div>

            {/* Input for this task */}
            <div ref={containerRef} style={{ marginBottom: space[5] }}>
              <form onSubmit={handleSubmit}>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  backgroundColor: c.bgElevated,
                  border: `1.5px solid ${inputFocused ? c.borderFocus : c.border}`,
                  borderRadius: radius.lg,
                  padding: `${space[3]}px ${space[4]}px`,
                  transition: 'all 0.15s',
                  boxShadow: inputFocused ? `0 0 0 4px ${c.accentMuted}` : 'none',
                }}>
                  {/* Context pill */}
                  <div style={{
                    display: 'flex', alignItems: 'center',
                    padding: `3px 10px`,
                    backgroundColor: c.accentMuted,
                    borderRadius: radius.full,
                    marginRight: space[3],
                  }}>
                    <span style={{ fontSize: text.sm, color: c.accentText, fontWeight: 500 }}>
                      {currentTask.name.length > 16 ? currentTask.name.slice(0, 16) + '…' : currentTask.name}
                    </span>
                  </div>
                  
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    placeholder="Ask about this task..."
                    style={{
                      flex: 1, fontSize: text.md, border: 'none', outline: 'none',
                      backgroundColor: 'transparent', color: c.text,
                    }}
                  />
                  {inputValue && (
                    <button type="submit" style={{
                      background: 'none', border: 'none', padding: space[2],
                      color: c.accent, cursor: 'pointer', display: 'flex',
                    }}>
                      <svg width={18} height={18} viewBox="0 0 24 24">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      </svg>
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* AI Card for task context */}
            {aiCard && (
              <div style={{
                backgroundColor: c.aiBg,
                border: `1px solid ${c.aiBorder}`,
                borderRadius: radius.lg,
                padding: space[4],
                marginBottom: space[5],
                animation: 'slideIn 0.2s ease',
                position: 'relative',
              }}>
                <button onClick={dismissAiCard} style={{
                  position: 'absolute', top: space[3], right: space[3],
                  background: 'none', border: 'none', padding: 4,
                  color: c.textMuted, cursor: 'pointer', opacity: 0.6,
                }}>
                  <svg width={14} height={14} viewBox="0 0 16 16">
                    <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>

                {aiCard.thinking ? (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{
                        width: 6, height: 6, borderRadius: '50%', backgroundColor: c.textMuted,
                        animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
                      }}/>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: text.md, lineHeight: 1.55 }}>{aiCard.message}</div>
                )}
              </div>
            )}

            {/* Context */}
            {currentTask.context && (
              <p style={{ fontSize: text.md, color: c.textSecondary, marginBottom: space[4] }}>{currentTask.context}</p>
            )}

            {/* Progress */}
            <div style={{ marginBottom: space[6] }}>
              <Progress done={currentTask.steps.filter(s => s.done).length} total={currentTask.steps.length}/>
              <div style={{ fontSize: text.sm, color: c.textMuted, marginTop: space[2] }}>
                {currentTask.steps.filter(s => s.done).length} of {currentTask.steps.length} complete
              </div>
            </div>

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
              {currentTask.steps.map((step) => {
                const isExpanded = expandedStepId === step.id;
                const isNext = !step.done && currentTask.steps.filter(s => !s.done)[0]?.id === step.id;
                
                return (
                  <div key={step.id} style={{
                    backgroundColor: step.done ? 'transparent' : c.card,
                    borderRadius: radius.md,
                    boxShadow: step.done ? 'none' : `0 0 0 1px ${isNext ? c.success + '40' : c.border}`,
                    opacity: step.done ? 0.5 : 1,
                  }}>
                    <div onClick={() => !step.done && setExpandedStepId(isExpanded ? null : step.id)} style={{
                      display: 'flex', gap: space[4],
                      padding: step.done ? `${space[2]}px 0` : space[4],
                      cursor: step.done ? 'default' : 'pointer',
                    }}>
                      <Check checked={step.done} onChange={() => toggleStep(currentTask.id, step.id)}/>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: text.md, fontWeight: isNext ? 500 : 400,
                          textDecoration: step.done ? 'line-through' : 'none',
                          color: step.done ? c.textMuted : c.text,
                        }}>{step.text}</div>
                        {!isExpanded && !step.done && step.summary && (
                          <div style={{ fontSize: text.sm, color: c.textSecondary, marginTop: space[1] }}>{step.summary}</div>
                        )}
                      </div>
                      {!step.done && (
                        <svg width={16} height={16} viewBox="0 0 16 16" style={{
                          color: c.textMuted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
                        }}>
                          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        </svg>
                      )}
                    </div>

                    {isExpanded && !step.done && (
                      <div style={{ padding: `0 ${space[4]}px ${space[4]}px`, marginLeft: 20 + space[4] }}>
                        {step.detail && <p style={{ fontSize: text.sm, color: c.textSecondary, lineHeight: 1.6, marginBottom: space[4] }}>{step.detail}</p>}
                        
                        {(step.alternatives || step.examples) && (
                          <div style={{ padding: space[3], backgroundColor: c.subtle, borderRadius: radius.sm, marginBottom: space[4] }}>
                            <div style={{ fontSize: text.xs, color: c.textMuted, fontWeight: 600, textTransform: 'uppercase', marginBottom: space[2] }}>
                              {step.alternatives ? 'Also accepted' : 'Examples'}
                            </div>
                            <div style={{ fontSize: text.sm, color: c.textSecondary, lineHeight: 1.6 }}>
                              {(step.alternatives || step.examples).join(' · ')}
                            </div>
                          </div>
                        )}
                        
                        {step.checklist && (
                          <div style={{ padding: space[3], backgroundColor: c.subtle, borderRadius: radius.sm, marginBottom: space[4] }}>
                            <div style={{ fontSize: text.xs, color: c.textMuted, fontWeight: 600, textTransform: 'uppercase', marginBottom: space[2] }}>Checklist</div>
                            {step.checklist.map((item, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: space[2], fontSize: text.sm, color: c.textSecondary, marginBottom: space[1] }}>
                                <span style={{ color: c.textMuted }}>○</span>{item}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space[3] }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                            {step.action && (
                              <a href={step.action.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: `${space[2]}px ${space[3]}px`,
                                backgroundColor: c.linkMuted, color: c.link,
                                borderRadius: radius.sm, fontSize: text.sm, fontWeight: 500, textDecoration: 'none',
                              }}>
                                {step.action.text}
                                <svg width={10} height={10} viewBox="0 0 12 12"><path d="M3 9L9 3M9 3H5M9 3V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/></svg>
                              </a>
                            )}
                            {step.time && <Pill>⏱ {step.time}</Pill>}
                          </div>
                          
                          {step.source && (
                            <span style={{ fontSize: text.xs, color: c.textMuted }}>
                              via <a href={step.source.url} style={{ color: c.textMuted, textDecoration: 'none', borderBottom: `1px dotted ${c.textMuted}40` }}>{step.source.name}</a>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
