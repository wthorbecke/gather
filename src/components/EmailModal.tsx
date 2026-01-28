'use client'

import { useState } from 'react'
import { Modal } from './Modal'

interface EmailTemplate {
  to: string
  subject: string
  body: string
}

interface EmailModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  template: EmailTemplate
}

export function EmailModal({ isOpen, onClose, title, template }: EmailModalProps) {
  const [memberId, setMemberId] = useState('')
  const [groupNumber, setGroupNumber] = useState('')
  const [copied, setCopied] = useState(false)

  const getFilledBody = () => {
    return template.body
      .replace('[MEMBER_ID]', memberId || '[YOUR MEMBER ID]')
      .replace('[GROUP_NUMBER]', groupNumber || '[YOUR GROUP NUMBER]')
  }

  const copyEmail = () => {
    const fullEmail = `Subject: ${template.subject}\n\n${getFilledBody()}`
    navigator.clipboard.writeText(fullEmail)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-surface border border-border text-text-soft rounded-lg text-[0.8rem] hover:bg-canvas transition-all btn-press tap-target"
          >
            Close
          </button>
          <button
            onClick={copyEmail}
            className="px-4 py-2.5 bg-text text-white rounded-lg text-[0.8rem] hover:opacity-90 transition-opacity btn-press tap-target"
          >
            {copied ? 'Copied!' : 'Copy to clipboard'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-[0.8rem] text-text-muted mb-1.5">To</label>
          <input
            type="text"
            value={template.to}
            readOnly
            className="w-full px-4 py-2.5 border border-border rounded-lg text-[0.9rem] bg-canvas"
          />
        </div>
        <div>
          <label className="block text-[0.8rem] text-text-muted mb-1.5">Subject</label>
          <input
            type="text"
            value={template.subject}
            readOnly
            className="w-full px-4 py-2.5 border border-border rounded-lg text-[0.9rem] bg-canvas"
          />
        </div>
        <div>
          <label className="block text-[0.8rem] text-text-muted mb-1.5">
            Your BCBS Member ID
          </label>
          <input
            type="text"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            placeholder="Enter your member ID"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-[0.9rem] bg-canvas focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-[0.8rem] text-text-muted mb-1.5">
            Your Group Number
          </label>
          <input
            type="text"
            value={groupNumber}
            onChange={(e) => setGroupNumber(e.target.value)}
            placeholder="Enter your group number"
            className="w-full px-4 py-2.5 border border-border rounded-lg text-[0.9rem] bg-canvas focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-[0.8rem] text-text-muted mb-2">
            Email body — copy this:
          </label>
          <div className="bg-canvas rounded-xl p-5 text-[0.85rem] leading-relaxed whitespace-pre-wrap border border-border">
            {getFilledBody()}
          </div>
        </div>
      </div>
    </Modal>
  )
}
