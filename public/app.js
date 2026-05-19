const providerSelect = document.querySelector("#providerSelect");
const modelSelect = document.querySelector("#modelSelect");
const customModelInput = document.querySelector("#customModelInput");
const temperatureInput = document.querySelector("#temperatureInput");
const temperatureValue = document.querySelector("#temperatureValue");
const systemPrompt = document.querySelector("#systemPrompt");
const activeModel = document.querySelector("#activeModel");
const readyBadge = document.querySelector("#readyBadge");
const providerChip = document.querySelector("#providerChip");
const messageCount = document.querySelector("#messageCount");
const providerStatus = document.querySelector("#providerStatus");
const messagesElement = document.querySelector("#messages");
const chatForm = document.querySelector("#chatForm");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const newChatButton = document.querySelector("#newChatButton");
const historyList = document.querySelector("#historyList");
const clearHistoryButton = document.querySelector("#clearHistoryButton");

const HISTORY_KEY = "ai-nexus-chat-history";

let providers = [];
let messages = [];
let isSending = false;
let activeConversationId = null;
let chatHistory = [];

init();

async function init() {
  chatHistory = loadHistory();
  renderEmptyState();
  renderHistory();
  await loadProviders();
  bindEvents();
  updateModelOptions();
}

async function loadProviders() {
  const response = await fetch("/api/providers");
  providers = await response.json();

  providerSelect.innerHTML = providers
    .map((provider) => {
      const suffix = provider.ready ? "" : " (needs key)";
      return `<option value="${provider.id}">${provider.name}${suffix}</option>`;
    })
    .join("");
}

function bindEvents() {
  providerSelect.addEventListener("change", updateModelOptions);
  modelSelect.addEventListener("change", updateActiveModel);
  customModelInput.addEventListener("input", updateActiveModel);
  temperatureInput.addEventListener("input", () => {
    temperatureValue.textContent = temperatureInput.value;
  });
  newChatButton.addEventListener("click", () => {
    startNewChat();
  });
  clearHistoryButton.addEventListener("click", clearHistory);
  historyList.addEventListener("click", handleHistoryClick);
  chatForm.addEventListener("submit", sendMessage);
  messageInput.addEventListener("input", resizeComposer);
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });
  messagesElement.addEventListener("click", (event) => {
    const promptButton = event.target.closest("[data-prompt]");
    if (!promptButton) return;
    messageInput.value = promptButton.dataset.prompt;
    resizeComposer();
    messageInput.focus();
  });
}

function updateModelOptions() {
  const provider = selectedProvider();
  modelSelect.innerHTML = provider.models.map((model) => `<option value="${model}">${model}</option>`).join("");
  updateActiveModel();
}

function updateActiveModel() {
  const provider = selectedProvider();
  activeModel.textContent = `${provider.name} / ${selectedModel()}`;
  providerChip.textContent = provider.name;
  readyBadge.textContent = provider.ready ? "Ready" : "Needs API key";
  readyBadge.classList.toggle("warning", !provider.ready);
  providerStatus.textContent = provider.ready
    ? `${provider.name} is configured.`
    : `Set ${provider.envKey} in .env to enable ${provider.name}.`;
}

async function sendMessage(event) {
  event.preventDefault();
  if (isSending) return;

  const content = messageInput.value.trim();
  if (!content) return;

  messages.push({ role: "user", content });
  messageInput.value = "";
  resizeComposer();
  renderMessages();
  saveCurrentConversation();
  setSending(true);

  try {
    const payload = {
      provider: providerSelect.value,
      model: selectedModel(),
      temperature: Number(temperatureInput.value),
      messages: [{ role: "system", content: systemPrompt.value }, ...messages]
    };

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The provider returned an error.");
    }

    messages.push({ role: "assistant", content: data.reply || "(No text response)" });
    renderMessages();
    saveCurrentConversation();
  } catch (error) {
    renderError(error.message);
    saveCurrentConversation();
  } finally {
    setSending(false);
  }
}

function renderMessages() {
  messagesElement.innerHTML = messages.map(messageTemplate).join("");
  updateMessageCount();
  scrollToBottom();
}

function renderEmptyState() {
  messagesElement.innerHTML = `
    <div class="empty-state">
      <div>
        <h3>Ask once. Route anywhere.</h3>
        <p>Select a provider, tune the model, and keep your conversation in one focused workspace.</p>
      </div>
      <div class="prompt-grid" aria-label="Suggested prompts">
        <button class="prompt-card" type="button" data-prompt="Compare the strengths and weaknesses of the selected AI model for product research.">
          <strong>Compare models</strong>
          <span>Get a quick read on model fit before you commit to a task.</span>
        </button>
        <button class="prompt-card" type="button" data-prompt="Draft a concise project plan for building a production-ready multi-provider AI chatbot.">
          <strong>Plan a build</strong>
          <span>Turn an idea into milestones, architecture, and next steps.</span>
        </button>
        <button class="prompt-card" type="button" data-prompt="Rewrite this message to sound clearer, warmer, and more professional: ">
          <strong>Improve writing</strong>
          <span>Paste rough text and turn it into something polished.</span>
        </button>
      </div>
    </div>
  `;
  updateMessageCount();
}

