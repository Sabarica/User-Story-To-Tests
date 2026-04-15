import { useState } from 'react'

export interface LLMModel {
  id: string
  name: string
  provider: string
  description: string
  icon: string
  recommended?: boolean
}

const MODELS: LLMModel[] = [
  {
    id: 'gpt-5.4',
    name: 'GPT-5.4',
    provider: 'OPENAI',
    description: 'Flagship model - Best for complex reasoning & coding',
    icon: '🧠',
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 Mini',
    provider: 'OPENAI',
    description: 'Fast & capable - Great for coding tasks',
    icon: '💎',
  },
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 Nano',
    provider: 'OPENAI',
    description: 'Most affordable - Simple high-volume tasks',
    icon: '⚡',
  },
  {
    id: 'llama-4-scout',
    name: 'Llama 4 Scout (Recommended)',
    provider: 'GROQ',
    description: 'Fast & balanced - Comprehensive test cases',
    icon: '🦙',
    recommended: true,
  },
  {
    id: 'mixtral-8x7b',
    name: 'Mixtral 8x7B',
    provider: 'GROQ',
    description: 'More powerful - Complex scenarios',
    icon: '🎨',
  },
  {
    id: 'gemma-7b',
    name: 'Gemma 7B',
    provider: 'GROQ',
    description: 'Lightweight - Quick generations',
    icon: '⚙️',
  },
]

interface LLMModelSelectorProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
}

export function LLMModelSelector({ selectedModel, onModelChange }: LLMModelSelectorProps) {
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>⚙️</span>
        <span style={styles.headerTitle}>LLM Model Selection</span>
      </div>
      <p style={styles.subtitle}>Choose your preferred AI model for test generation</p>

      <div style={styles.grid}>
        {MODELS.map((model) => {
          const isSelected = selectedModel === model.id
          return (
            <label
              key={model.id}
              style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : {}),
              }}
              onClick={() => onModelChange(model.id)}
            >
              <div style={styles.radioRow}>
                <input
                  type="radio"
                  name="llm-model"
                  value={model.id}
                  checked={isSelected}
                  onChange={() => onModelChange(model.id)}
                  style={styles.radio}
                />
                {model.recommended && <span style={styles.recommendedBadge}>✓</span>}
              </div>
              <div style={styles.iconContainer}>
                <span style={styles.modelIcon}>{model.icon}</span>
              </div>
              <div style={styles.modelName}>{model.name}</div>
              <div style={styles.provider}>{model.provider}</div>
              <div style={styles.description}>{model.description}</div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  wrapper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '1px solid #e0e0e0',
    padding: '24px 28px',
    marginBottom: 24,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: '#2c3e50',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 20,
    marginTop: 4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 14,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px 12px 18px',
    borderRadius: 10,
    border: '2px solid #e8e8e8',
    backgroundColor: '#fafafa',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'center',
    position: 'relative',
  },
  cardSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
    boxShadow: '0 0 0 1px #1976d2',
  },
  radioRow: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  radio: {
    accentColor: '#1976d2',
    width: 16,
    height: 16,
    cursor: 'pointer',
  },
  recommendedBadge: {
    backgroundColor: '#1976d2',
    color: 'white',
    borderRadius: '50%',
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
  },
  iconContainer: {
    marginBottom: 8,
  },
  modelIcon: {
    fontSize: 32,
  },
  modelName: {
    fontWeight: 700,
    fontSize: 13,
    color: '#333',
    marginBottom: 2,
    lineHeight: 1.3,
  },
  provider: {
    fontSize: 11,
    color: '#999',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    color: '#777',
    lineHeight: 1.4,
  },
}
