import os
from urllib.parse import quote_plus

import google.generativeai as genai
import requests
import streamlit as st
from bs4 import BeautifulSoup
from dotenv import load_dotenv

# -------------------- UI --------------------
st.set_page_config(page_title="Ted - My Wing Man", page_icon="🫂", layout="wide")
st.title("Ted - My Wing Man 🎤")


# -------------------- Search Fallback --------------------
def search_google_web(query: str, limit: int = 5) -> str:
    """Get lightweight search results directly from Google HTML."""
    try:
        url = f"https://www.google.com/search?q={quote_plus(query)}&hl=en"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        results = []

        for block in soup.select("div.g"):
            title_node = block.select_one("h3")
            link_node = block.select_one("a[href]")

            if not title_node or not link_node:
                continue

            title = title_node.get_text(strip=True)
            link = link_node.get("href", "")

            if title and link.startswith("http"):
                results.append((title, link))

            if len(results) >= limit:
                break

        if not results:
            return "I couldn't extract results from Google right now. Please try again."

        lines = ["I couldn't use the Gemini API, so here are Google search results:"]
        for idx, (title, link) in enumerate(results, start=1):
            lines.append(f"{idx}. [{title}]({link})")

        return "\n".join(lines)
    except Exception as e:
        return f"Search fallback failed: {e}"


# -------------------- Load API Key --------------------
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# -------------------- Personas --------------------
personas = {
    "Bestie": "You are a supportive best friend. Match user emotions and respond warmly.",
    "coder": "You are a senior software engineer. Explain clearly with code examples.",
    "realist": "You give practical, no-nonsense advice.",
}

persona_keys = list(personas.keys())

# -------------------- Session State --------------------
if "messages" not in st.session_state:
    st.session_state.messages = []

if "chat_mode" not in st.session_state:
    st.session_state.chat_mode = "gemini" if api_key else "search"

if "last_selected_persona" not in st.session_state:
    st.session_state.last_selected_persona = persona_keys[0]

if st.session_state.chat_mode == "gemini" and "chat" not in st.session_state:
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        st.session_state.chat = model.start_chat(history=[])
        st.session_state.chat.send_message(personas[st.session_state.last_selected_persona])
    except Exception:
        st.session_state.chat_mode = "search"

if st.session_state.chat_mode == "search":
    st.info("Gemini API unavailable. Using direct Google search fallback.")

# -------------------- Display Messages --------------------
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["parts"])

# -------------------- Input Area --------------------
col1, col2 = st.columns([1, 4])

with col1:
    selected_persona = st.selectbox(
        "Tone:",
        persona_keys,
        index=persona_keys.index(st.session_state.last_selected_persona),
    )

    if selected_persona != st.session_state.last_selected_persona:
        st.session_state.last_selected_persona = selected_persona
        if st.session_state.chat_mode == "gemini":
            st.session_state.chat.send_message(personas[selected_persona])

with col2:
    user_input = st.chat_input("Type your message...")

# -------------------- Chat Logic --------------------
if user_input:
    st.session_state.messages.append({"role": "user", "parts": user_input})

    with st.chat_message("user"):
        st.markdown(user_input)

    with st.spinner("Thinking..."):
        if st.session_state.chat_mode == "gemini":
            try:
                response = st.session_state.chat.send_message(user_input)
                bot_reply = response.text
            except Exception:
                st.session_state.chat_mode = "search"
                bot_reply = search_google_web(user_input)
        else:
            bot_reply = search_google_web(user_input)

    st.session_state.messages.append({"role": "model", "parts": bot_reply})
    st.rerun()
