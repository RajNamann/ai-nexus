# AI Nexus

AI Nexus is a multi-provider AI chatbot web application. It gives users one clean chat interface where they can choose an AI provider, select a model, adjust generation settings, and continue conversations with local chat history.

The project is intentionally lightweight. It uses a Node.js backend with no external npm dependencies and a vanilla HTML, CSS, and JavaScript frontend.

## Features

- Single chatbot interface for multiple AI providers
- Provider and model selection from the UI
- Custom model ID input for newer or unsupported model names
- Temperature control for response creativity
- Editable system prompt
- Chat history saved in the browser
- Reopen previous conversations from the sidebar
- Delete individual chats or clear all chat history
- Dark gradient UI theme
- Backend API key handling so keys are not exposed in frontend code
- Local Ollama support for users who want local model execution

## Supported Providers

AI Nexus currently includes adapters for:

- OpenAI
- Anthropic
- Google Gemini
- Mistral
- Groq
- OpenRouter
- Ollama

Cloud providers require API keys. Ollama can work locally if Ollama is installed and running on the user's machine.

## Project Structure

```text
.
+-- public
|   +-- app.js        # Frontend chat logic and local chat history
|   +-- index.html    # Main application markup
|   +-- styles.css    # Dark gradient UI styling
+-- .env.example      # Environment variable template
+-- package.json      # Project metadata and scripts
+-- README.md         # Project documentation
+-- server.js         # Node.js server and AI provider adapters
```

## Requirements

- Node.js 18 or newer
- API keys for any cloud AI providers you want to use
- Optional: Ollama installed locally for local model usage

## Setup

1. Clone or open the project folder.

2. Create a `.env` file from `.env.example`.

```bash
copy .env.example .env
```

On macOS or Linux:

```bash
cp .env.example .env
```

3. Add the API keys you want to use.

```env
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GEMINI_API_KEY=your_gemini_key
MISTRAL_API_KEY=your_mistral_key
GROQ_API_KEY=your_groq_key
OPENROUTER_API_KEY=your_openrouter_key
```

You do not need to add every key. Add only the providers you plan to use.

4. Start the app.

```bash
npm start
```

5. Open the app in your browser.

```text
http://localhost:3000
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `PORT` | Optional server port. Defaults to `3000`. |
| `OPENAI_API_KEY` | Enables OpenAI models. |
| `ANTHROPIC_API_KEY` | Enables Anthropic Claude models. |
| `GEMINI_API_KEY` | Enables Google Gemini models. |
| `MISTRAL_API_KEY` | Enables Mistral models. |
| `GROQ_API_KEY` | Enables Groq-hosted models. |
| `OPENROUTER_API_KEY` | Enables OpenRouter models. |
| `OLLAMA_BASE_URL` | Optional Ollama server URL. Defaults to `http://localhost:11434`. |

## How To Use

1. Choose a provider from the sidebar.
2. Choose a model from the model dropdown.
3. Optionally enter a custom model ID.
4. Adjust temperature if needed.
5. Edit the system prompt if you want to change the assistant's behavior.
6. Type a message and press Enter or click Send.

The app sends the conversation to the selected provider and displays the assistant response in the chat window.

## Temperature

Temperature controls how creative or predictable the model response is.

- Lower values such as `0.2` make responses more focused and consistent.
- Medium values such as `0.7` are good for general conversation.
- Higher values such as `1.0` or above make responses more creative but less predictable.

## Chat History

AI Nexus stores chat history in the browser using `localStorage`.

Current behavior:

- Conversations are saved automatically after messages are sent.
- Previous chats appear in the Chat history section.
- Clicking a history item restores the conversation.
- Restored chats include messages, provider, model, temperature, and system prompt.
- Up to 30 recent chats are stored.
- Users can delete one chat or clear all history.

Important note: chat history is local to the browser. It is not synced across devices and is not stored on the server.

## API Design

The frontend talks to two backend endpoints:

### `GET /api/providers`

Returns the available providers, model lists, and whether each provider is configured.

### `POST /api/chat`

Sends a chat request to the selected provider.

Example request body:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful AI assistant."
    },
    {
      "role": "user",
      "content": "Explain AI Nexus in simple words."
    }
  ]
}
```

Example response:

```json
{
  "reply": "AI Nexus is a single chat app that lets you use different AI models from one place."
}
```

## Adding A New Provider

New providers can be added inside the `providers` object in `server.js`.

Each provider needs:

- `name`: Display name shown to users
- `envKey`: API key environment variable name
- `models`: List of default model IDs
- `chat()`: Function that sends messages to the provider and returns text

Example shape:

```js
customProvider: {
  name: "Custom Provider",
  envKey: "CUSTOM_PROVIDER_API_KEY",
  models: ["custom-model-name"],
  async chat({ model, messages, temperature }) {
    // Send request to provider here.
    return "Assistant response text";
  }
}
```

If a provider supports the OpenAI chat completions format, reuse the existing `openAiCompatibleChat()` helper.

## Local AI With Ollama

AI Nexus includes an Ollama provider by default.

To use it:

1. Install Ollama.
2. Pull a model, for example:

```bash
ollama pull llama3.1
```

3. Make sure Ollama is running.
4. Select Ollama inside AI Nexus.

If your Ollama server runs on another URL, update:

```env
OLLAMA_BASE_URL=http://localhost:11434
```

## Security Notes

- API keys should be stored only in `.env`.
- Do not put API keys in `public/app.js`, `index.html`, or any frontend file.
- Do not commit `.env` to a public repository.
- The current project does not include user accounts, authentication, or server-side conversation storage.

## Testing

The project currently uses simple syntax and smoke checks.

Run JavaScript syntax checks:

```bash
node --check server.js
node --check public/app.js
```

Start the app:

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

You can also verify the providers endpoint:

```text
http://localhost:3000/api/providers
```

## Current Limitations

- No user login system
- No database
- Chat history is browser-only
- No streaming responses yet
- No file upload support yet
- No web search or retrieval mode yet
- Provider model lists may need updates as providers release new models

## Possible Future Improvements

- Streaming AI responses
- Web search mode
- User accounts
- Server-side chat history
- Export chat as Markdown or PDF
- Rename chats
- Search chat history
- File upload and document analysis
- Voice input
- Image generation support

## Credits

Developed by Naman Raj Srivastava.
