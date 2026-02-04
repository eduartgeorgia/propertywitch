const { PDFDocument, StandardFonts, rgb } = require('./server/node_modules/pdf-lib');
const fs = require('fs');

async function generateManual() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const lineHeight = 14;
  
  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  
  function addPage() {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  }
  
  function checkPageBreak(needed = 50) {
    if (y < margin + needed) {
      addPage();
    }
  }
  
  function drawTitle(text, size = 24) {
    checkPageBreak(size + 20);
    currentPage.drawText(text, { x: margin, y, size, font: helveticaBold, color: rgb(0.1, 0.3, 0.6) });
    y -= size + 10;
  }
  
  function drawHeading(text, size = 16) {
    checkPageBreak(size + 15);
    y -= 10;
    currentPage.drawText(text, { x: margin, y, size, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    y -= size + 8;
  }
  
  function drawSubheading(text, size = 12) {
    checkPageBreak(size + 10);
    currentPage.drawText(text, { x: margin + 10, y, size, font: helveticaBold, color: rgb(0.3, 0.3, 0.3) });
    y -= size + 6;
  }
  
  function drawText(text, indent = 0) {
    const maxWidth = pageWidth - 2 * margin - indent;
    const words = text.split(' ');
    let line = '';
    
    for (const word of words) {
      const testLine = line + (line ? ' ' : '') + word;
      const width = helvetica.widthOfTextAtSize(testLine, 11);
      
      if (width > maxWidth && line) {
        checkPageBreak();
        currentPage.drawText(line, { x: margin + indent, y, size: 11, font: helvetica });
        y -= lineHeight;
        line = word;
      } else {
        line = testLine;
      }
    }
    
    if (line) {
      checkPageBreak();
      currentPage.drawText(line, { x: margin + indent, y, size: 11, font: helvetica });
      y -= lineHeight;
    }
  }
  
  function drawBullet(text, level = 0) {
    const indent = 20 + level * 15;
    const bullet = level === 0 ? '•' : '-';
    checkPageBreak();
    currentPage.drawText(bullet, { x: margin + indent - 10, y, size: 11, font: helvetica });
    drawText(text, indent);
  }
  
  function drawCode(text) {
    checkPageBreak(20);
    currentPage.drawRectangle({ x: margin, y: y - 5, width: pageWidth - 2 * margin, height: 18, color: rgb(0.95, 0.95, 0.95) });
    currentPage.drawText(text, { x: margin + 5, y, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
    y -= 20;
  }
  
  function drawLine() {
    y -= 5;
    currentPage.drawLine({ start: { x: margin, y }, end: { x: pageWidth - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
    y -= 10;
  }

  // === TITLE PAGE ===
  y = pageHeight - 200;
  currentPage.drawText('Property Witch', { x: margin, y, size: 36, font: helveticaBold, color: rgb(0.1, 0.3, 0.6) });
  y -= 50;
  currentPage.drawText('AI Property Assistant', { x: margin, y, size: 24, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  y -= 40;
  currentPage.drawText('Developer Manual v2.0', { x: margin, y, size: 18, font: helvetica });
  y -= 30;
  currentPage.drawText('February 2026', { x: margin, y, size: 14, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
  y -= 60;
  
  drawLine();
  y -= 20;
  drawText('A comprehensive AI-powered property search assistant for Portugal with RAG knowledge base, multi-step agent reasoning, persistent chat threads, and intelligent property analysis.');
  
  // === TABLE OF CONTENTS ===
  addPage();
  drawTitle('Table of Contents');
  y -= 10;
  const toc = [
    '1. System Overview',
    '2. Architecture',
    '3. AI Services',
    '4. RAG Knowledge System',
    '5. Chat Threads & Memory',
    '6. Construction Land Intelligence',
    '7. Agent System',
    '8. OLX API Integration',
    '9. Frontend (React)',
    '10. Deployment',
    '11. API Reference',
    '12. Troubleshooting'
  ];
  toc.forEach(item => {
    drawText(item, 10);
    y -= 5;
  });

  // === SECTION 1: SYSTEM OVERVIEW ===
  addPage();
  drawTitle('1. System Overview');
  drawText('Property Witch is an AI-powered property search assistant specialized for the Portuguese real estate market. It combines natural language processing, retrieval-augmented generation (RAG), and multi-step agent reasoning to help users find and understand property listings.');
  y -= 10;
  
  drawHeading('Key Features');
  drawBullet('Natural language property search ("find apartments in Porto under 200k")');
  drawBullet('RAG-powered knowledge base with Portuguese real estate laws and regulations');
  drawBullet('Construction land intelligence - distinguishes buildable vs non-buildable land');
  drawBullet('Persistent chat threads with conversation memory');
  drawBullet('Multi-step agent reasoning for complex queries');
  drawBullet('Pick/select from previous results ("pick 2 closest to center")');
  drawBullet('Real-time property listings from OLX Portugal API');
  drawBullet('PDF report generation for selected properties');
  
  drawHeading('Tech Stack');
  drawBullet('Backend: Node.js + Express + TypeScript');
  drawBullet('AI: Groq API (llama-3.3-70b-versatile)');
  drawBullet('RAG: Custom TF-IDF embeddings + in-memory vector store');
  drawBullet('Frontend: React 18 + Vite + TypeScript');
  drawBullet('Hosting: Render.com (backend), Hostinger (frontend)');

  // === SECTION 2: ARCHITECTURE ===
  addPage();
  drawTitle('2. Architecture');
  
  drawHeading('Directory Structure');
  drawCode('/server                    # Backend');
  drawCode('  /src');
  drawCode('    /routes                # API endpoints');
  drawCode('      chat.ts              # Main chat endpoint');
  drawCode('      threads.ts           # Thread management');
  drawCode('    /services');
  drawCode('      aiService.ts         # AI integration');
  drawCode('      agentService.ts      # Multi-step agent');
  drawCode('      threadService.ts     # Chat thread storage');
  drawCode('      searchService.ts     # OLX search');
  drawCode('      /rag                 # RAG system');
  drawCode('        knowledgeBase.ts   # Knowledge documents');
  drawCode('        ragService.ts      # RAG operations');
  drawCode('        vectorStore.ts     # Embeddings');
  drawCode('/web                       # Frontend');
  drawCode('  /src');
  drawCode('    App.tsx                # Main React app');
  
  drawHeading('Data Flow');
  drawText('1. User sends message via chat interface');
  drawText('2. Backend detects intent (search/conversation/pick/refine)');
  drawText('3. For searches: parse query, search OLX, filter with AI, return results');
  drawText('4. For questions: retrieve RAG context, generate AI response');
  drawText('5. Store message in thread for conversation continuity');

  // === SECTION 3: AI SERVICES ===
  addPage();
  drawTitle('3. AI Services');
  
  drawHeading('Supported Backends');
  drawBullet('Groq Cloud (Primary): llama-3.3-70b-versatile - fast, reliable');
  drawBullet('Ollama (Local): llama3.3-thinking-claude - offline capable');
  drawBullet('Claude API (Optional): claude-sonnet-4 - highest quality');
  
  drawHeading('Intent Detection');
  drawText('The system automatically detects user intent from messages:');
  y -= 5;
  drawBullet('"search" - New property search query');
  drawBullet('"conversation" - General chat/questions');
  drawBullet('"follow_up" - Question about previous results');
  drawBullet('"refine_search" - Modify previous search (e.g., "cheaper")');
  drawBullet('"show_listings" - Display results again');
  drawBullet('"pick_from_results" - Select specific listings ("pick 2 best")');
  
  drawHeading('Query Parsing');
  drawText('Natural language queries are parsed to extract:');
  drawBullet('Property type (apartment, house, land)');
  drawBullet('Price range (under/over/around X)');
  drawBullet('Location (city, region)');
  drawBullet('Features (bedrooms, area, amenities)');

  // === SECTION 4: RAG KNOWLEDGE SYSTEM ===
  addPage();
  drawTitle('4. RAG Knowledge System');
  
  drawHeading('Overview');
  drawText('RAG (Retrieval-Augmented Generation) enhances AI responses with curated knowledge about Portuguese real estate. The system uses TF-IDF embeddings to find relevant context.');
  y -= 10;
  
  drawHeading('Knowledge Categories');
  drawBullet('Buying Process: NIF, contracts, notary, registration');
  drawBullet('Taxes: IMT, stamp duty, annual property taxes');
  drawBullet('Regions: Algarve, Lisbon, Porto, Alentejo, Silver Coast');
  drawBullet('Property Types: Apartments, houses, land, ruins');
  drawBullet('Construction Land: Urban vs rural, permits, PDM');
  drawBullet('Visas: D7 passive income, Golden Visa changes');
  drawBullet('Financing: Mortgages, bank accounts, requirements');
  
  drawHeading('Knowledge Document Structure');
  drawCode('{ id: "buying-process", title: "...", content: "...",');
  drawCode('  category: "buying-process", tags: ["buying", "nif"] }');
  
  drawHeading('RAG Context Building');
  drawText('For each user query, the system:');
  drawBullet('Generates TF-IDF embedding for the query');
  drawBullet('Searches vector store for similar knowledge documents');
  drawBullet('Retrieves top 3-5 most relevant documents');
  drawBullet('Includes context in AI prompt for accurate responses');

  // === SECTION 5: CHAT THREADS ===
  addPage();
  drawTitle('5. Chat Threads & Memory');
  
  drawHeading('Thread System');
  drawText('Chat threads provide persistent conversation memory across sessions. Each thread stores messages, search context, and results for continuity.');
  y -= 10;
  
  drawHeading('Thread Structure');
  drawCode('ChatThread {');
  drawCode('  id: string              // Unique identifier');
  drawCode('  title: string           // Auto-generated from first message');
  drawCode('  messages: Message[]     // Conversation history');
  drawCode('  lastSearchContext: str  // Summary of last search');
  drawCode('  lastSearchResults: []   // Actual listing data');
  drawCode('}');
  
  drawHeading('API Endpoints');
  drawBullet('POST /api/threads - Create new thread');
  drawBullet('GET /api/threads - List all threads');
  drawBullet('GET /api/threads/:id - Get thread with messages');
  drawBullet('DELETE /api/threads/:id - Delete thread');
  
  drawHeading('Memory Features');
  drawBullet('Conversation history (last 20 messages) sent to AI');
  drawBullet('Search results stored for "pick X" queries');
  drawBullet('Context maintained across page refreshes');
  drawBullet('Thread sidebar for easy switching');

  // === SECTION 6: CONSTRUCTION LAND ===
  addPage();
  drawTitle('6. Construction Land Intelligence');
  
  drawHeading('Portuguese Land Law');
  drawText('Not all land in Portugal can be built on. The AI understands:');
  y -= 5;
  
  drawSubheading('Terreno Urbano (Urban Land) - CAN BUILD');
  drawBullet('Classified for construction in PDM (municipal plan)');
  drawBullet('Keywords: "urbano", "lote", "construção", "viabilidade"');
  drawBullet('Price: typically €30-300/sqm');
  
  drawSubheading('Terreno Rústico (Rural Land) - CANNOT BUILD');
  drawBullet('Agricultural land, building not allowed');
  drawBullet('Keywords: "rústico", "agrícola", "rural"');
  drawBullet('Price: typically €1-15/sqm');
  
  drawHeading('AI Filtering');
  drawText('When user searches for "land for construction":');
  drawBullet('ACCEPTS: listings with "urbano", "lote de terreno"');
  drawBullet('REJECTS: listings with "rústico", "agrícola"');
  drawBullet('WARNS: ambiguous listings, suggests verification');
  
  drawHeading('Key Documents to Check');
  drawBullet('Caderneta Predial - Property registry (urbano vs rústico)');
  drawBullet('PDM - Municipal zoning plan');
  drawBullet('PIP - Pre-approval request (recommended before buying)');

  // === SECTION 7: AGENT SYSTEM ===
  addPage();
  drawTitle('7. Agent System');
  
  drawHeading('Multi-Step Reasoning');
  drawText('The agent handles complex queries that require multiple steps:');
  drawBullet('"Compare apartments in Porto vs Lisbon under 150k"');
  drawBullet('"Find the cheapest land with sea view near Algarve"');
  drawBullet('"What are the total costs for buying a 200k property?"');
  
  drawHeading('Agent Tools');
  drawBullet('search_listings - Search OLX for properties');
  drawBullet('get_knowledge - Retrieve RAG documents');
  drawBullet('calculate - Perform calculations (taxes, costs)');
  drawBullet('compare - Compare multiple properties/options');
  
  drawHeading('Agent Flow');
  drawText('1. Parse user query to understand goal');
  drawText('2. Plan sequence of tool calls');
  drawText('3. Execute tools, collecting results');
  drawText('4. Synthesize final answer from all data');
  drawText('5. Return comprehensive response');

  // === SECTION 8: OLX API ===
  addPage();
  drawTitle('8. OLX API Integration');
  
  drawHeading('API Endpoint');
  drawCode('https://www.olx.pt/api/v1/offers/?category_id=16');
  
  drawHeading('Search Parameters');
  drawBullet('category_id=16 - All real estate');
  drawBullet('filter_float_price:from/to - Price range');
  drawBullet('query - Search text');
  drawBullet('limit - Results per page (max 50)');
  
  drawHeading('Property Mapping');
  drawText('OLX responses are mapped to unified Listing format:');
  drawCode('Listing { id, title, priceEur, locationLabel,');
  drawCode('  beds, baths, areaSqm, photos, sourceUrl }');
  
  drawHeading('Filtering Strategy');
  drawText('1. Fetch broad results from OLX (category 16)');
  drawText('2. Apply price range filter from parsed query');
  drawText('3. Use AI to analyze relevance of each listing');
  drawText('4. Sort by relevance score');
  drawText('5. Return top matches with reasoning');

  // === SECTION 9: FRONTEND ===
  addPage();
  drawTitle('9. Frontend (React)');
  
  drawHeading('Key Components');
  drawBullet('App.tsx - Main application, state management');
  drawBullet('Chat panel - Message display, input, auto-scroll');
  drawBullet('Results grid - Property cards with images');
  drawBullet('Thread sidebar - Conversation history');
  drawBullet('Quick Look modal - Property details overlay');
  
  drawHeading('State Management');
  drawCode('messages[]      - Chat messages');
  drawCode('threads[]       - Available threads');
  drawCode('currentThreadId - Active thread');
  drawCode('searchResponse  - Current search results');
  drawCode('isLoading       - Request in progress');
  
  drawHeading('Auto-Scroll');
  drawText('Chat automatically scrolls to show new messages:');
  drawCode('const messagesEndRef = useRef<HTMLDivElement>(null);');
  drawCode('useEffect(() => {');
  drawCode('  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });');
  drawCode('}, [messages]);');
  
  drawHeading('Build & Deploy');
  drawCode('npm run build                              # Build');
  drawCode('sshpass scp dist/* user@host:public_html/  # Deploy');

  // === SECTION 10: DEPLOYMENT ===
  addPage();
  drawTitle('10. Deployment');
  
  drawHeading('Backend - Render.com');
  drawBullet('Auto-deploys from GitHub main branch');
  drawBullet('Build: npm run build (esbuild)');
  drawBullet('Start: node dist/server.js');
  drawBullet('Environment: GROQ_API_KEY, PORT');
  
  drawHeading('Frontend - Hostinger');
  drawBullet('SSH upload to public_html');
  drawBullet('Static file hosting');
  drawCode('sshpass -p "password" scp -P 65002 -r dist/*');
  drawCode('  user@147.93.73.224:~/domains/site/public_html/');
  
  drawHeading('Environment Variables');
  drawCode('GROQ_API_KEY    - Groq API key');
  drawCode('PORT            - Server port (default 3001)');
  drawCode('OLLAMA_URL      - Local Ollama URL (optional)');
  drawCode('ANTHROPIC_API_KEY - Claude API key (optional)');

  // === SECTION 11: API REFERENCE ===
  addPage();
  drawTitle('11. API Reference');
  
  drawHeading('POST /api/chat');
  drawText('Main chat endpoint for all interactions');
  drawCode('Request: { message, threadId?, userLocation, mode }');
  drawCode('Response: { type, message, searchResult?, threadId }');
  
  drawHeading('GET /api/threads');
  drawText('List all chat threads');
  drawCode('Response: { threads: ChatThread[] }');
  
  drawHeading('POST /api/threads');
  drawText('Create new thread');
  drawCode('Response: { id, title, messages }');
  
  drawHeading('GET /api/ai/health');
  drawText('Check AI backend status');
  drawCode('Response: { available, backend, model }');
  
  drawHeading('GET /api/rag/stats');
  drawText('Get RAG system statistics');
  drawCode('Response: { knowledge: 20, listings: 8447, ... }');

  // === SECTION 12: TROUBLESHOOTING ===
  addPage();
  drawTitle('12. Troubleshooting');
  
  drawHeading('AI Not Responding');
  drawBullet('Check GROQ_API_KEY environment variable');
  drawBullet('Verify API endpoint: GET /api/ai/health');
  drawBullet('Check Render logs for errors');
  
  drawHeading('No Search Results');
  drawBullet('OLX API may be rate limited - wait and retry');
  drawBullet('Check if category_id=16 is still valid');
  drawBullet('Verify location/price filters are reasonable');
  
  drawHeading('Thread Memory Lost');
  drawBullet('Threads stored in-memory (lost on restart)');
  drawBullet('For production: implement database storage');
  
  drawHeading('"Pick X" Not Working');
  drawBullet('Ensure threadId is sent with each request');
  drawBullet('Search results must be stored in thread first');
  drawBullet('Check console for "pick_from_results" intent');
  
  drawHeading('Construction Land Misidentified');
  drawBullet('AI uses keywords: urbano, rústico, construção');
  drawBullet('Price per sqm helps: urban > €30, rural < €15');
  drawBullet('Advise users to verify with Caderneta Predial');

  // Save PDF
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('/Users/tornikeminadze/Desktop/Getting-my-life-back/XX8/aipa/DEVELOPER_MANUAL.pdf', pdfBytes);
  console.log('Manual generated: DEVELOPER_MANUAL.pdf');
}

generateManual().catch(console.error);
