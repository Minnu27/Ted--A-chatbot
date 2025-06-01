

# Import necessary libraries
import streamlit as st
from dotenv import load_dotenv
import google.generativeai as genai
import os
import speech_recognition as sr # For speech-to-text
# import streamlit_audiorecorder as audiorecorder # For recording audio
import io # To handle audio bytes

# Set Streamlit page config
st.set_page_config(page_title="Ted - My Wing Man", page_icon="🫂", layout="wide")
st.title("Ted - My Wing Man 🎤") # Added mic emoji

# Load environment variables (Gemini API Key)
load_dotenv()
api_key = os.getenv("key")

# Configure the Gemini API
if not api_key:
    st.error("🚨 Gemini API Key not found. Please set it in your environment variables (.env file).")
    st.stop()

try:
    genai.configure(api_key=api_key)
    # Create model instance
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
except Exception as e:
    st.error(f"🚨 Failed to configure Gemini API: {e}")
    st.stop()


# -------------------- Persona Options (Keep as before) --------------------
personas = {
    "Bestie": (
    "You are the user's ride-or-die best friend—the kind who shows up uninvited with snacks, real talk, and unwavering support. "
    "You speak the user's emotional language without needing to ask—matching their vibe, mirroring their feelings, and always responding with the energy they need. "
    "If they're low, you soften. If they're hyped, you hype them more. If they're lost, you bring clarity. If they're angry, you stay grounded and calm. "
    "You never overstep, but you always show up. You talk like it’s 2AM and the masks are off—raw, warm, and real. "
    "You celebrate their wins like your own, sit with them in their mess without trying to fix it too fast, and push them forward when the time is right. "
    "Be funny, poetic, grounded, and wise. You are their mirror, their voice of reason, their chaos buddy, and their gentle shove when life gets stuck."
    ),

    "guardian": (
        "You are fiercely protective and deeply grounded. You speak with the calm strength of someone who’s weathered storms. "
        "You guide with honesty, loyalty, and steady presence—like a shield in human form."
    ),

    "cheerleader": (
        "You are a walking exclamation mark—loud, sparkly, and unstoppable. "
        "You hype the user like they’re the main character of the universe. Your words are pure sunshine and confetti."
    ),

    "sage": (
        "You speak in metaphors, wisdom, and quiet truths. Your tone is poetic, slow, and filled with perspective. "
        "You’re here to help the user zoom out and find meaning in the mess."
    ),

    "realist": (
        "You keep it 100% real, always. You’re practical, no-BS, and full of tough love. "
        "You don’t sugarcoat, but you care deeply. You’re the friend who hands the user a plan and says, 'Let’s move.'"
    ),

    "coder": (
    "You are the user's go-to tech-savvy best friend, speaking fluent Python, Java, and caffeine. "
    "You solve problems with clarity and break down complex technical issues into bite-sized, debug-friendly pieces. "
    "When the user brings you a challenge, you think like a developer—logical, structured, and precise. "
    "You write clean, efficient code in whatever language is needed, with helpful comments. "
    "You’re not just here to answer—you’re here to teach, build, and brainstorm. "
    "When needed, include well-formatted code snippets with syntax highlighting, and guide the user step-by-step like a senior engineer mentoring a junior. "
    "You’re calm under pressure, always ready to optimize a life algorithm, refactor messy logic, or explain recursion like it’s bedtime poetry."
    )

}
persona_keys = list(personas.keys())

# --------------------- Helper Functions  ----------------------------

# # def Sentiment_identifier(user_input_sentiment):
# #   return model.generate_content(f"give me the sentiment in range of positive, negative and neutral for this statement. just give me one word answer. for the statement '{user_input_sentiment}'")

# -------------------- Sentiment_identifier and update_ui_based_on_sentiment ...------------------

# # def update_ui_based_on_sentiment(sentiment):
# #     if sentiment == "positive":
# #         return "#e6ee9c"  # Light lime
# #     elif sentiment == "negative":
# #         return "#ef9a9a"  # Light red
# #     else:
# #         return "#f0f2f6"


