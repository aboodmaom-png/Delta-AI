import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CHAT_ENDPOINT = 'https://delta-ai-backend-aq3d.onrender.com';

let currentUser = null;
let currentConversationId = null;

document.addEventListener('DOMContentLoaded', () => {
  const chatCard = document.getElementById('chatCard');
  const chatWindow = document.getElementById('chatWindow');
  const chatInput = document.getElementById('chatInput');
  const suggestionsRow = document.getElementById('suggestionsRow');
  const clearChatBtn = document.getElementById('clearChatBtn');
  const conversationsList = document.getElementById('conversationsList');
  const newConversationBtn = document.getElementById('newConversationBtn');

  let conversationHistory = [];
  let challengeContext = null;

  try {
    const stored = sessionStorage.getItem('lastChallengeContext');
    if (stored) {
      challengeContext = JSON.parse(stored);
      sessionStorage.removeItem('lastChallengeContext');
    }
  } catch (error) {
    console.error('Failed to parse challenge context:', error);
  }

  function enterInitialMode() {
    chatCard?.classList.add('initial-state');
    chatCard?.classList.remove('has-messages');
    if (chatWindow) chatWindow.innerHTML = '';
    if (suggestionsRow) suggestionsRow.hidden = false;
    if (chatInput) {
      chatInput.disabled = false;
      chatInput.value = '';
      requestAnimationFrame(() => chatInput.focus());
    }
  }

  function enterChatMode() {
    chatCard?.classList.remove('initial-state');
    chatCard?.classList.add('has-messages');
    if (suggestionsRow) suggestionsRow.hidden = true;
  }

  function createMessage(role, text) {
    const row = document.createElement('div');
    row.className = `message-row ${role}`;

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;

    String(text ?? '').split('\n').forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line || ' ';
      bubble.appendChild(paragraph);
    });

    row.appendChild(bubble);
    return row;
  }

  function showMessages(messages) {
    if (!chatWindow) return;

    chatWindow.innerHTML = '';

    if (!messages.length) {
      enterInitialMode();
      return;
    }

    enterChatMode();
    messages.forEach((message) => {
      chatWindow.appendChild(createMessage(message.role, message.content));
    });

    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function appendMessage(role, text) {
    if (!chatWindow) return;
    enterChatMode();
    chatWindow.appendChild(createMessage(role, text));
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function addTypingIndicator() {
    if (!chatWindow) return null;

    const row = document.createElement('div');
    row.className = 'message-row ai';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble ai';

    const dots = document.createElement('div');
    dots.style.display = 'flex';
    dots.style.gap = '8px';

    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement('span');
      dot.className = 'typing-dot';
      dots.appendChild(dot);
    }

    bubble.appendChild(dots);
    row.appendChild(bubble);
    chatWindow.appendChild(row);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return row;
  }

  async function ensureConversation(firstMessageText) {
    if (currentConversationId || !currentUser) return currentConversationId;

    const title = challengeContext?.title
      ? `تحدي: ${challengeContext.title}`
      : firstMessageText.slice(0, 40);

    const convRef = await addDoc(collection(db, 'conversations'), {
      userId: currentUser.uid,
      title,
      challengeId: challengeContext?.challengeId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    currentConversationId = convRef.id;
    await loadConversationsList();
    return currentConversationId;
  }

  async function saveMessage(role, content) {
    if (!currentConversationId) return;

    try {
      await addDoc(
        collection(db, 'conversations', currentConversationId, 'messages'),
        { role, content, createdAt: serverTimestamp() }
      );

      await updateDoc(doc(db, 'conversations', currentConversationId), {
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }

  async function sendMessage() {
    if (!chatInput || chatInput.disabled) return;

    const userText = chatInput.value.trim();
    if (!userText) return;

    if (!chatCard?.classList.contains('has-messages')) {
      if (chatWindow) chatWindow.innerHTML = '';
      enterChatMode();
    }

    chatInput.value = '';
    chatInput.disabled = true;

    appendMessage('user', userText);
    conversationHistory.push({ role: 'user', content: userText });

    const typing = addTypingIndicator();

    try {
      await ensureConversation(userText);
      await saveMessage('user', userText);

      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          history: conversationHistory.slice(0, -1),
          context: challengeContext
        })
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with status ${response.status}`);
      }

      const data = await response.json();
      typing?.remove();

      const reply = data.reply || 'عذرًا، لم أتمكن من فهم السؤال، حاول مرة أخرى.';
      appendMessage('ai', reply);
      conversationHistory.push({ role: 'assistant', content: reply });
      await saveMessage('assistant', reply);
    } catch (error) {
      console.error('Chat failed:', error);
      typing?.remove();
      appendMessage('ai', 'عذرًا، حدث خطأ أثناء التواصل مع المساعد الذكي. حاول مرة أخرى.');
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  async function loadConversationsList() {
    if (!conversationsList || !currentUser) return;

    try {
      const convQuery = query(
        collection(db, 'conversations'),
        where('userId', '==', currentUser.uid)
      );

      const snapshot = await getDocs(convQuery);

      if (snapshot.empty) {
        conversationsList.innerHTML = '<li style="color:var(--muted);">لا توجد محادثات بعد</li>';
        return;
      }

      const conversations = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      conversations.sort(
        (a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)
      );

      conversationsList.innerHTML = '';

      conversations.forEach((conversation) => {
        const li = document.createElement('li');
        li.textContent = conversation.title || 'محادثة بدون عنوان';
        li.style.cursor = 'pointer';

       if (conversation.id === currentConversationId) {
  li.style.borderRight = '4px solid var(--primary)';
  li.style.background = 'var(--card-2)';
  li.style.fontWeight = '700';
}
        li.addEventListener('click', () => openConversation(conversation.id));
        conversationsList.appendChild(li);
      });
    } catch (error) {
      console.error('Failed to load conversations:', error);
      conversationsList.innerHTML = '<li style="color:var(--muted);">تعذّر تحميل المحادثات</li>';
    }
  }

  async function openConversation(conversationId) {
    currentConversationId = conversationId;
    conversationHistory = [];

    try {
      const messagesQuery = query(
        collection(db, 'conversations', conversationId, 'messages'),
        orderBy('createdAt', 'asc')
      );

      const snapshot = await getDocs(messagesQuery);

      const messages = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const uiRole = data.role === 'assistant' ? 'ai' : 'user';

        conversationHistory.push({
          role: data.role,
          content: data.content
        });

        return {
          role: uiRole,
          content: data.content
        };
      });

      showMessages(messages);
      await loadConversationsList();
    } catch (error) {
      console.error('Failed to open conversation:', error);
    }
  }

  function startNewConversation() {
    currentConversationId = null;
    conversationHistory = [];
    challengeContext = null;
    enterInitialMode();
    loadConversationsList();
  }

  newConversationBtn?.addEventListener('click', startNewConversation);
  clearChatBtn?.addEventListener('click', startNewConversation);

  suggestionsRow?.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !chatInput) return;
    chatInput.value = button.textContent.trim();
    chatInput.focus();
  });

  chatInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) loadConversationsList();
  });

  if (challengeContext) {
    showMessages([{
      role: 'ai',
      content: `مرحبًا 👋\nشفت إنك أنهيت تحدي "${challengeContext.title || ''}" وحصلت على ${
        typeof challengeContext.score === 'number' ? challengeContext.score : '—'
      }%.\n\nشو بدك تسأل عن هالتحدي أو النتيجة؟`
    }]);
  } else {
    enterInitialMode();
  }

  if (window.lucide) window.lucide.createIcons();
});
