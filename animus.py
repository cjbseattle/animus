import os
import streamlit as st
from openai import OpenAI

st.set_page_config(page_title="💬 OpenAI MCQ Generator", layout="wide")

st.title("💬 OpenAI MCQ Generator")
st.write(
    "Use the tabs below to generate multiple-choice questions or chat with OpenAI's GPT-3.5 model. "
    "Provide your OpenAI API key once to enable both features."
)

openai_api_key = st.text_input(
    "OpenAI API Key",
    type="password",
    value=os.getenv("OPENAI_API_KEY", ""),
    help="Paste your OpenAI key or set the OPENAI_API_KEY environment variable.",
)

if not openai_api_key:
    st.info("Please add your OpenAI API key to continue.", icon="🗝️")
    st.stop()

client = OpenAI(api_key=openai_api_key)

if "messages" not in st.session_state:
    st.session_state.messages = []

if "mcq_output" not in st.session_state:
    st.session_state.mcq_output = ""

if "mcq_topic" not in st.session_state:
    st.session_state.mcq_topic = "General knowledge"

tab1, tab2 = st.tabs(["MCQ Generator", "Chat"])

with tab1:
    st.subheader("Generate Multiple-Choice Questions")
    st.write(
        "Enter a topic and choose how many questions you want. OpenAI will generate a set of MCQs "
        "with four answer choices and the correct answer clearly indicated."
    )

    topic = st.text_input("Topic or subject", value=st.session_state.mcq_topic)
    num_questions = st.slider("Number of questions", 1, 10, 3)
    difficulty = st.selectbox("Difficulty", ["Easy", "Medium", "Hard"], index=1)

    if st.button("Generate MCQs"):
        st.session_state.mcq_topic = topic
        prompt = (
            f"Generate {num_questions} multiple-choice questions about {topic}. "
            "For each question, provide four answer options labeled A, B, C, and D, "
            "then indicate the correct answer clearly. "
            f"Use a {difficulty.lower()} level of difficulty."
        )

        with st.spinner("Generating questions..."):
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful assistant that writes clear multiple-choice questions.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
            )
            st.session_state.mcq_output = response.choices[0].message["content"]

    if st.session_state.mcq_output:
        st.markdown("### Generated MCQs")
        st.markdown(st.session_state.mcq_output)

with tab2:
    st.subheader("Chat with GPT-3.5")
    st.write("Ask a question and get a response from OpenAI in a conversation-style chat.")

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("What would you like to ask?"):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        stream = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": m["role"], "content": m["content"]} for m in st.session_state.messages],
            stream=True,
        )

        with st.chat_message("assistant"):
            response = st.write_stream(stream)
        st.session_state.messages.append({"role": "assistant", "content": response})