# -------------------- Initialize Session State (Keep as before) --------------------
if "chat" not in st.session_state:
    try:
        st.session_state.chat = model.start_chat(history=[])
        default_persona_key = persona_keys[0]
        st.session_state.chat.send_message(personas[default_persona_key])
        st.session_state.last_selected_persona = default_persona_key
        print(f"Chat initialized with default persona: {default_persona_key}")
    except Exception as e:
        st.error(f"🚨 Failed to start chat session: {e}")
        st.stop()

if "messages" not in st.session_state:
    st.session_state.messages = []

if "last_selected_persona" not in st.session_state:
     st.session_state.last_selected_persona = persona_keys[0]

# -------------------- Display Chat History (Keep as before) --------------------
chat_container = st.container()
with chat_container:
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["parts"])

# --- Input Area at the bottom ---
st.write("---") # Separator line
col1, col2, col3 = st.columns([1, 3, 1.5]) # Add a column for the mic

# Column 1: Persona Selector
with col1:
    selected_persona = st.selectbox(
        "Tone:",
        options=persona_keys,
        key="persona_selector",
        index=persona_keys.index(st.session_state.last_selected_persona),
    )
    if selected_persona != st.session_state.last_selected_persona:
        try:
            st.session_state.chat.send_message(personas[selected_persona])
            st.session_state.last_selected_persona = selected_persona
            st.success(f"Tone changed to {selected_persona}!", icon="🗣️")
            # Consider if rerun is needed or if the next message will just use the new tone
        except Exception as e:
            st.error(f"🚨 Failed to update persona: {e}")

# Column 2: Text Input
with col2:
    user_input_text = st.chat_input("Type or use the mic...", key="chat_input")

# Column 3: Voice Input
with col3:
    st.write("🎤 Speak:") # Label for the recorder
    # Use the audiorecorder component
    # audio_bytes = audiorecorder("Click to record", "Recording...") # You can customize the button texts

# --- Process Voice Input ---
transcribed_text = None
if False:
    st.info("Transcribing audio...")
    # Save audio bytes to a virtual file
    audio_io = io.BytesIO(audio_bytes)
    recognizer = sr.Recognizer()

    try:
        # Use the virtual file as source
        with sr.AudioFile(audio_io) as source:
            audio_data = recognizer.record(source) # Read the entire audio file

        # Recognize speech using Google Web Speech API (requires internet)
        transcribed_text = recognizer.recognize_google(audio_data)
        st.info("Transcription complete.") # Feedback
        # Clear the audio bytes after processing to avoid re-processing on rerun
        # This might require storing a flag in session state if transcription takes long
        # or if you want the user to confirm before sending. For now, we process immediately.

    except sr.UnknownValueError:
        st.warning("Could not understand audio, please try again.")
    except sr.RequestError as e:
        st.error(f"Could not request results from Google Speech Recognition service; {e}")
    except Exception as e:
        st.error(f"An unexpected error occurred during transcription: {e}")

# --- Determine Final Input (Voice > Text) ---
final_input = transcribed_text if transcribed_text else user_input_text

# --- Handle message sending and receiving (Mostly as before) ---
if final_input:
    # 1. Append and Display User Message
    st.session_state.messages.append({"role": "user", "parts": final_input})
    with chat_container:
         with st.chat_message("user"):
              st.markdown(final_input)

    # 2. Get Model Response
    with st.spinner("⏳ Thinking..."):
        try:
            response = st.session_state.chat.send_message(final_input)
            bot_reply = response.text
        except Exception as e:
            bot_reply = f"🚨 Sorry, I encountered an error: {e}"

    # 3. Append and Display Model Response
    st.session_state.messages.append({"role": "model", "parts": bot_reply})
    # Rerun to display the new message immediately
    st.rerun() # <--- Add rerun here to update the display