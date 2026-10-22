const { usageRender } = require('./utils.js');

module.exports = async function youtubeTranscribe({ text, searchEngine = "parallel", showUsage = true, showAnnotations = true }, ctx) {
  const key = process.env.OPENROUTER_KEY || await ctx.read("OPENROUTER_KEY"); 
  // const engines = ["google", "perplexity", "openai", "exa", "parallel"]

  // const searchEngine = engines[4] 
  let model = "~openai/gpt-luna-latest";
  let engine = "native";
  if (searchEngine === "exa" || searchEngine === "parallel" || searchEngine === "perplexity") {
    engine = searchEngine;
  } else if (model === "google") {
    model = "~google/gemini-flash-latest"
  }

  let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    "method": "POST",
    "headers": {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`
    },
    "body": JSON.stringify({
      model,
      engine,
      "messages": [
        {
          "role": "system",
          "content": "You are a web search assistant, you give search results" 
        },
        {
          "role": "user",
          "content": text 
        }
      ],
      "tools": [ { "type": "openrouter:web_fetch" }, { "type": "openrouter:web_search" } ]
    })
  }) 

  if (!res.ok) {
    return res.text()
  }
  res = await res.json()
  const message = res?.choices?.[0]?.message;

  const content = res?.choices?.[0]?.message?.content ?? "";
  let result = [content]

  const annotations = (message.annotations || []).map(annotation => {
    const item = annotation[annotation.type]
    if (annotation.type === "url_citation") {
      return `### ${item.title}\n${item.url}\n\n${item.content}`
    }
  }).filter(item => item).join("\n-----------------------\n")
  // return JSON.stringify(annotations, null, "  ")

  if (showAnnotations && annotations) {
    result.push(`##Annotations \n${annotations}`)
  }

  if (showUsage) {
    result.push(usageRender('---\n↑%i:h/%c:h ↓%o:h[ %C:100.2¢]\n---', res.usage))
  }
  return result.join("\n\n")
}
