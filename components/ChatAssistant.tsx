
import { FormEvent, useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { useIndexedDB } from "../hooks/useIndexedDB";
import { useLifeOSStore } from "../store/useLifeOSStore";
import type { LifeOSChatMessage } from "../types/data";
import { summarizeData } from "../utils/analyzeData";
import { Sparkles, Send, Bot, User, MessageCircle, Cpu, Mic, MicOff, Loader2 } from "lucide-react";
import { fetchChatResponse } from "../utils/fileManagerApi";
import { useWhisper } from "../hooks/useWhisper";



const ChatAssistant = () => {
  const [input, setInput] = useState("");
  const [answering, setAnswering] = useState(false);

  const {
    isRecording,
    isTranscribing,
    transcription,
    startRecording,
    stopRecording
  } = useWhisper();

  const {
    appendChatMessage,
    chatHistory,
    setChatHistory,
    records,
    summary,
    timeframe,
  } = useLifeOSStore();
  const { addChatMessage, getChatHistory, resetChatHistory } = useIndexedDB();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatHistory().then(setChatHistory);
  }, [getChatHistory, setChatHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chatHistory, answering]);

  // When whisper completes transcription, populate the input automatically
  useEffect(() => {
    if (transcription) {
      setInput((prev) => prev.trim() ? prev + " " + transcription : transcription);
    }
  }, [transcription]);

  const respond = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim()) return;

    const userMessage: LifeOSChatMessage = {
      id: nanoid(),
      role: "user",
      content: input.trim(),
      createdAt: Date.now(),
    };

    setAnswering(true);
    appendChatMessage(userMessage);
    await addChatMessage(userMessage);

    const syntheticId = nanoid();
    const assistantMessage: LifeOSChatMessage = {
      id: syntheticId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    appendChatMessage(assistantMessage);
    setInput("");

    try {
      // Create context mapping for API requests
      const apiMessages = chatHistory.map(m => ({
        role: m.role,
        content: m.content
      }));
      apiMessages.push({ role: "user", content: input.trim() });

      // Append summary as a system message
      const systemContext = summary ?? summarizeData(records, timeframe);
      apiMessages.unshift({
        role: "system" as any,
        content: `You are LifeOS, a private offline intelligence hub. Answer queries using the following context summary: ${systemContext.narrative}`
      });

      setAnswering(true);
      
      const response = await fetchChatResponse(apiMessages);
      useLifeOSStore.getState().updateChatMessage(syntheticId, response.message.content);
      await addChatMessage({ ...assistantMessage, content: response.message.content });

    } catch (error) {
      console.error(error);
      useLifeOSStore.getState().updateChatMessage(syntheticId, "I encountered an error analyzing that data locally. Please try again.");
    } finally {
      setAnswering(false);
    }
  };

  const handleResetChat = async () => {
    if (window.confirm("Are you sure you want to start a new chat? This will permanently delete the current conversation history to maintain your privacy.")) {
        // Clear from IndexedDB
        await resetChatHistory();
        // Clear from active Zustand UI state
        setChatHistory([]);
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 animate-fade-in">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-3xl border border-champagne-200/50 bg-gradient-to-r from-white/95 via-champagne-50/30 to-white/95 px-8 py-6 shadow-premium backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90">
        {/* Decorative Elements */}
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gradient-to-br from-champagne-400/20 to-blush-400/10 blur-2xl" />

        <div className="relative flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-champagne-400 to-blush-500 shadow-md shadow-champagne-500/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.25em] text-champagne-500 dark:text-champagne-400">
                Ask LifeOS
              </span>
              <div className="flex items-center gap-2">
                <p className="text-sm text-navy-600/80 dark:text-slate-300">
                  Converse with your data insights using true local AI
                </p>
                <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:bg-green-500/20 dark:text-green-400">
                  <Cpu className="h-3 w-3" /> Ollama Engine
                </span>
              </div>
            </div>
          </div>

          {/* Sample Questions */}
          <div className="flex flex-wrap gap-2">
            {[
              "Summarize last week's habits",
              "Which category grew fastest?",
              "Forecast my activity",
            ].map((question) => (
              <button
                key={question}
                onClick={() => setInput(question)}
                className="rounded-xl border border-champagne-200/50 bg-white/60 px-4 py-2 text-xs font-medium text-navy-600 transition-all hover:border-champagne-400 hover:bg-champagne-50 dark:border-champagne-500/20 dark:bg-navy-800/50 dark:text-champagne-300 dark:hover:border-champagne-400/50"
              >
                "{question}"
              </button>
            ))}
          </div>

          <button
            onClick={handleResetChat}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-champagne-300 bg-white/80 px-4 py-2 text-xs font-semibold text-champagne-600 transition-all hover:border-champagne-500 hover:bg-champagne-50 hover:text-champagne-700 hover:shadow-sm dark:border-champagne-500/30 dark:bg-navy-800/80 dark:text-champagne-300 dark:hover:border-champagne-400 dark:hover:bg-navy-700/80"
          >
            <MessageCircle className="h-3.5 w-3.5" /> New Chat
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-3xl border border-champagne-200/50 bg-gradient-to-b from-white/80 via-champagne-50/20 to-white/80 p-6 shadow-inner backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/60 dark:via-navy-800/40 dark:to-navy-900/60"
      >
        {chatHistory.length ? (
          <div className="space-y-6">
            {chatHistory.map((message, index) => (
              <div
                key={message.id}
                className="space-y-2 animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                  {message.role === "user" ? (
                    <>
                      <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-blush-400 to-blush-500 flex items-center justify-center">
                        <User className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-blush-500 dark:text-blush-400">You</span>
                    </>
                  ) : (
                    <>
                      <div className="h-5 w-5 rounded-lg bg-gradient-to-br from-champagne-400 to-champagne-500 flex items-center justify-center">
                        <Bot className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-champagne-500 dark:text-champagne-400">LifeOS</span>
                    </>
                  )}
                </div>
                <div
                  className={`max-w-3xl rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-sm ${message.role === "user"
                    ? "ml-auto bg-gradient-to-r from-blush-500 to-blush-600 text-white border border-blush-400/30"
                    : "bg-gradient-to-r from-white/95 to-champagne-50/50 text-navy-700 border border-champagne-200/50 dark:from-navy-800/90 dark:to-navy-900/70 dark:text-champagne-100 dark:border-champagne-500/20"
                    }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center py-16">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-champagne-100 to-blush-100 dark:from-champagne-900/30 dark:to-blush-900/30 flex items-center justify-center mb-6">
              <MessageCircle className="h-10 w-10 text-champagne-400" />
            </div>
            <p className="text-lg font-display font-semibold text-navy-900 dark:text-white mb-2">
              Start a conversation
            </p>
            <p className="text-sm text-navy-500 dark:text-slate-400 max-w-md">
              Ask your first question to begin exploring your personal data insights.
            </p>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={respond}
        className="flex items-center gap-3 rounded-3xl border border-champagne-200/50 bg-gradient-to-r from-white/95 via-champagne-50/30 to-white/95 px-4 py-3 shadow-premium backdrop-blur dark:border-champagne-500/20 dark:from-navy-900/90 dark:via-navy-800/50 dark:to-navy-900/90"
      >
        <button
          type="button"
          disabled={isTranscribing}
          onClick={isRecording ? stopRecording : startRecording}
          className={`group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 ${isRecording
              ? "bg-red-500 shadow-red-500/30 animate-pulse text-white"
              : "bg-champagne-100 text-champagne-600 hover:bg-champagne-200 dark:bg-navy-800 dark:text-champagne-300 dark:hover:bg-navy-700"
            }`}
          title={isRecording ? "Stop Recording" : "Use Voice Input"}
        >
          {isTranscribing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </button>

        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="flex-1 rounded-2xl border border-champagne-200/50 bg-white/80 px-5 py-4 text-sm text-navy-700 outline-none transition-all placeholder:text-navy-400/50 focus:border-champagne-400 focus:ring-2 focus:ring-champagne-400/20 dark:border-champagne-500/20 dark:bg-navy-900/80 dark:text-champagne-100 dark:placeholder:text-slate-500 dark:focus:border-champagne-400/50"
          placeholder={isRecording ? "Listening..." : isTranscribing ? "Transcribing audio..." : "Ask anything about your personal data..."}
          disabled={answering || isRecording || isTranscribing}
        />
        <button
          type="submit"
          disabled={answering || !input.trim()}
          className="group relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-champagne-500 to-blush-500 shadow-lg shadow-champagne-500/30 transition-all hover:shadow-champagne-500/50 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {answering ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <Send className="h-5 w-5 text-white transition-transform group-hover:translate-x-0.5" />
          )}
        </button>
      </form>
    </div>
  );
};

export { ChatAssistant };