function renderError(message) {
  messagesElement.insertAdjacentHTML(
    "beforeend",
    messageTemplate({ role: "error", content: message || "Something went wrong." })
  );
  updateMessageCount();
  scrollToBottom();
}

function renderHistory() {
  if (!chatHistory.length) {
    historyList.innerHTML = `<p class="history-empty">No saved chats yet. Your conversations will appear here after you send a message.</p>`;
    return;
  }

  historyList.innerHTML = chatHistory
    .map((conversation) => {
      const activeClass = conversation.id === activeConversationId ? " active" : "";
      const date = new Date(conversation.updatedAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
      return `
        <article class="history-item${activeClass}">
          <button class="history-open" type="button" data-history-open="${conversation.id}">
            <span class="history-title">${escapeHtml(conversation.title)}</span>
            <span class="history-meta">${escapeHtml(conversation.providerName)} / ${conversation.messages.length} messages / ${date}</span>
          </button>
          <button class="history-delete" type="button" aria-label="Delete chat" data-history-delete="${conversation.id}">x</button>
        </article>
      `;
    })
    .join("");
}

function messageTemplate(message) {
  const roleLabel = message.role === "user" ? "You" : message.role === "assistant" ? "Assistant" : "Error";
  const avatarLabel = message.role === "user" ? "You" : message.role === "assistant" ? "AI" : "!";
  return `
    <article class="message ${message.role}">
      <div class="avatar" aria-hidden="true">${avatarLabel}</div>
      <div class="message-content">
        <div class="message-role">${roleLabel}</div>
        <div class="bubble">${escapeHtml(message.content)}</div>
      </div>
    </article>
  `;
}

function setSending(value) {
  isSending = value;
  sendButton.disabled = value;
  sendButton.querySelector("span").textContent = value ? "Sending" : "Send";
}

function resizeComposer() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
}

function selectedProvider() {
  return providers.find((provider) => provider.id === providerSelect.value) || providers[0];
}

function selectedModel() {
  return customModelInput.value.trim() || modelSelect.value;
}

function scrollToBottom() {
  messagesElement.scrollTop = messagesElement.scrollHeight;
}

function updateMessageCount() {
  const count = messages.length;
  messageCount.textContent = `${count} ${count === 1 ? "message" : "messages"}`;
}

function startNewChat() {
  activeConversationId = null;
  messages = [];
  renderEmptyState();
  renderHistory();
  messageInput.focus();
}

function handleHistoryClick(event) {
  const deleteButton = event.target.closest("[data-history-delete]");
  if (deleteButton) {
    deleteConversation(deleteButton.dataset.historyDelete);
    return;
  }

  const openButton = event.target.closest("[data-history-open]");
  if (openButton) {
    openConversation(openButton.dataset.historyOpen);
  }
}

function openConversation(id) {
  const conversation = chatHistory.find((item) => item.id === id);
  if (!conversation) return;

  activeConversationId = conversation.id;
  messages = conversation.messages || [];
  providerSelect.value = conversation.provider || providerSelect.value;
  updateModelOptions();

  if (conversation.model && selectedProvider().models.includes(conversation.model)) {
    modelSelect.value = conversation.model;
    customModelInput.value = "";
  } else {
    customModelInput.value = conversation.model || "";
  }

  temperatureInput.value = conversation.temperature ?? "0.7";
  temperatureValue.textContent = temperatureInput.value;
  systemPrompt.value = conversation.systemPrompt || "You are a helpful AI assistant.";
  updateActiveModel();
  renderMessages();
  renderHistory();
}

function deleteConversation(id) {
  chatHistory = chatHistory.filter((conversation) => conversation.id !== id);
  persistHistory();

  if (activeConversationId === id) {
    startNewChat();
    return;
  }

  renderHistory();
}

function clearHistory() {
  chatHistory = [];
  persistHistory();
  startNewChat();
}

function saveCurrentConversation() {
  if (!messages.length) return;

  const now = new Date().toISOString();
  const provider = selectedProvider();
  const conversation = {
    id: activeConversationId || createConversationId(),
    title: createConversationTitle(messages),
    provider: providerSelect.value,
    providerName: provider.name,
    model: selectedModel(),
    temperature: Number(temperatureInput.value),
    systemPrompt: systemPrompt.value,
    messages: messages.slice(),
    updatedAt: now
  };

  activeConversationId = conversation.id;
  chatHistory = [conversation, ...chatHistory.filter((item) => item.id !== conversation.id)].slice(0, 30);
  persistHistory();
  renderHistory();
}

function createConversationTitle(conversationMessages) {
  const firstUserMessage = conversationMessages.find((message) => message.role === "user")?.content || "New chat";
  return firstUserMessage.length > 44 ? `${firstUserMessage.slice(0, 44)}...` : firstUserMessage;
}

function createConversationId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
