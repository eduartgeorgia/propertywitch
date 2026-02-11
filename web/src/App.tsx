import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import type { ListingCard, SearchResponse, ChatThread } from "./types";

// API base URL - configurable for production deployment
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

/**
 * Fetch with retry logic and exponential backoff
 * Handles network errors that occur during server startup
 * Supports AbortSignal for cancellation
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  maxRetries = 5,
  initialDelayMs = 2000
): Promise<Response> => {
  // Prepend API base URL if not already absolute
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Check if already aborted before attempting
      if (options.signal?.aborted) {
        throw new DOMException('Request aborted', 'AbortError');
      }
      const response = await fetch(fullUrl, options);
      return response;
    } catch (error) {
      // If aborted, throw immediately without retry
      if ((error as Error).name === 'AbortError') {
        throw error;
      }
      
      lastError = error as Error;
      const errorMessage = (error as Error).message || 'Unknown error';
      
      // Check if it's a network error (server not ready yet)
      if (errorMessage.includes('net::ERR_FAILED') || 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('NetworkError')) {
        console.log(`[Attempt ${attempt + 1}/${maxRetries}] Server not ready yet:`, errorMessage);
      } else {
        console.log(`[Attempt ${attempt + 1}/${maxRetries}] Fetch failed:`, error);
      }
      
      // Don't retry on final attempt
      if (attempt < maxRetries - 1) {
        const delay = initialDelayMs * Math.pow(1.5, attempt); // Gentler backoff
        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // Provide a more helpful error message
  const errorMsg = lastError?.message || 'Network error';
  if (errorMsg.includes('net::ERR_FAILED') || errorMsg.includes('Failed to fetch')) {
    throw new Error('Server is still starting up. Please wait a moment and try again.');
  }
  throw lastError || new Error('Fetch failed after retries');
};

const defaultLocation = {
  label: "Lisbon, Portugal",
  lat: 38.7223,
  lng: -9.1393,
  currency: "EUR",
};

const LoadingDots = () => (
  <span className="loading-dots">
    <span className="dot">.</span>
    <span className="dot">.</span>
    <span className="dot">.</span>
  </span>
);

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  type?: "search" | "chat" | "clarification" | "agent";
  reasoning?: string;
  toolsUsed?: string[];
};

type ChatAPIResponse = {
  type: "search" | "chat" | "clarification" | "agent";
  intentDetected?: "search" | "conversation" | "follow_up" | "refine_search" | "agent";
  message: string;
  question?: string;
  parsedIntent?: Record<string, unknown>;
  searchResult?: SearchResponse;
  searchContext?: string;
  aiAvailable: boolean;
  reasoning?: string;
  toolsUsed?: string[];
  stepsCount?: number;
};

const formatDistance = (value?: number) => {
  if (value === undefined) return "";
  return `${value.toFixed(1)} km`;
};

const App = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "🏡 **Welcome to Property Witch** - Your AI-powered Portuguese real estate assistant!\n\nI search **live listings** from OLX Portugal and help you find your dream property. Just describe what you're looking for!\n\n**Try asking:**\n• \"Land under €30,000 near Lisbon\"\n• \"Apartments in Porto with sea view\"\n• \"Cheap houses in Algarve for renovation\"\n• \"Rural property with pool under €100k\"\n\n_I can also answer questions about Portuguese real estate, taxes, and the buying process._",
      type: "chat",
    },
  ]);
  const [query, setQuery] = useState("");
  const [locationLabel, setLocationLabel] = useState(defaultLocation.label);
  const [userLat, setUserLat] = useState(defaultLocation.lat);
  const [userLng, setUserLng] = useState(defaultLocation.lng);
  const [locationLoading, setLocationLoading] = useState(true);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [currency, setCurrency] = useState(defaultLocation.currency);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiBackend, setAiBackend] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [lastSearchContext, setLastSearchContext] = useState<string | null>(null);
  const [serverStarting, setServerStarting] = useState(true);
  const [showBackendSelector, setShowBackendSelector] = useState(false);
  const [availableBackends, setAvailableBackends] = useState<Array<{
    id: string;
    name: string;
    available: boolean;
    models?: string[];
    isCloud: boolean;
  }>>([]);
  const [switchingBackend, setSwitchingBackend] = useState(false);
  
  // Approved listings management
  const [approvedListings, setApprovedListings] = useState<ListingCard[]>([]);
  const [finalWinners, setFinalWinners] = useState<Record<string, boolean>>({});
  const [showApprovedPanel, setShowApprovedPanel] = useState(false);
  
  // Quick Look state
  const [quickLookListing, setQuickLookListing] = useState<ListingCard | null>(null);
  
  // Chat threads state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  
  // AbortController for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Ref for auto-scrolling messages
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  // Ref for auto-expanding textarea
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  // Voice communication state
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  
  // Auto-resize textarea based on content
  const autoResizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, []);
  
  // Initialize speech recognition and synthesis
  useEffect(() => {
    // Speech Recognition (Speech-to-Text)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; // Supports English, can add Portuguese
      
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0].transcript)
          .join('');
        setQuery(transcript);
        autoResizeTextarea();
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }
    
    // Speech Synthesis (Text-to-Speech)
    if (window.speechSynthesis) {
      synthRef.current = window.speechSynthesis;
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [autoResizeTextarea]);
  
  // Start/stop voice input
  const toggleVoiceInput = useCallback(() => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser. Try Chrome or Edge.');
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setQuery(''); // Clear existing text
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);
  
  // Speak text aloud
  const speakText = useCallback((text: string) => {
    if (!synthRef.current) {
      console.warn('Speech synthesis not available');
      return;
    }
    
    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    // Clean the text (remove emojis and markdown)
    const cleanText = text
      .replace(/[🧙‍♀️🏠🔍📊💰🛏️🚿📐📍✨⚡🎯💡⏹️🤖👁️📸🏊‍♂️🌊🌳🚗]/g, '')
      .replace(/\*\*/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .trim();
    
    if (!cleanText) return;
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Try to use a good English voice
    const voices = synthRef.current.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) 
      || voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    synthRef.current.speak(utterance);
  }, []);
  
  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);
  
  // Auto-speak new assistant messages when voice is enabled
  useEffect(() => {
    if (!voiceEnabled || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant' && lastMessage.text && !lastMessage.text.includes('⏹️')) {
      // Small delay to let the message render first
      const timer = setTimeout(() => {
        speakText(lastMessage.text);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [messages, voiceEnabled, speakText]);

  // Stop the current request
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "⏹️ Request stopped.",
          type: "chat",
        },
      ]);
    }
  }, []);

  // Check AI availability on mount with retry
  useEffect(() => {
    let retryCount = 0;
    const maxInitialRetries = 10;
    
    const checkHealth = async (isInitialCheck = false) => {
      try {
        const res = await fetchWithRetry("/api/ai/health", {}, isInitialCheck ? 8 : 3, 2000);
        const data = await res.json();
        setAiAvailable(data.available);
        setAiBackend(data.backend);
        setAiModel(data.model);
        setServerStarting(false);
        retryCount = 0; // Reset retry count on success
      } catch (error) {
        console.log("AI health check failed:", error);
        
        // During initial startup, retry more aggressively
        if (isInitialCheck && retryCount < maxInitialRetries) {
          retryCount++;
          console.log(`Server starting, retry ${retryCount}/${maxInitialRetries}...`);
          setTimeout(() => checkHealth(true), 3000);
          return;
        }
        
        setAiAvailable(false);
        setAiBackend(null);
        setAiModel(null);
        setServerStarting(false);
      }
    };
    // Start with initial check (more retries)
    checkHealth(true);
    
    // Poll every 30 seconds to detect backend changes
    const interval = setInterval(() => checkHealth(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch threads list
  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/threads", {}, 2, 1000);
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    }
  }, []);

  // Create a new thread
  const createNewThread = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await fetchWithRetry("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }, 2, 1000);
      const data = await res.json();
      
      setCurrentThreadId(data.id);
      setMessages([{
        role: "assistant",
        text: "🏡 **Welcome to Property Witch** - Your AI-powered Portuguese real estate assistant!\n\nI search **live listings** from OLX Portugal and help you find your dream property. Just describe what you're looking for!\n\n**Try asking:**\n• \"Land under €30,000 near Lisbon\"\n• \"Apartments in Porto with sea view\"\n• \"Cheap houses in Algarve for renovation\"\n• \"Rural property with pool under €100k\"\n\n_I can also answer questions about Portuguese real estate, taxes, and the buying process._",
        type: "chat",
      }]);
      setSearchResponse(null);
      setLastSearchContext(null);
      
      // Refresh threads list
      await fetchThreads();
    } catch (error) {
      console.error("Failed to create thread:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [fetchThreads]);

  // Load a specific thread
  const loadThread = useCallback(async (threadId: string) => {
    setLoadingThreads(true);
    try {
      const res = await fetchWithRetry(`/api/threads/${threadId}`, {}, 2, 1000);
      const data = await res.json();
      
      setCurrentThreadId(threadId);
      setMessages(data.messages.map((m: { role: "user" | "assistant"; content: string; type?: string }) => ({
        role: m.role,
        text: m.content,
        type: m.type || "chat",
      })));
      setLastSearchContext(data.lastSearchContext || null);
      setSearchResponse(null); // Clear current search results
    } catch (error) {
      console.error("Failed to load thread:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  // Delete a thread
  const deleteThread = useCallback(async (threadId: string) => {
    try {
      await fetchWithRetry(`/api/threads/${threadId}`, { method: "DELETE" }, 2, 1000);
      
      // If we deleted the current thread, create a new one
      if (threadId === currentThreadId) {
        await createNewThread();
      }
      
      // Refresh threads list
      await fetchThreads();
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  }, [currentThreadId, createNewThread, fetchThreads]);

  // Initialize threads on mount
  useEffect(() => {
    const initThreads = async () => {
      await fetchThreads();
      // Create a new thread if none exist
      const res = await fetchWithRetry("/api/threads", {}, 2, 1000);
      const data = await res.json();
      if (!data.threads || data.threads.length === 0) {
        await createNewThread();
      } else {
        // Load the most recent thread
        await loadThread(data.threads[0].id);
      }
    };
    initThreads();
  }, []);

  // Fetch available backends
  const fetchBackends = useCallback(async () => {
    try {
      const res = await fetchWithRetry("/api/ai/backends", {}, 3, 1000);
      const data = await res.json();
      setAvailableBackends(data.backends || []);
    } catch (error) {
      console.error("Failed to fetch backends:", error);
    }
  }, []);

  // Switch backend
  const switchBackend = useCallback(async (backendId: string, model?: string) => {
    setSwitchingBackend(true);
    try {
      const res = await fetch("/api/ai/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backend: backendId, model }),
      });
      const data = await res.json();
      
      if (data.success) {
        setAiBackend(data.current.backend);
        setAiModel(data.current.model);
        setShowBackendSelector(false);
        // Add a system message to chat
        setMessages(prev => [...prev, {
          role: "assistant",
          text: `🔄 Switched to ${data.current.backend}${data.current.model ? ` (${data.current.model})` : ""}`,
          type: "chat",
        }]);
      } else {
        alert(data.error || "Failed to switch backend");
      }
    } catch (error) {
      console.error("Failed to switch backend:", error);
      alert("Failed to switch backend");
    } finally {
      setSwitchingBackend(false);
    }
  }, []);

  // Auto-detect user location on mount
  useEffect(() => {
    const detectLocation = async () => {
      if (!navigator.geolocation) {
        setLocationLoading(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setUserLat(latitude);
          setUserLng(longitude);

          // Reverse geocode to get location name
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality;
            const country = data.address?.country;
            if (city && country) {
              setLocationLabel(`${city}, ${country}`);
            } else if (country) {
              setLocationLabel(country);
            }
          } catch (error) {
            console.log("Reverse geocoding failed, using coordinates");
          }
          setLocationLoading(false);
        },
        (error) => {
          console.log("Geolocation error:", error.message);
          setLocationLoading(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    };

    detectLocation();
  }, []);

  // Quick Look keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes Quick Look
      if (e.key === "Escape" && quickLookListing) {
        e.preventDefault();
        setQuickLookListing(null);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [quickLookListing]);

  const listings = searchResponse?.listings ?? [];
  const blockedSites = searchResponse?.blockedSites ?? [];

  const selectionCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    // Capture the message and clear input immediately
    const userMessage = query;
    setQuery("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    setIsLoading(true);
    setReportUrl(null);
    
    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);

    // Build conversation history from recent messages (last 10)
    const recentMessages = messages.slice(-10);
    const conversationHistory = recentMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.text,
    }));

    // Build the message with price context if provided
    let messageWithContext = userMessage;
    if (minPrice || maxPrice) {
      const priceContext = [];
      if (minPrice) priceContext.push(`minimum ${minPrice} ${currency}`);
      if (maxPrice) priceContext.push(`maximum ${maxPrice} ${currency}`);
      if (priceContext.length > 0 && !userMessage.toLowerCase().includes('price') && !userMessage.match(/\d+/)) {
        messageWithContext = `${userMessage} (budget: ${priceContext.join(' to ')})`;
      }
    }

    const payload = {
      message: messageWithContext,
      threadId: currentThreadId || undefined, // Include thread ID for persistent memory
      userLocation: {
        label: locationLabel,
        lat: userLat,
        lng: userLng,
        currency,
      },
      mode: "auto", // Let the AI determine search vs conversation
      conversationHistory,
      lastSearchContext: lastSearchContext || undefined,
    };

    try {
      // Use AI-powered chat endpoint with retry for network errors
      const response = await fetchWithRetry(
        "/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal, // Pass abort signal
        },
        3,
        1000
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }
      
      const data = (await response.json()) as ChatAPIResponse;

      // Update AI availability status
      setAiAvailable(data.aiAvailable);

      // Store search context if available
      if (data.searchContext) {
        setLastSearchContext(data.searchContext);
      }
      
      // Refresh threads list to update sidebar
      fetchThreads();

      if (data.type === "clarification") {
        // AI needs more info
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.message, type: "clarification" },
        ]);
      } else if (data.type === "agent" && data.searchResult) {
        // Agent multi-step response
        setSearchResponse(data.searchResult);
        setSelected({});
        const agentMessage = data.reasoning 
          ? `🤖 **Agent Analysis**\n\n${data.message}\n\n_Reasoning: ${data.reasoning}_`
          : data.message;
        setMessages((prev) => [
          ...prev,
          { 
            role: "assistant", 
            text: agentMessage, 
            type: "agent",
            reasoning: data.reasoning,
            toolsUsed: data.toolsUsed,
          },
        ]);
      } else if (data.type === "search" && data.searchResult) {
        // Got search results
        setSearchResponse(data.searchResult);
        setSelected({});
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.message, type: "search" },
        ]);
      } else {
        // Regular chat response
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: data.message, type: "chat" },
        ]);
      }
    } catch (error) {
      // Handle aborted requests silently (user stopped the request)
      if ((error as Error).name === 'AbortError') {
        // Already handled by handleStop
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isNetworkError = errorMessage.includes('ERR_FAILED') || 
                             errorMessage.includes('NetworkError') ||
                             errorMessage.includes('Failed to fetch');
      
      const userMessage = isNetworkError
        ? "🔌 Network error - the server might still be starting up. Please wait a moment and try again."
        : `Search failed: ${errorMessage}`;
      
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: userMessage },
      ]);
      
      // If it's a network error, also recheck AI availability
      if (isNetworkError) {
        setAiAvailable(null);
        setAiBackend(null);
        setAiModel(null);
        setTimeout(() => {
          fetchWithRetry("/api/ai/health", {}, 3, 1000)
            .then((res) => res.json())
            .then((data) => {
              setAiAvailable(data.available);
              setAiBackend(data.backend);
              setAiModel(data.model);
            })
            .catch(() => {
              setAiAvailable(false);
              setAiBackend(null);
              setAiModel(null);
            });
        }, 2000);
      }
    } finally {
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  };

  // Toggle approval - directly add/remove from approved list
  const handleToggle = (listing: ListingCard) => {
    const isCurrentlyApproved = approvedListings.some((l) => l.id === listing.id);
    
    if (isCurrentlyApproved) {
      // Remove from approved
      setApprovedListings((prev) => prev.filter((l) => l.id !== listing.id));
      setFinalWinners((prev) => {
        const next = { ...prev };
        delete next[listing.id];
        return next;
      });
    } else {
      // Add to approved
      setApprovedListings((prev) => [...prev, listing]);
    }
  };

  // Check if listing is approved
  const isApproved = (listingId: string) => approvedListings.some((l) => l.id === listingId);

  // Remove listing from approved list
  const handleRemoveFromApproved = (listingId: string) => {
    setApprovedListings((prev) => prev.filter((l) => l.id !== listingId));
    setFinalWinners((prev) => {
      const next = { ...prev };
      delete next[listingId];
      return next;
    });
  };

  // Toggle final winner selection
  const handleToggleFinalWinner = (listingId: string) => {
    setFinalWinners((prev) => ({
      ...prev,
      [listingId]: !prev[listingId],
    }));
  };

  // Count of final winners
  const finalWinnersCount = useMemo(
    () => Object.values(finalWinners).filter(Boolean).length,
    [finalWinners]
  );

  // Generate report from final winners
  const handleGenerateReport = async () => {
    const winnerIds = Object.entries(finalWinners)
      .filter(([, isWinner]) => isWinner)
      .map(([id]) => id);
    
    if (winnerIds.length === 0) return;

    // Get full listing data for winners including AI analysis
    const winnerListings = approvedListings
      .filter(l => winnerIds.includes(l.id))
      .map(l => ({
        id: l.id,
        title: l.title,
        priceEur: l.priceEur,
        displayPrice: l.displayPrice,
        locationLabel: l.locationLabel,
        beds: l.beds,
        baths: l.baths,
        areaSqm: l.areaSqm,
        image: l.image,
        sourceSite: l.sourceSite,
        sourceUrl: l.sourceUrl,
        aiReasoning: l.aiReasoning,
        matchScore: l.matchScore,
        listingType: l.listingType,
        propertyType: l.propertyType,
      }));

    setMessages(prev => [...prev, {
      role: "assistant",
      text: `📄 Downloading ${winnerListings.length} listing page${winnerListings.length > 1 ? 's' : ''} as PDF${winnerListings.length > 1 ? 's' : ''}... This may take a moment.`,
      type: "chat",
    }]);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listings: winnerListings,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.files && data.files.length > 0) {
        // Download each PDF file
        for (const file of data.files) {
          const link = document.createElement('a');
          link.href = file.url;
          link.download = file.filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          // Small delay between downloads
          await new Promise(r => setTimeout(r, 300));
        }
        
        setMessages(prev => [...prev, {
          role: "assistant",
          text: `✅ Downloaded ${data.files.length} PDF${data.files.length > 1 ? 's' : ''}! Check your downloads folder.`,
          type: "chat",
        }]);
      } else {
        throw new Error(data.error || "Failed to generate PDFs");
      }
    } catch (error) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: `❌ Failed to download PDFs: ${error}`,
        type: "chat",
      }]);
    }
  };

  // Legacy approve handler (keep for compatibility but redirect to new flow)
  const handleApprove = async () => {
    handleAddToApproved();
  };

  return (
    <div className={`app ${showSidebar ? 'with-sidebar' : ''}`}>
      {/* Chat Threads Sidebar */}
      <aside className={`threads-sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h3>💬 Chats</h3>
          <button 
            className="new-chat-btn"
            onClick={createNewThread}
            disabled={loadingThreads}
            title="Start a new chat"
          >
            + New Chat
          </button>
        </div>
        <div className="threads-list">
          {threads.map((thread) => (
            <div 
              key={thread.id}
              className={`thread-item ${thread.id === currentThreadId ? 'active' : ''}`}
              onClick={() => loadThread(thread.id)}
            >
              <div className="thread-info">
                <span className="thread-title">{thread.title}</span>
                <span className="thread-meta">
                  {thread.messageCount} messages · {new Date(thread.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <button
                className="delete-thread-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this chat?')) {
                    deleteThread(thread.id);
                  }
                }}
                title="Delete chat"
              >
                🗑️
              </button>
            </div>
          ))}
          {threads.length === 0 && (
            <p className="no-threads">No chat history yet</p>
          )}
        </div>
        <button 
          className="toggle-sidebar-btn inside"
          onClick={() => setShowSidebar(false)}
          title="Hide sidebar"
        >
          ◀
        </button>
      </aside>
      
      {/* Toggle button when sidebar is hidden */}
      {!showSidebar && (
        <button 
          className="toggle-sidebar-btn outside"
          onClick={() => setShowSidebar(true)}
          title="Show chat history"
        >
          💬
        </button>
      )}
      
      <main className="main-content">
      <header className="header">
        <div>
          <p className="eyebrow">Portugal Listings</p>
          <h1>AI Property Witch</h1>
        </div>
        <div className="header-card">
          <div className="ai-status-section">
            <p className="label">AI Status</p>
            <p className={`value ${aiAvailable ? "ai-online" : serverStarting ? "ai-starting" : "ai-offline"}`}>
              {serverStarting ? "🟡 Starting..." : aiAvailable === null ? "Checking..." : aiAvailable ? "🟢 Online" : "🔴 Offline"}
            </p>
            {serverStarting && (
              <p className="ai-model-info">
                <span className="server-starting-hint">Server is warming up, please wait...</span>
              </p>
            )}
            {aiAvailable && aiBackend && (
              <div className="ai-model-info">
                <button 
                  className="backend-selector-btn"
                  onClick={() => {
                    fetchBackends();
                    setShowBackendSelector(!showBackendSelector);
                  }}
                  title="Click to switch AI backend"
                >
                  <span className={`backend-badge ${aiBackend}`}>
                    {aiBackend === "ollama" ? "🖥️ Local" : "☁️ Cloud"}
                  </span>
                  <span className="model-name">{aiModel || aiBackend}</span>
                  <span className="switch-icon">⚙️</span>
                </button>
              </div>
            )}
            {showBackendSelector && (
              <div className="backend-selector-dropdown">
                <div className="backend-selector-header">
                  <span>Switch AI Backend</span>
                  <button className="close-btn" onClick={() => setShowBackendSelector(false)}>×</button>
                </div>
                {availableBackends.length === 0 ? (
                  <div className="backend-loading">Loading backends...</div>
                ) : (
                  <div className="backend-list">
                    {availableBackends.map((backend) => (
                      <div key={backend.id} className={`backend-item ${!backend.available ? 'unavailable' : ''} ${backend.id === aiBackend ? 'current' : ''}`}>
                        <div className="backend-header">
                          <span className="backend-name">
                            {backend.isCloud ? "☁️" : "🖥️"} {backend.name}
                          </span>
                          {backend.id === aiBackend && <span className="current-badge">Current</span>}
                          {!backend.available && <span className="unavailable-badge">Unavailable</span>}
                        </div>
                        {backend.available && backend.models && backend.models.length > 0 && (
                          <div className="backend-models">
                            {backend.models.map((model) => (
                              <button
                                key={model}
                                className={`model-btn ${model === aiModel ? 'current' : ''}`}
                                onClick={() => switchBackend(backend.id, model)}
                                disabled={switchingBackend || (backend.id === aiBackend && model === aiModel)}
                              >
                                {model}
                                {model === aiModel && backend.id === aiBackend && " ✓"}
                              </button>
                            ))}
                          </div>
                        )}
                        {backend.available && (!backend.models || backend.models.length === 0) && (
                          <button
                            className="model-btn"
                            onClick={() => switchBackend(backend.id)}
                            disabled={switchingBackend || backend.id === aiBackend}
                          >
                            Use {backend.name}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {switchingBackend && <div className="switching-indicator">Switching...</div>}
              </div>
            )}
          </div>
          <div>
            <p className="label">Search Radius</p>
            <p className="value">50 km fallback</p>
          </div>
          <div>
            <p className="label">Price Range</p>
            <p className="value">Exact → near-miss</p>
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel chat">
          <div className="panel-header">
            <h2>Chat Search</h2>
            <p>Ask for listings in plain language.</p>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.role}`}>
                <span className="message-text">{message.text}</span>
                {message.role === 'assistant' && message.text && !message.text.includes('⏹️') && (
                  <button 
                    className="speak-btn" 
                    onClick={() => speakText(message.text)}
                    title="Read aloud"
                  >
                    🔊
                  </button>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="message assistant typing">
                <LoadingDots />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="location">
            <label>
              Location {locationLoading && <span className="location-detecting">(detecting...)</span>}
              <input
                value={locationLabel}
                onChange={(event) => setLocationLabel(event.target.value)}
                placeholder="Your location"
              />
            </label>
          </div>

          <div className="input-row">
            <button 
              onClick={toggleVoiceInput} 
              className={`voice-btn ${isListening ? 'listening' : ''}`}
              title={isListening ? 'Stop listening' : 'Voice input'}
              type="button"
            >
              {isListening ? '🔴' : '🎤'}
            </button>
            <button 
              onClick={() => {
                setQuery('show previous results');
                setTimeout(() => handleSearch(), 100);
              }} 
              className="previous-btn"
              title="Show previous search results"
              type="button"
              disabled={isLoading}
            >
              ↩️
            </button>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                autoResizeTextarea();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !isLoading) {
                  event.preventDefault();
                  handleSearch();
                }
                if (event.key === "Escape" && isLoading) {
                  handleStop();
                }
              }}
              placeholder={isListening ? "Listening... speak now" : "e.g., Find me land under €30,000..."}
              rows={1}
            />
            {isLoading ? (
              <button onClick={handleStop} className="stop-btn" title="Stop (Esc)">
                ⏹️ Stop
              </button>
            ) : (
              <button onClick={handleSearch} disabled={isLoading}>
                Send
              </button>
            )}
          </div>
          
          <div className="voice-controls">
            <label className="voice-toggle">
              <input 
                type="checkbox" 
                checked={voiceEnabled} 
                onChange={(e) => setVoiceEnabled(e.target.checked)} 
              />
              🔊 Read responses aloud
            </label>
            {isSpeaking && (
              <button onClick={stopSpeaking} className="stop-speaking-btn" title="Stop speaking">
                ⏹️ Stop
              </button>
            )}
          </div>
        </section>

        <section className="panel results">
          <div className="panel-header">
            <h2>Quick Look</h2>
            <p>Approve listings to generate your report.</p>
          </div>

          {blockedSites.length > 0 && (
            <div className="alert">
              <strong>BYOC needed:</strong>
              {blockedSites.map((site) => (
                <span key={site.siteId}>
                  {site.siteName} ({site.requiredMethod})
                </span>
              ))}
            </div>
          )}

          <div className="cards">
            {listings.length === 0 && (
              <div className="empty">No listings yet. Run a search to get started.</div>
            )}
            {listings.map((listing) => (
              <article key={listing.id} className={`card ${selected[listing.id] ? "selected" : ""}`}>
                <div className="card-media">
                  {listing.image ? (
                    <img src={listing.image} alt={listing.title} />
                  ) : (
                    <div className="placeholder" />
                  )}
                  {listing.listingType && (
                    <span className={`listing-type-badge ${listing.listingType}`}>
                      {listing.listingType === 'sale' ? '🏷️ For Sale' : '🔑 For Rent'}
                    </span>
                  )}
                </div>
                <div className="card-body">
                  <div className="card-title">
                    <h3>{listing.title}</h3>
                    <span>{listing.displayPrice}</span>
                  </div>
                  <p className="meta">
                    {listing.propertyType && <span className="property-type-tag">{listing.propertyType}</span>}
                    {listing.locationLabel} {formatDistance(listing.distanceKm)}
                  </p>
                  <p className="meta">
                    {listing.areaSqm ? `${listing.areaSqm} sqm` : ""}
                    {listing.beds ? ` · ${listing.beds} beds` : ""}
                  </p>
                  {listing.aiReasoning && (
                    <p className="ai-reasoning">
                      <span className="ai-badge">AI</span> {listing.aiReasoning}
                    </p>
                  )}
                  {listing.matchScore !== undefined && listing.matchScore > 0 && (
                    <div className="relevance-score">
                      <div 
                        className="relevance-bar" 
                        style={{ width: `${listing.matchScore}%` }}
                      />
                    </div>
                  )}
                  <div className="card-actions">
                    <button 
                      className="quick-look-btn"
                      onClick={() => setQuickLookListing(listing)}
                      title="Quick Look (Space)"
                    >
                      👁️
                    </button>
                    <a href={listing.sourceUrl} target="_blank" rel="noreferrer">
                      View source
                    </a>
                    <button 
                      className={isApproved(listing.id) ? "approved" : ""}
                      onClick={() => handleToggle(listing)}
                    >
                      {isApproved(listing.id) ? "✓ Approved" : "Approve"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="footer-bar">
            <div>
              <p className="label">Approved</p>
              <p className="value">{approvedListings.length} listings</p>
            </div>
            {approvedListings.length > 0 && (
              <button 
                className="approved-panel-toggle"
                onClick={() => setShowApprovedPanel(!showApprovedPanel)}
              >
                📋 View Approved ({approvedListings.length})
              </button>
            )}
          </div>
        </section>

        {/* Approved Listings Panel */}
        {showApprovedPanel && approvedListings.length > 0 && (
          <section className="panel approved-panel">
            <div className="panel-header">
              <h2>Approved Listings</h2>
              <p>Select final winners and generate report.</p>
              <button 
                className="close-panel-btn"
                onClick={() => setShowApprovedPanel(false)}
              >
                ×
              </button>
            </div>

            <div className="approved-cards">
              {approvedListings.map((listing) => (
                <article 
                  key={listing.id} 
                  className={`card approved-card ${finalWinners[listing.id] ? "winner" : ""}`}
                >
                  <div className="card-media">
                    {listing.image ? (
                      <img src={listing.image} alt={listing.title} />
                    ) : (
                      <div className="placeholder" />
                    )}
                    {finalWinners[listing.id] && (
                      <div className="winner-badge">🏆 Winner</div>
                    )}
                  </div>
                  <div className="card-body">
                    <div className="card-title">
                      <h3>{listing.title}</h3>
                      <span>{listing.displayPrice}</span>
                    </div>
                    <p className="meta">
                      {listing.locationLabel} {formatDistance(listing.distanceKm)}
                    </p>
                    <p className="meta">
                      {listing.areaSqm ? `${listing.areaSqm} sqm` : ""}
                      {listing.beds ? ` · ${listing.beds} beds` : ""}
                    </p>
                    <div className="card-actions">
                      <a href={listing.sourceUrl} target="_blank" rel="noreferrer">
                        View source
                      </a>
                      <button 
                        className={`winner-btn ${finalWinners[listing.id] ? "selected" : ""}`}
                        onClick={() => handleToggleFinalWinner(listing.id)}
                      >
                        {finalWinners[listing.id] ? "🏆 Winner" : "Select Winner"}
                      </button>
                      <button 
                        className="remove-btn"
                        onClick={() => handleRemoveFromApproved(listing.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="footer-bar">
              <div>
                <p className="label">Final Winners</p>
                <p className="value">{Object.values(finalWinners).filter(Boolean).length} selected</p>
              </div>
              <button 
                onClick={handleGenerateReport} 
                disabled={approvedListings.length === 0}
              >
                Generate PDF Report
              </button>
            </div>

            {reportUrl && (
              <div className="report-link">
                <a href={reportUrl} target="_blank" rel="noreferrer">
                  📄 Open report PDF
                </a>
              </div>
            )}
          </section>
        )}
      </main>

      {/* Quick Look Modal */}
      {quickLookListing && (
        <div 
          className="quick-look-overlay" 
          onClick={() => setQuickLookListing(null)}
        >
          <div 
            className="quick-look-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              className="quick-look-close"
              onClick={() => setQuickLookListing(null)}
            >
              ×
            </button>
            
            <div className="quick-look-content">
              <div className="quick-look-image">
                {quickLookListing.image ? (
                  <img src={quickLookListing.image} alt={quickLookListing.title} />
                ) : (
                  <div className="quick-look-placeholder">No image available</div>
                )}
                {quickLookListing.listingType && (
                  <span className={`listing-type-badge large ${quickLookListing.listingType}`}>
                    {quickLookListing.listingType === 'sale' ? '🏷️ For Sale' : '🔑 For Rent'}
                  </span>
                )}
              </div>
              
              <div className="quick-look-details">
                <div className="quick-look-header">
                  <h2>{quickLookListing.title}</h2>
                  <span className="quick-look-price">{quickLookListing.displayPrice}</span>
                </div>
                
                <div className="quick-look-meta">
                  {quickLookListing.propertyType && (
                    <span className="property-type-tag large">{quickLookListing.propertyType}</span>
                  )}
                  <span className="quick-look-location">
                    📍 {quickLookListing.locationLabel}
                    {quickLookListing.distanceKm !== undefined && ` (${formatDistance(quickLookListing.distanceKm)})`}
                  </span>
                </div>
                
                <div className="quick-look-specs">
                  {quickLookListing.areaSqm && (
                    <div className="spec">
                      <span className="spec-icon">📐</span>
                      <span className="spec-value">{quickLookListing.areaSqm} m²</span>
                    </div>
                  )}
                  {quickLookListing.beds && (
                    <div className="spec">
                      <span className="spec-icon">🛏️</span>
                      <span className="spec-value">{quickLookListing.beds} bedrooms</span>
                    </div>
                  )}
                  {quickLookListing.baths && (
                    <div className="spec">
                      <span className="spec-icon">🚿</span>
                      <span className="spec-value">{quickLookListing.baths} bathrooms</span>
                    </div>
                  )}
                </div>
                
                {quickLookListing.aiReasoning && (
                  <div className="quick-look-ai">
                    <span className="ai-badge">AI Analysis</span>
                    <p>{quickLookListing.aiReasoning}</p>
                  </div>
                )}
                
                {quickLookListing.matchScore !== undefined && quickLookListing.matchScore > 0 && (
                  <div className="quick-look-score">
                    <span className="score-label">Match Score</span>
                    <div className="score-bar-container">
                      <div 
                        className="score-bar" 
                        style={{ width: `${quickLookListing.matchScore}%` }}
                      />
                      <span className="score-value">{quickLookListing.matchScore}%</span>
                    </div>
                  </div>
                )}
                
                <div className="quick-look-actions">
                  <a 
                    href={quickLookListing.sourceUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="quick-look-view-btn"
                  >
                    View on {quickLookListing.sourceSite} →
                  </a>
                  <button 
                    className={`quick-look-approve-btn ${isApproved(quickLookListing.id) ? "approved" : ""}`}
                    onClick={() => handleToggle(quickLookListing)}
                  >
                    {isApproved(quickLookListing.id) ? "✓ Approved" : "Approve"}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="quick-look-hint">
              Press <kbd>Esc</kbd> to close
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default App;
