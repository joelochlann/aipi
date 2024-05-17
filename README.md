# aipi

Query any API with natural language.

Provide a starting URL and a bounding parent, and it will crawl the docs, then send them to an LLM (current GPT-4) to construct an API query.

Runs the API query using auth info that you provide (this does not get sent to the LLM).

## usage
```
export OPENAI_API_KEY=your_key_here
deno run -A aipi.ts
```
## demo
https://github.com/joelochlann/aipi/assets/5122968/6591df22-3552-4e09-8382-559743735478

