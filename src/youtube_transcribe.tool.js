const { usageRender } = require('./utils.js');

module.exports = async function youtubeTranscribe({ videoId, usage = true }, ctx) {
  const key = process.env.OPENROUTER_KEY || await ctx.read("OPENROUTER_KEY"); 

  const url = `https://www.youtube.com/watch?v=${videoId}`
  let res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    "method": "POST",
    "headers": {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`
    },
    "body": JSON.stringify({
      "model": "~google/gemini-flash-latest",
      "messages": [
        {
          "role": "user",
          "content": [
            {
              "type": "text",
              "text": `transcribe the video in original language ${url}`
            },
            {
              "type": "video_url",
              "videoUrl": {
                "url": url
              }
            }
          ]
        }
      ],
      "tools": [ { "type": "openrouter:web_fetch" } ]
    })
  }) 

  if (!res.ok) {
    return res.text()
  }
  res = await res.json()
  let content = res?.choices?.[0]?.message?.content ?? "";
  if (usage ) {
    if (content) content+= "\n\n";
    content += usageRender('---\n↑%i:h/%c:h ↓%o:h[ %C:100.2¢]\n---', res.usage)
  }
  return content
}
