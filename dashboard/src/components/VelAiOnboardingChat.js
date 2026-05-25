import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';

import BlobLoader from './BlobLoader';
import { VelAiChatWidget } from './VelAiChatWidgets';
import { getErrorMessage } from '../lib/network';
import { resolveApiUrl } from '../lib/api';
import { isVelAiInfoComplete, mergeVelAiPatch } from '../lib/velaiOnboarding';

const VelAiMark = ({ size = 28, className = '' }) => (
  <img
    src="/logo.png"
    alt="VelAI"
    width={size}
    height={size}
    className={`rounded-md object-contain ${className}`}
    draggable={false}
  />
);

const renderMarkdownLite = (text) => {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-medium text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

const toApiMessages = (messages) =>
  messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.text }));

export default function VelAiOnboardingChat({ form, onFormChange, onComplete }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [localError, setLocalError] = useState('');
  const [activeWidget, setActiveWidget] = useState(null);
  const [quickReplies, setQuickReplies] = useState([]);
  const [aiReady, setAiReady] = useState(null);
  const [serverComplete, setServerComplete] = useState(false);
  const scrollRef = useRef(null);
  const bootedRef = useRef(false);
  const formRef = useRef(form);

  formRef.current = form;

  const complete = useMemo(
    () => isVelAiInfoComplete(form, serverComplete),
    [form, serverComplete]
  );

  const applyServerResult = useCallback((result, baseForm) => {
    const patch = { ...(result.patch || {}) };
    delete patch.avatarUrl;
    delete patch.workspaceImageUrl;
    const merged = mergeVelAiPatch(baseForm, patch);
    if (result.patch?.workspaceName) {
      merged.workspaceName = result.patch.workspaceName;
    } else if (!merged.workspaceName && merged.name) {
      merged.workspaceName = merged.workspaceName || '';
    }

    onFormChange(merged);
    setActiveWidget(result.widget && result.widget !== 'avatar' ? result.widget : null);
    setQuickReplies(result.quickReplies || []);
    setServerComplete(Boolean(result.complete));

    return merged;
  }, [onFormChange]);

  const callVelAi = useCallback(async ({ userMessage = '', bootstrap = false, history }) => {
    const response = await axios.post(resolveApiUrl('/api/onboarding/velai-chat'), {
      form: formRef.current,
      messages: toApiMessages(history || []),
      userMessage,
      bootstrap
    });
    return response.data;
  }, []);

  const appendAssistant = useCallback((text, widget = null) => {
    const safeWidget = widget && widget !== 'avatar' ? widget : null;
    setMessages((current) => [
      ...current,
      { id: `a-${Date.now()}-${Math.random()}`, role: 'assistant', text, widget: safeWidget }
    ]);
    if (safeWidget) setActiveWidget(safeWidget);
  }, []);

  const runAssistantTurn = useCallback(async ({ userMessage = '', bootstrap = false }) => {
    setTyping(true);
    setLocalError('');

    try {
      const history = bootstrap
        ? []
        : messages;
      const result = await callVelAi({
        userMessage,
        bootstrap,
        history: bootstrap ? [] : history
      });

      applyServerResult(result, formRef.current);
      appendAssistant(result.message, result.widget);
    } catch (err) {
      const message = getErrorMessage(err, 'VelAI could not respond. Check backend and GITHUB_TOKEN.');
      setLocalError(message);
      appendAssistant(message);
    } finally {
      setTyping(false);
    }
  }, [appendAssistant, applyServerResult, callVelAi, messages]);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const status = await axios.get(resolveApiUrl('/api/onboarding/velai-status'));
        if (!cancelled) setAiReady(Boolean(status.data?.configured));
      } catch {
        if (!cancelled) setAiReady(false);
      }
      await runAssistantTurn({ bootstrap: true });
    })();

    return () => { cancelled = true; };
  }, [runAssistantTurn]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, activeWidget]);

  useEffect(() => {
    if (complete) onComplete?.();
  }, [complete, onComplete]);

  const sendMessage = async (rawText) => {
    const text = String(rawText || '').trim();
    if (!text || typing) return;

    setInput('');
    setQuickReplies([]);
    const nextMessages = [
      ...messages,
      { id: `u-${Date.now()}`, role: 'user', text }
    ];
    setMessages(nextMessages);
    await runAssistantTurn({ userMessage: text, history: nextMessages });
  };

  const handleSend = (event) => {
    event?.preventDefault?.();
    sendMessage(input);
  };

  const handleWidgetPatch = async (patch) => {
    const merged = mergeVelAiPatch(formRef.current, patch);
    onFormChange(merged);
    formRef.current = merged;
    await runAssistantTurn({
      userMessage: `I updated: ${JSON.stringify(patch)}`,
      history: messages
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-zinc-600">
        <span>
          {aiReady === null ? 'Connecting…' : aiReady ? 'Powered by GitHub Models · gpt-4.1-mini' : 'Basic mode — set GITHUB_TOKEN on backend'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-800/80 bg-[#0c0c0c] px-3 py-3"
      >
        {messages.map((message) => (
          <div key={message.id}>
            <div
              className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {message.role === 'assistant' && <VelAiMark size={24} className="mt-0.5 flex-shrink-0" />}
              <div
                className={`max-w-[88%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-[#EA803A] text-black'
                    : 'border border-zinc-800 bg-[#141414] text-zinc-300'
                }`}
              >
                {message.role === 'assistant' ? renderMarkdownLite(message.text) : message.text}
              </div>
            </div>
            {message.role === 'assistant' && message.widget && (
              <div className="ml-8">
                <VelAiChatWidget
                  widget={message.widget}
                  form={form}
                  onPatch={handleWidgetPatch}
                />
              </div>
            )}
          </div>
        ))}

        {activeWidget && !messages.some((m) => m.widget === activeWidget) && (
          <div className="ml-8">
            <VelAiChatWidget
              widget={activeWidget}
              form={form}
              onPatch={handleWidgetPatch}
            />
          </div>
        )}

        {typing && (
          <div className="flex items-center gap-2 pl-1">
            <VelAiMark size={24} className="flex-shrink-0 opacity-70" />
            <span className="text-[12px] text-zinc-500">VelAI is thinking…</span>
          </div>
        )}
      </div>

      {quickReplies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              disabled={typing}
              onClick={() => sendMessage(reply)}
              className="rounded-md border border-zinc-800 bg-[#121212] px-2.5 py-1 text-[11px] text-zinc-400 disabled:opacity-40"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSend} className="mt-3 flex-shrink-0">
        {localError && (
          <p className="mb-1.5 text-[11px] text-red-400">{localError}</p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            rows={1}
            placeholder="Message VelAI…"
            disabled={typing}
            className="min-h-[40px] max-h-20 flex-1 resize-none rounded-lg border border-zinc-800 bg-[#0c0c0c] px-3 py-2 text-[13px] text-white outline-none placeholder:text-zinc-600 focus:border-zinc-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || typing}
            className="inline-flex h-[40px] min-w-[64px] items-center justify-center rounded-lg bg-[#EA803A] px-3 text-[12px] font-semibold text-black disabled:opacity-40"
          >
            {typing ? <BlobLoader size={16} label="" /> : 'Send'}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-zinc-600">
          {complete ? 'Ready — press Continue below' : 'Enter to send'}
        </p>
      </form>
    </div>
  );
}
