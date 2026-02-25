# from agno.agent import Agent
# from agno.tools.duckduckgo import DuckDuckGoTools
# import json
# import re

# questions = [
#     { "question": "Top AI ML consulting companies" },
#     { "question": "Leading Generative AI solution providers" }
# ]

# agent = Agent(tools=[DuckDuckGoTools()], llm=None)

# url_pattern = re.compile(r'https?://[^\s\)\]]+')
# unique_links = set()

# for q in questions:
#     question = q["question"]
#     print(f"🔍 Query: {question}")

#     try:
#         response = agent.run(question)
#         text = str(response)
#         urls = url_pattern.findall(text)
#         unique_links.update(urls)
#     except Exception as e:
#         print(f"Error for query '{question}': {e}")

# print("\n✅ Unique Links:")
# print(json.dumps(list(unique_links), indent=2))




from agno.agent import Agent
from agno.tools.duckduckgo import DuckDuckGoTools
from agno.llms.ollama import Ollama

# Your Ollama LLM server URL and model name
OLLAMA_API_URL = "https://antivirus-go-lists-doug.trycloudflare.com"
MODEL_NAME = "deepseek-r1:8b"

# Initialize Ollama LLM client
ollama_llm = Ollama(url=OLLAMA_API_URL, model=MODEL_NAME)

# Initialize Agent with DuckDuckGo tools ONLY (no llm param)
agent = Agent(tools=[DuckDuckGoTools()])

import re
import json

url_pattern = re.compile(r'https?://[^\s\)\]]+')
unique_links = set()

questions = [
    "Top AI ML consulting companies",
    "Leading Generative AI solution providers"
]

for question in questions:
    print(f"🔍 Query: {question}")

    try:
        # Run the query using the Ollama LLM directly (not Agent)
        response = ollama_llm.run(question)
        print(f"📝 Ollama response:\n{response}\n")

        # Extract URLs from the LLM response text
        urls = url_pattern.findall(str(response))
        unique_links.update(urls)

        # Optionally, also run Agent with DuckDuckGo for search results
        agent_response = agent.run(question)
        print(f"📝 Agent (DuckDuckGo) response:\n{agent_response}\n")

        urls = url_pattern.findall(str(agent_response))
        unique_links.update(urls)

    except Exception as e:
        print(f"❌ Error for query '{question}': {e}")

print("\n✅ Unique Links:")
print(json.dumps(list(unique_links), indent=2))






# summary = {
#         "customer_name": customer_name,
#         "date": datetime.now().isoformat(),
#         "site_url": site_url,
#         "Email_id": None,
#         "sitemap_link": sitemap_data.get('sitemap_urls'),
#         "robots_txt": sitemap_data.get('robots_txt_content'),
#         "schema_org": None,
#         "llms_txt": "",
#         "keywords": [],
#         "metadata": None,
#         "landing_page": None,
#         "business_domain": None
#         "competitive": competitive_analysis,
#     }

#competitive