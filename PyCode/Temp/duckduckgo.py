# import sys
# from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
# from langchain_community.tools import DuckDuckGoSearchResults
# import json

# def run_search(query):
#     wrapper = DuckDuckGoSearchAPIWrapper(region="wt-wt", time="d", max_results=10)
#     search = DuckDuckGoSearchResults(api_wrapper = wrapper ,output_format="list")
#     try:
#         result = search.invoke(query)
#         # links = [item.get("link") for item in result if "link" in item]
#         # print(json.dumps(links))
#         print(result)
#     except Exception as e:
#         print(f"Error: {e}", file=sys.stderr)
#         sys.exit(1) # Exit with an error code

# if __name__ == "__main__":
#     if len(sys.argv) > 1:
#         search_query = sys.argv[1]
#         run_search(search_query)
#     else:
#         print("Error: No search query provided.", file=sys.stderr)
#         sys.exit(1)

import os
from langchain.llms import Ollama
from langchain.agents import Tool, initialize_agent, AgentType
from langchain.tools import DuckDuckGoSearchRun,DuckDuckGoSearchResults
from langchain_community.utilities import DuckDuckGoSearchAPIWrapper
from langchain.prompts import PromptTemplate
from langchain.memory import ConversationBufferMemory
from langchain.agents import AgentExecutor # Import from here for clarity

# Initialize the search tool
wrapper = DuckDuckGoSearchAPIWrapper(region="wt-wt", time="d", max_results=100)
search = DuckDuckGoSearchResults(api_wrapper = wrapper ,output_format="json")

tools = [
    Tool(
        name="Search",
        func=search.run,
        description="Use this to find competitor sites and extract their official domain link"
    )
]

llm = Ollama(
    model="llama3.2",
    temperature=0.7,
)

# Define the prompt template for the agent
template = """
Identify 6-9 real, established competitors of Welzin.ai in the technology industry and give their official urls.

[...Welzin.ai description...]

Based on this company's specific business model and target market, identify ONLY direct competitors that:
1. Offer the SAME type of products/services (not just retailers that sell them)
2. Target the SAME customer segment
3. Have a SIMILAR business model (e.g., if it's a DTC brand, find other DTC brands)
4. Actually compete for the same customers

For example:
- If it's a DTC underwear brand, find OTHER DTC underwear brands (not department stores)
- If it's a web scraping API, find OTHER web scraping APIs (not general data tools)
- If it's an AI model provider, find OTHER AI model providers (not AI applications)

IMPORTANT:
- Only include companies you are confident actually exist
- Focus on TRUE competitors with similar offerings
- Exclude retailers, marketplaces, or aggregators unless the company itself is one
- Aim for 6-9 competitors total
- Do NOT include general retailers or platforms that just sell/distribute products


"""


agent = initialize_agent(
    tools=tools,
    llm=llm,
    agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
    verbose=True,
    memory=ConversationBufferMemory(memory_key="chat_history", return_messages=True)
)

def ask_question(query):
    """
    Function to ask a question to the agent and get a response
    """
    try:
        response = agent.invoke({"input": query})
        return response.get("output", "Sorry, I couldn't generate a response.")
    except Exception as e:
        return f"An error occurred: {str(e)}"

query = "top 10 ai consultancy firms"
print(ask_question(query))