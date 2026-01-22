import React, { useState, useEffect, useRef } from 'react';

export default function Gather() {
  const [darkMode, setDarkMode] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [showAddFlow, setShowAddFlow] = useState(false);
  const [addFlowStep, setAddFlowStep] = useState(0);
  const [aiThinking, setAiThinking] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskModalClosing, setTaskModalClosing] = useState(false);
  const [addModalClosing, setAddModalClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  // Task chat
  const [taskChatInput, setTaskChatInput] = useState('');
  const [taskChatMessages, setTaskChatMessages] = useState([]);
  const [taskChatThinking, setTaskChatThinking] = useState(false);
  
  // Editing
  const [editingSubtask, setEditingSubtask] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Drag and drop
  const [draggedSubtask, setDraggedSubtask] = useState(null);
  const [dragOverSubtask, setDragOverSubtask] = useState(null);
  
  // Celebrations
  const [confetti, setConfetti] = useState(false);
  const [completionMessage, setCompletionMessage] = useState(null);

  const [tasks, setTasks] = useState([
    {
      id: 't1',
      name: 'Medical bill disputes',
      context: 'BCBS says they never received the claims',
      progress: 1,
      total: 5,
      subtasks: [
        { id: 1, text: 'Call BCBS to confirm they never received claims', completed: true },
        { id: 2, text: 'Request itemized bill from Vituity', completed: false },
        { id: 3, text: 'File No Surprises Act complaint', completed: false, link: 'https://www.cms.gov/nosurprises/consumers' },
        { id: 4, text: 'Send dispute letter to collections agency', completed: false },
        { id: 5, text: 'Follow up in 30 days', completed: false },
      ],
    },
    {
      id: 't2',
      name: 'File 2024 taxes',
      context: "You're owed a refund — no penalty for waiting",
      progress: 0,
      total: 4,
      subtasks: [
        { id: 1, text: 'Gather W-2s and 1099s', completed: false },
        { id: 2, text: 'Download last year\'s return for reference', completed: false },
        { id: 3, text: 'Complete FreeTaxUSA filing', completed: false, link: 'https://www.freetaxusa.com' },
        { id: 4, text: 'Submit and save confirmation', completed: false },
      ],
    },
  ]);

  useEffect(() => { setMounted(true); }, []);

  const c = darkMode ? {
    canvas: '#0a0a0a',
    surface: 'rgba(255, 255, 255, 0.05)',
    elevated: '#141414',
    text: '#f5f5f5',
    textSoft: '#a0a0a0',
    textMuted: '#555555',
    accent: '#E8A990',
    accentSoft: 'rgba(232, 169, 144, 0.12)',
    success: '#9ECBB3',
    successSoft: 'rgba(158, 203, 179, 0.12)',
    border: 'rgba(255, 255, 255, 0.1)',
    danger: '#E87A7A',
    dangerSoft: 'rgba(232, 122, 122, 0.12)',
  } : {
    canvas: '#FAFAFA',
    surface: 'rgba(0, 0, 0, 0.03)',
    elevated: '#FFFFFF',
    text: '#171717',
    textSoft: '#525252',
    textMuted: '#a3a3a3',
    accent: '#E07A5F',
    accentSoft: 'rgba(224, 122, 95, 0.1)',
    success: '#6B9080',
    successSoft: 'rgba(107, 144, 128, 0.1)',
    border: 'rgba(0, 0, 0, 0.06)',
    danger: '#DC6B6B',
    dangerSoft: 'rgba(220, 107, 107, 0.1)',
  };

  const realIdTask = {
    id: 't' + Date.now(),
    name: 'Get Real ID',
    context: 'Required for domestic flights starting May 7, 2025',
    progress: 0,
    total: 7,
    subtasks: [
      { id: 1, text: 'Find birth certificate or passport', completed: false },
      { id: 2, text: 'Find Social Security card', completed: false },
      { id: 3, text: 'Gather 2 proofs of CA residency', completed: false, link: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/real-id/how-do-i-get-a-real-id/real-id-checklist/', note: 'Utility bill, bank statement, or lease from last 90 days' },
      { id: 4, text: 'Fill out DL 44 form online', completed: false, link: 'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/dl-id-online-app-edl-44/' },
      { id: 5, text: 'Schedule DMV appointment', completed: false, link: 'https://www.dmv.ca.gov/portal/appointments/select-appointment-type' },
      { id: 6, text: 'Set aside $39 for fee', completed: false },
      { id: 7, text: 'Go to appointment with all documents', completed: false, isReminder: true },
    ],
  };

  const closeTaskModal = () => {
    setTaskModalClosing(true);
    setTimeout(() => {
      setSelectedTask(null);
      setTaskModalClosing(false);
      setTaskChatMessages([]);
      setTaskChatInput('');
    }, 250);
  };

  const closeAddModal = () => {
    setAddModalClosing(true);
    setTimeout(() => {
      setShowAddFlow(false);
      setAddModalClosing(false);
      setAddFlowStep(0);
    }, 250);
  };

  const updateTask = (taskId, updates) => {
    const newTasks = tasks.map(t => {
      if (t.id !== taskId) return t;
      const updated = { ...t, ...updates };
      if (updates.subtasks) {
        updated.progress = updates.subtasks.filter(s => s.completed).length;
        updated.total = updates.subtasks.length;
      }
      return updated;
    });
    setTasks(newTasks);
    if (selectedTask?.id === taskId) {
      const updated = newTasks.find(t => t.id === taskId);
      setSelectedTask(updated);
    }
  };

  const toggleSubtask = (taskId, subId) => {
    const task = tasks.find(t => t.id === taskId);
    const newSubtasks = task.subtasks.map(s => 
      s.id === subId ? { ...s, completed: !s.completed } : s
    );
    updateTask(taskId, { subtasks: newSubtasks });
    
    // Check if task is now complete
    const allDone = newSubtasks.every(s => s.completed);
    const wasDone = task.subtasks.every(s => s.completed);
    
    if (allDone && !wasDone) {
      // Just completed the whole task!
      setConfetti(true);
      setCompletionMessage(task.name);
      setTimeout(() => {
        setConfetti(false);
        setCompletionMessage(null);
      }, 3000);
    }
  };

  const deleteSubtask = (taskId, subId) => {
    const task = tasks.find(t => t.id === taskId);
    const newSubtasks = task.subtasks.filter(s => s.id !== subId);
    updateTask(taskId, { subtasks: newSubtasks });
  };

  const addSubtask = (taskId, text) => {
    const task = tasks.find(t => t.id === taskId);
    const newId = Math.max(...task.subtasks.map(s => s.id), 0) + 1;
    const newSubtasks = [...task.subtasks, { id: newId, text, completed: false }];
    updateTask(taskId, { subtasks: newSubtasks });
  };

  const updateSubtaskText = (taskId, subId, text) => {
    const task = tasks.find(t => t.id === taskId);
    const newSubtasks = task.subtasks.map(s =>
      s.id === subId ? { ...s, text } : s
    );
    updateTask(taskId, { subtasks: newSubtasks });
    setEditingSubtask(null);
  };

  const moveSubtask = (taskId, fromId, toId) => {
    if (fromId === toId) return;
    const task = tasks.find(t => t.id === taskId);
    const fromIdx = task.subtasks.findIndex(s => s.id === fromId);
    const toIdx = task.subtasks.findIndex(s => s.id === toId);
    const newSubtasks = [...task.subtasks];
    const [moved] = newSubtasks.splice(fromIdx, 1);
    newSubtasks.splice(toIdx, 0, moved);
    updateTask(taskId, { subtasks: newSubtasks });
  };

  const handleDragStart = (e, subtaskId) => {
    setDraggedSubtask(subtaskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, subtaskId) => {
    e.preventDefault();
    if (subtaskId !== draggedSubtask) {
      setDragOverSubtask(subtaskId);
    }
  };

  const handleDragEnd = () => {
    if (draggedSubtask && dragOverSubtask && selectedTask) {
      moveSubtask(selectedTask.id, draggedSubtask, dragOverSubtask);
    }
    setDraggedSubtask(null);
    setDragOverSubtask(null);
  };

  const deleteTask = (taskId) => {
    setTasks(tasks.filter(t => t.id !== taskId));
    closeTaskModal();
  };

  const handleInputSubmit = () => {
    if (!inputValue.trim()) return;
    setNewTaskTitle(inputValue);
    setShowAddFlow(true);
    setAddFlowStep(0);
    setInputValue('');
  };

  // Simulated AI chat responses
  const handleTaskChat = () => {
    if (!taskChatInput.trim()) return;
    const userMsg = taskChatInput;
    setTaskChatMessages([...taskChatMessages, { role: 'user', text: userMsg }]);
    setTaskChatInput('');
    setTaskChatThinking(true);

    setTimeout(() => {
      let response = '';
      const lower = userMsg.toLowerCase();
      
      if (lower.includes('birth certificate') && (lower.includes("can't find") || lower.includes('lost') || lower.includes("don't have"))) {
        response = "No worries — you can use a valid U.S. passport instead. If you don't have either, you can order a birth certificate replacement from your birth state's vital records office. California's takes about 2-3 weeks. Want me to add a step for that?";
      } else if (lower.includes('add') && lower.includes('step')) {
        const stepMatch = userMsg.match(/add (?:a )?step (?:for |to )?(.+)/i);
        if (stepMatch) {
          addSubtask(selectedTask.id, stepMatch[1].trim());
          response = `Added "${stepMatch[1].trim()}" to your steps.`;
        } else {
          response = "Sure, what step would you like to add?";
        }
      } else if (lower.includes('how long') || lower.includes('take')) {
        response = "The DMV appointment itself usually takes 30-45 minutes if you have all your documents ready. The whole process from gathering docs to getting your Real ID typically takes 2-4 weeks depending on appointment availability.";
      } else if (lower.includes('proof') && lower.includes('residency')) {
        response = "You need 2 documents showing your CA address. Common ones: utility bills, bank statements, rental agreements, mortgage bills, medical documents, or vehicle registration. They need to be from the last 90 days.";
      } else if (lower.includes('delete') || lower.includes('remove')) {
        response = "You can delete any step by clicking the × button that appears when you hover over it. Or tell me which step to remove and I'll do it.";
      } else {
        response = "I can help you with this task — ask me about specific steps, tell me to add/remove steps, or let me know if you're stuck on something.";
      }

      setTaskChatMessages(prev => [...prev, { role: 'ai', text: response }]);
      setTaskChatThinking(false);
    }, 1200);
  };

  const totalSteps = tasks.reduce((acc, t) => acc + t.total, 0);
  const completedSteps = tasks.reduce((acc, t) => acc + t.progress, 0);

  const Checkbox = ({ checked, onToggle, size = 24 }) => (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: checked ? c.success : 'transparent',
        border: `2px solid ${checked ? c.success : c.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        flexShrink: 0,
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 14 14">
        <path d="M2.5 7L6 10.5L11.5 4" fill="none" stroke={darkMode ? '#0a0a0a' : '#fff'}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: 16, strokeDashoffset: checked ? 0 : 16, transition: 'stroke-dashoffset 0.25s ease-out' }}
        />
      </svg>
    </button>
  );

  const Progress = ({ done, total }) => (
    <div style={{ display: 'flex', gap: 3, height: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          flex: 1, borderRadius: 2,
          backgroundColor: i < done ? c.success : c.border,
          transition: `all 0.3s ease ${i * 30}ms`,
        }} />
      ))}
    </div>
  );

  const IconButton = ({ children, onClick, danger, small, style = {} }) => (
    <button
      onClick={onClick}
      style={{
        width: small ? 28 : 32,
        height: small ? 28 : 32,
        borderRadius: small ? 6 : 8,
        border: 'none',
        backgroundColor: danger ? c.dangerSoft : c.surface,
        color: danger ? c.danger : c.textMuted,
        fontSize: small ? 14 : 16,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s ease',
        ...style,
      }}
      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
      onMouseUp={e => e.currentTarget.style.transform = 'scale(1.05)'}
    >
      {children}
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: c.canvas,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      transition: 'background-color 0.3s ease',
    }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes modalOut { from { opacity: 1; transform: scale(1) translateY(0); } to { opacity: 0; transform: scale(0.96) translateY(10px); } }
        @keyframes backdropIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes backdropOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes dotPulse { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.2); opacity: 1; } }
        @keyframes confettiFall {
          0% { transform: translateY(-100vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        @keyframes celebrateIn {
          0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
          100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        input::placeholder { color: ${c.textMuted}; }
        .subtask-row:hover .subtask-actions { opacity: 1; }
        .subtask-actions { opacity: 0; transition: opacity 0.15s ease; }
        .subtask-row[draggable="true"]:active { cursor: grabbing; }
      `}</style>

      {/* Confetti */}
      {confetti && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100, overflow: 'hidden' }}>
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: -20,
                width: Math.random() * 10 + 6,
                height: Math.random() * 10 + 6,
                backgroundColor: ['#E07A5F', '#81B29A', '#F4D35E', '#EE6C4D', '#98C1D9', '#6B9080'][Math.floor(Math.random() * 6)],
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                animation: `confettiFall ${Math.random() * 2 + 2}s linear ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
        </div>
      )}

      {/* Completion celebration message */}
      {completionMessage && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          pointerEvents: 'none',
          animation: 'celebrateIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            backgroundColor: c.elevated,
            padding: '24px 40px',
            borderRadius: 20,
            boxShadow: `0 20px 60px -15px rgba(0,0,0,0.3)`,
            textAlign: 'center',
            border: `1px solid ${c.border}`,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <p style={{ fontSize: 14, color: c.textMuted, marginBottom: 4 }}>You finished</p>
            <p style={{ fontSize: 20, fontWeight: 600, color: c.text }}>{completionMessage}</p>
            <p style={{ fontSize: 14, color: c.success, marginTop: 8 }}>Nice work!</p>
          </div>
        </div>
      )}

      {/* Add Flow Modal */}
      {showAddFlow && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div
            onClick={closeAddModal}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              animation: addModalClosing ? 'backdropOut 0.25s ease forwards' : 'backdropIn 0.2s ease',
            }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', width: '100%', maxWidth: 440,
              backgroundColor: c.elevated, borderRadius: 20, overflow: 'hidden',
              border: `1px solid ${c.border}`,
              animation: addModalClosing ? 'modalOut 0.25s ease forwards' : 'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <div style={{ padding: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text, marginBottom: 4 }}>{newTaskTitle}</h2>
              <p style={{ fontSize: 14, color: c.textMuted }}>Let me break this down</p>
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              {addFlowStep === 0 && !aiThinking && (
                <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
                  <div style={{
                    padding: 16, borderRadius: 12, backgroundColor: c.surface,
                    marginBottom: 20, borderLeft: `3px solid ${c.accent}`,
                  }}>
                    <p style={{ fontSize: 14, color: c.textSoft, lineHeight: 1.6 }}>
                      I'll research what's needed and create actionable steps with links.
                    </p>
                  </div>
                  <p style={{ fontWeight: 500, marginBottom: 12, color: c.text }}>Quick question:</p>
                  <p style={{ fontSize: 14, color: c.textSoft, marginBottom: 16 }}>Do you have your documents handy?</p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['Yes, mostly', 'Starting fresh'].map(opt => (
                      <button key={opt}
                        onClick={() => { setAiThinking(true); setTimeout(() => { setAiThinking(false); setAddFlowStep(1); }, 1800); }}
                        style={{
                          flex: 1, padding: '14px 16px', borderRadius: 12,
                          border: `1px solid ${c.border}`, backgroundColor: 'transparent',
                          color: c.text, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = c.surface}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                        onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                      >{opt}</button>
                    ))}
                  </div>
                </div>
              )}
              {aiThinking && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: 36, animation: 'float 1.5s ease-in-out infinite' }}>🧠</div>
                  </div>
                  <p style={{ fontWeight: 500, marginTop: 20, color: c.text }}>Researching...</p>
                </div>
              )}
              {addFlowStep === 1 && !aiThinking && (
                <div style={{ animation: 'fadeUp 0.3s ease-out' }}>
                  <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 16 }}>Here's what you need:</p>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {realIdTask.subtasks.map((st, i) => (
                      <div key={st.id} style={{
                        display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10,
                        backgroundColor: c.surface, marginBottom: 6,
                        animation: `fadeUp 0.3s ease-out ${i * 0.04}s both`,
                      }}>
                        <div style={{ width: 20, height: 20, borderRadius: 10, border: `2px solid ${c.border}`, flexShrink: 0, marginTop: 1 }} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, color: c.text, lineHeight: 1.4 }}>{st.text}</p>
                          {st.note && <p style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }}>{st.note}</p>}
                          {st.link && <a href={st.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: c.accent, marginTop: 6, display: 'inline-block', textDecoration: 'none' }}>Open link →</a>}
                          {st.isReminder && <p style={{ fontSize: 12, color: c.success, marginTop: 6 }}>🔔 I'll remind you</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: c.successSoft, fontSize: 13, color: c.success }}>
                    ℹ️ {realIdTask.context}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', gap: 10 }}>
              <button onClick={closeAddModal} style={{
                flex: 1, padding: 14, borderRadius: 12, border: 'none',
                backgroundColor: 'transparent', color: c.textMuted, fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>Cancel</button>
              {addFlowStep === 1 && (
                <button onClick={() => { setTasks([...tasks, { ...realIdTask, id: 't' + Date.now() }]); closeAddModal(); }}
                  style={{
                    flex: 1, padding: 14, borderRadius: 12, border: 'none',
                    backgroundColor: c.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >Add this</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div
            onClick={closeTaskModal}
            style={{
              position: 'absolute', inset: 0,
              backgroundColor: darkMode ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              animation: taskModalClosing ? 'backdropOut 0.25s ease forwards' : 'backdropIn 0.2s ease',
            }}
          />
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', width: '100%', maxWidth: 480,
              maxHeight: '90vh', backgroundColor: c.elevated, borderRadius: 20,
              overflow: 'hidden', display: 'flex', flexDirection: 'column',
              border: `1px solid ${c.border}`,
              animation: taskModalClosing ? 'modalOut 0.25s ease forwards' : 'modalIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            {/* Header */}
            <div style={{ padding: 20, borderBottom: `1px solid ${c.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 600, color: c.text }}>{selectedTask.name}</h2>
                  {selectedTask.context && <p style={{ fontSize: 13, color: c.textMuted, marginTop: 4 }}>{selectedTask.context}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                  <IconButton danger onClick={() => setShowDeleteConfirm(true)}>🗑</IconButton>
                  <IconButton onClick={closeTaskModal}>×</IconButton>
                </div>
              </div>
              <Progress done={selectedTask.subtasks.filter(s => s.completed).length} total={selectedTask.total} />
              <p style={{ fontSize: 12, color: c.textMuted, marginTop: 8 }}>
                {selectedTask.subtasks.filter(s => s.completed).length} of {selectedTask.total} done
              </p>
            </div>

            {/* Delete confirmation */}
            {showDeleteConfirm && (
              <div style={{
                padding: 16, backgroundColor: c.dangerSoft, borderBottom: `1px solid ${c.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <p style={{ fontSize: 14, color: c.danger }}>Delete this task?</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    backgroundColor: 'transparent', color: c.textMuted, fontSize: 13, cursor: 'pointer',
                  }}>Cancel</button>
                  <button onClick={() => deleteTask(selectedTask.id)} style={{
                    padding: '6px 12px', borderRadius: 8, border: 'none',
                    backgroundColor: c.danger, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  }}>Delete</button>
                </div>
              </div>
            )}

            {/* Subtasks */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {selectedTask.subtasks.map((st) => (
                <div key={st.id} className="subtask-row"
                  draggable={editingSubtask !== st.id}
                  onDragStart={(e) => handleDragStart(e, st.id)}
                  onDragOver={(e) => handleDragOver(e, st.id)}
                  onDragEnd={handleDragEnd}
                  onDragLeave={() => setDragOverSubtask(null)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: 10, borderRadius: 10,
                    backgroundColor: st.completed ? 'transparent' : c.surface, marginBottom: 6,
                    opacity: draggedSubtask === st.id ? 0.4 : (st.completed ? 0.5 : 1),
                    transition: 'all 0.2s ease',
                    cursor: editingSubtask === st.id ? 'text' : 'grab',
                    borderTop: dragOverSubtask === st.id && draggedSubtask !== st.id ? `2px solid ${c.accent}` : '2px solid transparent',
                    transform: dragOverSubtask === st.id && draggedSubtask !== st.id ? 'translateY(2px)' : 'translateY(0)',
                  }}>
                  <Checkbox checked={st.completed} onToggle={() => toggleSubtask(selectedTask.id, st.id)} size={22} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {editingSubtask === st.id ? (
                      <input
                        autoFocus
                        value={editingText}
                        onChange={e => setEditingText(e.target.value)}
                        onBlur={() => { if (editingText.trim()) updateSubtaskText(selectedTask.id, st.id, editingText); else setEditingSubtask(null); }}
                        onKeyDown={e => { if (e.key === 'Enter' && editingText.trim()) updateSubtaskText(selectedTask.id, st.id, editingText); if (e.key === 'Escape') setEditingSubtask(null); }}
                        style={{
                          width: '100%', fontSize: 14, padding: '4px 8px', borderRadius: 6,
                          border: `1px solid ${c.accent}`, backgroundColor: c.canvas, color: c.text, outline: 'none',
                        }}
                      />
                    ) : (
                      <p
                        onClick={() => { setEditingSubtask(st.id); setEditingText(st.text); }}
                        style={{
                          fontSize: 14, color: st.completed ? c.textMuted : c.text,
                          textDecoration: st.completed ? 'line-through' : 'none',
                          cursor: 'text', lineHeight: 1.4,
                        }}
                      >{st.text}</p>
                    )}
                    {st.link && !st.completed && (
                      <a href={st.link} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 12, color: c.accent, marginTop: 4, display: 'inline-block', textDecoration: 'none' }}>
                        Open link →
                      </a>
                    )}
                  </div>
                  <div className="subtask-actions" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <span style={{ cursor: 'grab', color: c.textMuted, fontSize: 14, padding: '0 4px' }}>⋮⋮</span>
                    <IconButton small danger onClick={() => deleteSubtask(selectedTask.id, st.id)}>×</IconButton>
                  </div>
                </div>
              ))}
              
              {/* Add subtask inline */}
              <button
                onClick={() => {
                  const text = prompt('Add a step:');
                  if (text?.trim()) addSubtask(selectedTask.id, text.trim());
                }}
                style={{
                  width: '100%', padding: 12, borderRadius: 10, border: `1px dashed ${c.border}`,
                  backgroundColor: 'transparent', color: c.textMuted, fontSize: 14, cursor: 'pointer',
                  textAlign: 'left', marginTop: 4, transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = c.accent; e.currentTarget.style.color = c.accent; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = c.border; e.currentTarget.style.color = c.textMuted; }}
              >
                + Add a step
              </button>
            </div>

            {/* Chat area */}
            <div style={{ borderTop: `1px solid ${c.border}`, backgroundColor: c.surface }}>
              {/* Chat messages */}
              {taskChatMessages.length > 0 && (
                <div style={{ maxHeight: 150, overflowY: 'auto', padding: '12px 16px' }}>
                  {taskChatMessages.map((msg, i) => (
                    <div key={i} style={{
                      marginBottom: 8,
                      textAlign: msg.role === 'user' ? 'right' : 'left',
                    }}>
                      <span style={{
                        display: 'inline-block', padding: '8px 12px', borderRadius: 12,
                        fontSize: 13, lineHeight: 1.4, maxWidth: '85%',
                        backgroundColor: msg.role === 'user' ? c.accent : c.elevated,
                        color: msg.role === 'user' ? '#fff' : c.text,
                      }}>{msg.text}</span>
                    </div>
                  ))}
                  {taskChatThinking && (
                    <div style={{ display: 'flex', gap: 4, padding: '8px 0' }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: 8, height: 8, borderRadius: 4, backgroundColor: c.textMuted,
                          animation: `dotPulse 1s ease-in-out ${i * 0.15}s infinite`,
                        }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
              
              {/* Chat input */}
              <div style={{ padding: 12, display: 'flex', gap: 8 }}>
                <input
                  value={taskChatInput}
                  onChange={e => setTaskChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTaskChat()}
                  placeholder="Ask me anything about this task..."
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 10,
                    border: `1px solid ${c.border}`, backgroundColor: c.elevated,
                    color: c.text, fontSize: 14, outline: 'none',
                  }}
                />
                {taskChatInput && (
                  <button
                    onClick={handleTaskChat}
                    style={{
                      padding: '10px 16px', borderRadius: 10, border: 'none',
                      backgroundColor: c.accent, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer',
                    }}
                  >Send</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: c.text }}>Gather</h1>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            borderRadius: 20, border: `1px solid ${c.border}`, backgroundColor: c.surface, cursor: 'pointer',
          }}
        >
          <div style={{
            width: 36, height: 20, borderRadius: 10, backgroundColor: darkMode ? c.accent : c.border,
            position: 'relative', transition: 'background-color 0.2s ease',
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff',
              position: 'absolute', top: 2, left: darkMode ? 18 : 2,
              transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span style={{ fontSize: 13, color: c.textSoft }}>{darkMode ? 'Dark' : 'Light'}</span>
        </button>
      </header>

      <main style={{ padding: '0 24px 48px', maxWidth: 540, margin: '0 auto' }}>
        {/* Hero Input */}
        <div style={{
          marginBottom: 48, opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(20px)',
          transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            backgroundColor: c.elevated, borderRadius: 20,
            border: `1px solid ${inputFocused ? c.accent : c.border}`,
            boxShadow: inputFocused
              ? `0 0 0 3px ${c.accentSoft}, 0 20px 40px -15px rgba(0,0,0,${darkMode ? 0.4 : 0.12})`
              : `0 2px 12px -4px rgba(0,0,0,${darkMode ? 0.3 : 0.08})`,
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transform: inputFocused ? 'scale(1.01)' : 'scale(1)',
          }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <input
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleInputSubmit()}
                placeholder="What's on your mind?"
                style={{
                  width: '100%', fontSize: 20, fontWeight: 500, border: 'none',
                  outline: 'none', backgroundColor: 'transparent', color: c.text,
                }}
              />
            </div>
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: 14, color: c.textMuted }}>
                {inputFocused ? "I'll break it into steps" : "Dump it here — I'll make it doable"}
              </p>
              {inputValue && (
                <button onClick={handleInputSubmit} style={{
                  padding: '10px 20px', borderRadius: 10, border: 'none',
                  backgroundColor: c.accent, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', marginLeft: 12,
                }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                >Break it down</button>
              )}
            </div>
          </div>
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div style={{
            opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(20px)',
            transition: 'all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                In progress
              </p>
              <p style={{ fontSize: 13, color: c.textMuted }}>{completedSteps}/{totalSteps} steps</p>
            </div>
            <div>
              {tasks.map((task, i) => (
                <div key={task.id} onClick={() => { setSelectedTask(task); setShowDeleteConfirm(false); }}
                  style={{
                    padding: 20, borderRadius: 16, backgroundColor: c.elevated,
                    border: `1px solid ${c.border}`, marginBottom: 12, cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    animation: `fadeUp 0.5s ease-out ${i * 0.08}s both`,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.01) translateY(-2px)';
                    e.currentTarget.style.boxShadow = `0 8px 24px -8px rgba(0,0,0,${darkMode ? 0.4 : 0.12})`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1) translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <p style={{ fontSize: 16, fontWeight: 600, color: c.text }}>{task.name}</p>
                    <span style={{ fontSize: 12, color: c.textMuted, marginLeft: 12 }}>{task.progress}/{task.total}</span>
                  </div>
                  {task.context && <p style={{ fontSize: 13, color: c.textMuted, marginBottom: 12 }}>{task.context}</p>}
                  <Progress done={task.progress} total={task.total} />
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px', opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease 0.2s' }}>
            <p style={{ fontSize: 32, marginBottom: 16 }}>✨</p>
            <p style={{ fontSize: 15, color: c.textSoft, lineHeight: 1.6 }}>Nothing yet.<br/>Type something above to start.</p>
          </div>
        )}
      </main>
    </div>
  );
}
