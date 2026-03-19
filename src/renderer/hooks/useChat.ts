import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage, SkillInfo, ToolStep, ConversationSummary } from '../../preload/index'

interface UseChatOptions {
  skipAutoLoad?: boolean
}

export function useChat(options: UseChatOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [activeSkill, setActiveSkill] = useState<string | null>(null)
  const [liveSteps, setLiveSteps] = useState<ToolStep[]>([])
  const [streamingText, setStreamingText] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.dex.chat.getApiKeyStatus().then(setHasApiKey)
    window.dex.vault.getSkills().then(setSkills)
    refreshConversations().then(async () => {
      if (options.skipAutoLoad) return
      const list = await window.dex.conversations.list()
      if (list.length > 0) {
        const conv = await window.dex.conversations.load(list[0].id)
        if (conv) {
          setMessages(conv.messages)
          setActiveSkill(conv.activeSkill)
          setConversationId(conv.id)
        }
      }
    })
  }, [])

  const isInitialLoad = useRef(true)

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, liveSteps, streamingText])

  useEffect(() => {
    const unsub = window.dex.chat.onToolStep((step) => {
      setLiveSteps(prev => {
        const existing = prev.findIndex(s => s.tool === step.tool && s.status === 'running')
        if (existing >= 0 && step.status !== 'running') {
          const updated = [...prev]
          updated[existing] = step
          return updated
        }
        return [...prev, step]
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsubStart = window.dex.chat.onStreamStart(() => {
      setStreamingText('')
    })
    const unsubDelta = window.dex.chat.onTextDelta((delta) => {
      setStreamingText(prev => prev + delta)
    })
    return () => { unsubStart(); unsubDelta() }
  }, [])

  const refreshConversations = useCallback(async () => {
    const list = await window.dex.conversations.list()
    setConversations(list)
  }, [])

  const saveConversation = useCallback(async (msgs: ChatMessage[], skill: string | null, convId: string | null) => {
    if (msgs.length < 2) return null

    const id = convId || `conv-${Date.now()}`
    const firstUserMsg = msgs.find(m => m.role === 'user')
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '')
      : 'New conversation'

    await window.dex.conversations.save({
      id,
      title,
      messages: msgs,
      activeSkill: skill,
      createdAt: convId ? (await window.dex.conversations.load(id))?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now()
    })

    refreshConversations()
    return id
  }, [refreshConversations])

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return

    let skillContext: string | undefined
    const skillMatch = text.match(/^\/([a-z0-9-]+)(.*)$/i)

    if (skillMatch) {
      const cmd = `/${skillMatch[1]}`
      const skill = skills.find(s => s.command === cmd)
      if (skill) {
        try {
          skillContext = await window.dex.vault.readSkill(skill.skillPath)
          setActiveSkill(skill.name)
        } catch { /* skill file not readable */ }
      }
    }

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setLiveSteps([])
    setStreamingText('')

    try {
      const response = await window.dex.chat.sendMessage(newMessages, skillContext || activeSkill ? skillContext : undefined)
      const finalMessages: ChatMessage[] = [
        ...newMessages,
        {
          role: 'assistant',
          content: response.text,
          toolSteps: response.toolSteps.length > 0 ? response.toolSteps : undefined
        }
      ]
      setMessages(finalMessages)

      const id = await saveConversation(finalMessages, activeSkill, conversationId)
      if (id && !conversationId) setConversationId(id)
    } catch {
      const errorMessages: ChatMessage[] = [
        ...newMessages,
        { role: 'assistant', content: 'Failed to get response. Check your API key.' }
      ]
      setMessages(errorMessages)
    } finally {
      setLoading(false)
      setLiveSteps([])
      setStreamingText('')
      inputRef.current?.focus()
    }
  }, [input, loading, messages, skills, activeSkill, conversationId, saveConversation])

  const setApiKey = useCallback(async (key: string) => {
    if (!key.trim()) return
    await window.dex.chat.setApiKey(key.trim())
    setHasApiKey(true)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveSkill(null)
    setLiveSteps([])
    setStreamingText('')
    setConversationId(null)
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    const conv = await window.dex.conversations.load(id)
    if (!conv) return
    isInitialLoad.current = true
    setMessages(conv.messages)
    setActiveSkill(conv.activeSkill)
    setConversationId(conv.id)
    setLiveSteps([])
    setStreamingText('')
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    await window.dex.conversations.delete(id)
    if (conversationId === id) clearMessages()
    refreshConversations()
  }, [conversationId, clearMessages, refreshConversations])

  return {
    messages, input, setInput, loading, hasApiKey, skills, activeSkill,
    liveSteps, streamingText, conversations, conversationId,
    bottomRef, inputRef, send, setApiKey, clearMessages,
    loadConversation, deleteConversation
  }
}
