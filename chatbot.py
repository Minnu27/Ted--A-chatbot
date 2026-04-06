import streamlit as st
from dotenv import load_dotenv
import google.generativeai as genai
import os

# -------------------- UI --------------------
st.set_page_config(page_title="Ted - My Wing Man", page_icon="🫂", layout="wide")
st.title("Ted - My Wing Man 🎤")

# -------------------- Load API Key --------------------
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")  # ✅ FIXED

if not api_key:
    st.error("🚨 Gemini API Key not found. Add GEMINI_API_KEY in .env file")
    st.stop()

# -------------------- Configure Gemini --------------------
try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")  # ✅ stable model
except Exception as e:
    st.error(f"🚨 Gemini setup failed: {e}")
    st.stop()

# -------------------- Personas --------------------
personas = {
    "Bestie": "You are a supportive best friend. Match user emotions and respond warmly.",
    "coder": "You are a senior software engineer. Explain clearly with code examples.",
    "realist": "You give practical, no-nonsense advice.",
}

persona_keys = list(personas.keys())

# -------------------- Session State --------------------
if "chat" not in st.session_state:
    st.session_state.chat = model.start_chat(history=[])
    default_persona = persona_keys[0]
    st.session_state.chat.send_message(personas[default_persona])
    st.session_state.last_selected_persona = default_persona

if "messages" not in st.session_state:
    st.session_state.messages = []

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
        st.session_state.chat.send_message(personas[selected_persona])
        st.session_state.last_selected_persona = selected_persona

with col2:
    user_input = st.chat_input("Type your message...")

# -------------------- Chat Logic --------------------
if user_input:
    st.session_state.messages.append({"role": "user", "parts": user_input})

    with st.chat_message("user"):
        st.markdown(user_input)

    with st.spinner("Thinking..."):
        try:
            response = st.session_state.chat.send_message(user_input)
            bot_reply = response.text
        except Exception as e:
            bot_reply = f"🚨 Error: {e}"

    st.session_state.messages.append({"role": "model", "parts": bot_reply})
    st.rerun()
