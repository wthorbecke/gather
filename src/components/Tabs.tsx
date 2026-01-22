'use client'

import { useState } from 'react'

interface TabsProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex justify-center gap-0.5 md:gap-1 mb-12 bg-[var(--bg-warm)] p-1 rounded-full w-fit mx-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 md:px-6 py-2 md:py-2.5 rounded-full text-[0.8rem] md:text-sm transition-all ${
            activeTab === tab.id
              ? 'bg-white text-[var(--text)] shadow-soft'
              : 'text-[var(--text-soft)] hover:text-[var(--text)]'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
