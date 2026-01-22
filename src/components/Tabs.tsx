'use client'

interface TabsProps {
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div className="flex justify-center gap-0.5 mb-8 bg-surface p-1 rounded-full w-fit mx-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2 rounded-full text-sm transition-all ${
            activeTab === tab.id
              ? 'bg-elevated text-text shadow-soft'
              : 'text-text-soft hover:text-text'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
