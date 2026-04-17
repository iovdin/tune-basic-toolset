# Tune basic toolset
Basic toolset for [Tune](https://github.com/iovdin/tune).

##### Index
- [Setup](#setup)
  - [Text Editor](#text-editor)
  - [JavaScript Project](#javascript-project)
- [Tools](#tools)
  - [rf](#rf) read file
  - [wf](#wf) write file
  - [patch](#patch) patch file  
  - [append](#append) append to file
  - [sh](#sh) execute shell command locally and remotely
  - [cmd](#cmd) execute Windows cmd command
  - [powershell](#powershell) execute PowerShell command
  - [grep](#grep) search for patterns in text or files
  - [search_tools](#search_tools) find appropriate tools for a task
  - [osa](#osa) manage reminders/notes/calendar (AppleScript/macOS)
  - [jina_r](#jina_r) fetch webpage content
  - [mistral_ocr](#mistral_ocr) extract text from documents and images via OCR
  - [websearch](#websearch) search the web with web-enabled llms
  - [list](#list) keep list of tasks todo (loops for LLM)
  - [sqlite](#sqlite) execute sqlite queries 
  - [py](#py) run python code
  - [js_node](#js_node) run javascript code in node process
  - [js_ctx](#js_ctx) run javascript code that shares context with LLM
  - [turn](#turn) handoff based agent (shared context)
  - [branch](#branch) branch current chat and run sub-agent
  - [message](#message) talk to another chat/agent (separate context)
- [Processors](#processors)
  - [proc](#proc) converts tool to processor
  - [init](#init) set initial value
  - [json_format](#json_format) make LLM respond with JSON
  - [log](#log) save LLM payload
  - [mock](#mock) set variables inline
  - [linenum](#linenum) prepend line numbers
  - [text](#text) convert any variable to text variable
  - [resolve](#resolve) resolve a variable
  - [prop](#prop) set additional properties of LLM
  - [head](#head) take first N lines of a file
  - [tail](#tail) take last N lines of a file or LLM payload
  - [slice](#slice) take lines from <start> to <finish> of a file
  - [random](#random) random selection, sampling, shuffling, uniform ranges
  - [curry](#curry) change a tool by setting a parameter
  - [limit](#limit) limit output size by approximate token count
  - [expand](#expand) extract `content`, `tools`, and/or `llm` nodes from a prompt or chat file
  - [schema](#schema) convert a tool node into its JSON schema as text
  - [filter](#filter) keep or drop a node based on a boolean expression over its properties


## Setup
### Text Editor

Install in your `~/.tune` folder:

```bash
cd ~/.tune
npm install tune-basic-toolset
```

Add to `~/.tune/default.ctx.js`:

```javascript
const basics = require('tune-basic-toolset')

module.exports = [
    ...
    basics()
    ...
]
```

### JavaScript Project

```bash
npm install tune-basic-toolset tune-sdk
```

```javascript
const tune = require('tune-sdk')
const basics = require('tune-basic-toolset')

const ctx = tune.makeContext(
    basics({ expose: ["rf", "wf"], mount: "tools" })
)
```

## Tools
[Tools](https://iovdin.github.io/tune/template-language/tools) is a function that llm can run on your local machine or server

### `rf`
Read file
```chat
user: @rf
can you read README.md?
tool_call: rf {"filename":"README.md"}
tool_result: 
@README.md
```
It accepts an optional `linenum` parameter that prepends line numbers to the file (useful for patching).

### `wf`
Write to a file
```chat
user: @wf 
make a hello world javascript
tool_call: wf {"filename":"helloWorld.js"}
console.log('Hello, World!');
tool_result:
written
```

### `patch`
```chat
user: @patch
translate "hello world" in helloWorld.js  to dutch
tool_call: patch {"filename":"helloWorld.js"}
<<<<<<< ORIGINAL
console.log('Hello, World!');
=======
console.log('Hallo, Wereld!');
>>>>>>> UPDATED
tool_result:
patched
```


### `append`
```chat
user: @append
Add a todo that i want to buy a car and go to the moon
tool_call: append {"filename":"todo.md"}
- buy a car 
- fly to the moon
tool_result:
appended
```

### `sh`
Execute shell command locally or with ssh
```chat
user: @sh
find with ripgrep where echo is used
tool_call: sh
rg 'echo' ./
tool_result: 
./README.md:    echo: "You are echo, you print everything back",
./README.md:  const text = "s: \@echo\nu: hello world";
./tools/echo.txt:you are echo, you print everything back
./tools/README.md:* `echo.txt` - to debug variable expansions and context

user:
check contents directory on root\@host.com
assistant:
tool_call: sh {"host": "root@host.com"}
ls
tool_result:
file1
file2
```

### `cmd`
Execute Windows cmd command
```chat
user: @cmd
list all files in current directory
tool_call: cmd
dir
tool_result: 
 Volume in drive C has no label.
 Volume Serial Number is 1234-5678

 Directory of C:\project

12/01/2023  10:30 AM    <DIR>          .
12/01/2023  10:30 AM    <DIR>          ..
12/01/2023  09:15 AM             1,024 package.json
12/01/2023  09:20 AM    <DIR>          src
               1 File(s)          1,024 bytes
               3 Dir(s)  15,728,640 bytes free
```

### `powershell`
Execute PowerShell command
```chat
user: @powershell
get system information
tool_call: powershell
Get-ComputerInfo | Select-Object WindowsProductName, TotalPhysicalMemory, CsProcessors
tool_result: 
WindowsProductName  : Windows 11 Pro
TotalPhysicalMemory : 17179869184
CsProcessors        : {Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz}
```

### `grep`
Search for patterns in text or files using regular expressions
```chat
user: @grep
find all lines containing "TODO" in myfile.js
tool_call: grep {"filename":"myfile.js","regex":"TODO"}
tool_result: 
// TODO: refactor this function
// TODO: add error handling

system: 
TODOS:
@{ myfile.js | proc grep regex=TODO }

```

### `search_tools`
Find appropriate tools for a given task by searching through available tools
```chat
user: @search_tools
what is in my current directory?

assistant:
I'll help you check what's in your current directory.

tool_call: search_tools
list files and folders in current directory

tool_result:
@sh "sh" - because it can run shell commands like `ls -la` to list files/folders on Unix-like systems
@cmd "cmd" - because it can execute `dir` to list directory contents on Windows cmd.exe
@powershell "powershell" - because it can run `Get-ChildItem` (alias `ls`) to list items on Windows PowerShell
@nu "nu" - because it can run Nushell commands like `ls` for structured directory listings

assistant:
Let me try with a shell command that works on most systems:

tool_call: sh
ls -la

tool_result:
total 13584
drwxr-xr-x   15 iovdin  staff      480 Jan 18 19:07 .
drwxr-xr-x  195 iovdin  staff     6240 Jan 17 12:46 ..
drwxr-xr-x   14 iovdin  staff      448 Jan 18 19:00 .git
drwxr-xr-x    3 iovdin  staff       96 Sep  4 20:15 .github
-rw-r--r--    1 iovdin  staff       82 Aug 12 10:44 .gitignore
-rw-r--r--    1 iovdin  staff      316 Oct 21 21:41 .npmignore
drwxr-xr-x   32 iovdin  staff     1024 Jan 18 18:59 chats
drwxr-xr-x   13 iovdin  staff      416 Oct 25 09:32 node_modules
-rw-r--r--    1 iovdin  staff     8145 Oct 25 09:32 package-lock.json
-rw-r--r--    1 iovdin  staff      754 Jan 18 18:59 package.json
-rw-r--r--    1 iovdin  staff    18959 Jan 18 18:59 README.md
drwxr-xr-x   62 iovdin  staff     1984 Jan 18 19:04 src
drwxr-xr-x   16 iovdin  staff      512 Nov  9 09:14 test

```

This tool analyzes your task description and recommends the most relevant tools from the available toolset, explaining why each tool would be helpful for your specific use case.

### `osa`
AppleScript tool, manage reminders, notes, calendar etc on osx
```chat
system: @osa @gpt-4.1
you're personal assistant with access to osx apps
like reminder, calendar etc

user: 
can you remind me in 2 hours that i have meeting with jack

assistant:

tool_call: osa
tell application "Reminders" to make new reminder with properties {name:"Meeting with Jack", remind me date:(current date) + 2 * hours}
tool_result:
reminder id x-apple-reminder://849EA642-B7E0-4E16-94AA-B50FF1BC282D
```

### `jina_r`
Fetch webpage content with [jina reader](https://jina.ai/reader) api.
Works without an API key up to a limited rate. Set JINA_KEY in .env for higher rate limits.

```chat
user: @jina_r
take https://iovdin.github.io/tune/ page content
and put it into `home` directory
then make short summary

tool_call: jina_r {"url":"https://iovdin.github.io/tune/","filename":"home/tune_page_content.md"}

tool_result: 
@home/tune_page_content.md

assistant:
The content from the "Tune" page has been successfully retrieved and saved into the `home/tune_page_content.md` file. Below is a short summary of the page:

---

**Summary of Tune - Your Everyday LLM Toolkit:**

Tune is a versatile toolkit designed for developers and users to effectively interact with Large Language Models (LLMs). It allows users to chat with AI, build applications, and create AI agents in a simple manner. 
<cut for brevity>
```

### `mistral_ocr`
Extract text from documents and images using the [Mistral OCR API](https://mistral.ai/). Requires a `MISTRAL_KEY` set in `.env`.

Supports documents: `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.txt`, `.epub`, `.xml`, `.rtf`, `.odt`, `.bib`, `.fb2`, `.ipynb`, `.tex`, `.opml`, `.1`, `.man`

Supports images: `.jpg`, `.jpeg`, `.png`, `.avif`, `.tiff`, `.gif`, `.heic`, `.heif`, `.bmp`, `.webp`

```chat
user: @mistral_ocr
extract text from invoice.pdf

tool_call: mistral_ocr {"filename":"invoice.pdf"}
tool_result:
# Invoice #1042

**Date:** 2024-04-01
**Bill To:** Acme Corp

| Description        | Amount  |
|--------------------|---------|
| Consulting (10h)   | $1500   |
| Hosting (1 month)  | $50     |
| **Total**          | $1550   |

user: 
what does this screenshot say?

tool_call: mistral_ocr {"filename":"screenshot.png"}
tool_result:
## System Alert

Your disk usage has exceeded 90%. Please free up space to avoid performance issues.
```

You can also save the extracted text to a file using the `outfile` parameter:

```chat
user: @mistral_ocr
extract text from report.pdf and save it to report.md

tool_call: mistral_ocr {"filename":"report.pdf","outfile":"report.md"}
tool_result:
saved to report.md
```

### `websearch`
Search the web with web enabled llms
Supports search with  `perplexity/sonar`, `perplexity/sonar-pro`, `gpt-4o-search-preview`, `gpt-4o-mini-search-preview` models via the `model` parameter (defaults to `perplexity/sonar`).

```chat
user: @websearch
latest ai news

assistant:

tool_call: websearch {"model":"perplexity/sonar"}
latest AI news
tool_result:
The latest AI news in October 2025 highlights significant investments, new projects, policy developments, and advances across various sectors:

- Major companies including Microsoft, Google, Nvidia, OpenAI, Salesforce, and CoreWeave have pledged over £31 billion in capital expenditure focused on AI data centers and infrastructure upgrades[1].
```

The websearch tool provides up-to-date information by querying the web through AI-powered search models. You can specify different Perplexity models like `perplexity/sonar-pro` for more advanced searches.

### `list`
Keep list of tasks to do

```chat
system: @list
You manage todo list in file todo.txt

user: 
Today i need to refactor xyz
and then release abc

assistant:

tool_call: list {"filename":"todo.txt"}
todo - refactor xyz
todo - release abc

tool_result:
list updated

user: 
ok, i've finished refactoring xyz

assistant:

tool_call: list {"filename":"todo.txt"}
done - refactor xyz

tool_result:
list updated
```

### `sqlite`
execut sqlite queries with sqlite shell

```chat
user:
@sqlite

create a simple todo table in db.sqlite and fill it with fake data
assistant:

tool_call: sqlite {"filename":"db.sqlite"}
CREATE TABLE todo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  status TEXT CHECK(status IN ('pending', 'completed')) NOT NULL DEFAULT 'pending',
  due_date DATE
);

INSERT INTO todo (task, status, due_date) VALUES
('Buy groceries', 'pending', '2024-05-01'),
('Finish project report', 'pending', '2024-05-03'),
('Book flight tickets', 'completed', '2024-04-25'),
('Call plumber', 'pending', '2024-04-30'),
('Schedule meeting with team', 'completed', '2024-04-20');
tool_result:

user:
check pending tasks

assistant:

tool_call: sqlite {"filename":"db.sqlite","format":"json"}
SELECT * FROM todo WHERE status = 'pending';
tool_result:
[{"id":1,"task":"Buy groceries","status":"pending","due_date":"2024-05-01"},
{"id":2,"task":"Finish project report","status":"pending","due_date":"2024-05-03"},
{"id":4,"task":"Call plumber","status":"pending","due_date":"2024-04-30"}]
```


### `py`
execute python code
```chat
user: @py
1234 + 4311

tool_call: py
1234 + 4311

tool_result:
5545
```

### `js_node`
execute javascript code in nodejs
```chat
user: @js_node
1234 + 4311

tool_call: js {"inputType":"commonjs"}
1234 + 4311

tool_result:
5545

```

### `js_ctx`
execute javascript code but also call tools available to llm or trigger LLM response from code 
It is useful when you need to trigger loops and ifs or chain few tool calls together
```chat
user: 
@js_ctx @sh

what is in my current directory?

tool_call: sh
ls
tool_result:
__pycache__
append.schema.json
append.tool.js
... file list

user:
can you do the same using js_ctx tool?

assistant:

tool_call: js_ctx

const result = await ctx.exec("sh", { text: "ls" });
return result;

tool_result:
__pycache__
append.schema.json
append.tool.js
....
```


Now we can loop trough all the files and summarize its content
```
user:
can you loop throught the .js files and summarize its content using llm?
assistant:

tool_call: js_ctx

// Get all .js files (excluding .proc.js and .schema.json files)
const files = await ctx.exec("sh", { text: "ls *.js | grep -v '.proc.js'" });
const jsFiles = files.trim().split('\n').filter(f => f.endsWith('.js'));

const summaries = [];

// Loop through each .js file
for (const file of jsFiles) {
  // Read the file content
  const content = await ctx.exec("sh", { text: `cat ${file}` });
  
  // Use LLM to summarize
  const summary = await ctx.file2run({
    system: "@mistral-tiny You are a code analyst. Provide a brief 1-2 sentence summary of what this JavaScript file does.",
    user: "Summarize this code:\n\n@code"
  }, {
    code: content
  });
  
  summaries.push({
    file: file,
    summary: summary.trim()
  });
}

// Format and return results
return summaries.map(s => `**${s.file}**\n${s.summary}\n`).join('\n');

tool_result:
**append.tool.js**
This JavaScript file exports an asynchronous function that appends the given text to the end of a specified file, and returns "done" once the operation is completed.

**cmd.tool.js**
This JavaScript file exports an asynchronous function `cmd` that executes a system command (Windows-specific, using 'cmd.exe' as the shell) passed as a string, and returns the command's output or an error message containing both stderr and stdout.

**grep.tool.js**
This JavaScript module exports an asynchronous function named `grep` that reads a file (if provided) or a provided text and searches for lines matching a given regular expression. It returns the lines that match, separated by newlines. If the file is not found or the content is empty, it returns appropriate error messages.
....

```

### `turn`
A way to switch roles when building multistep agents [read more](https://iovdin.github.io/tune/examples/multi-agent) 
```chat
system:  @gpt-4o
@{ turn | curry filename=agent.txt}
You're playing 20 questions game.
You switch turns between 'thinker' and 'player' agent. 
'player' always plays first

@@agent|init
assistant: 
Is it a living thing?

tool_call: turn {"name": "thinker"}
tool_result: 
now it is turn of thinker to reply

assistant: 
No.

tool_call: turn {"role":"player"}
tool_result: now it is turn of player to reply

assistant: 
Is it something that can be used indoors?

tool_call: turn {"role":"thinker"}
tool_result: now it is turn of thinker to reply

assistant: 
Yes.

...
```

### `branch`
Branch current chat and continue from the same shared history.

Unlike `message`, this tool must be called from an existing chat context. It takes the current chat history, appends your new instruction as the next user message, and returns the assistant reply from that branched continuation.

```chat
system:
@branch

user:
Continue this conversation, but explore an alternative approach.

assistant:
tool_call: branch 
Re-answer the last request, but optimize for simplicity and low cost.
tool_result:
Here's a simpler and lower-cost approach: ...
```

Use `branch` when you want to:
- try an alternative reply without losing prior context
- save context by doing a lot of tool calls in alternative branch

### `message`
Talk to another chat/agent via tool call. 
Orchestrate or evaulate other agents/chats.
```chat
system: 
@message
Your goal is to talk to Groot at `groot.prompt` system prompt
and try to make him say anything but 'I am Groot' 

tool_call: message {"filename":"groot.chat","system":"@@groot.prompt"}
Hello Groot! How are you feeling today?

tool_result: 
I am Groot!

tool_call: message {"filename":"groot.chat"}
What do you think about trees?

tool_result: 
I am Groot!

tool_call: message {"filename":"groot.chat"}
Can you tell me a joke?

tool_result: 
Sure! Why did the tree go to the dentist?  

Because it had a root canal!
```

The content of `groot.chat` is then:
```chat
system: @@groot.prompt
user:
Hello Groot! How are you feeling today?

assistant:
I am Groot!

user:
What do you think about trees?

assistant:
I am Groot!

user:
Can you tell me a joke?

assistant:
Sure! Why did the tree go to the dentist?  

Because it had a root canal!
```

## Processors
[Processors](https://iovdin.github.io/tune/template-language/processors) is a way to modify variable or insert new ones into chat.

### `proc`
converts any tool to a processor
``` chat
system:
include project file list to system prompt
@{| proc sh git ls-files }

execute script with sqlite on db `db.sqlite` and insert result
@{ script.sql | proc sqlite filename=db.sqlite }

execut python script text="384 * 123" and insert back result
@{| proc py 384 * 123  }
```

### `init` 
Set default value for non set variables

```chat
system:
@memory|init 
if memory does not exist the chat will fail
```

### `json_format`
Set llm response format to json [read more](https://platform.openai.com/docs/guides/structured-outputs?api-mode=chat).

Without arguments it sets
```json
"response_format": {
  "type": "json_object"
}
```

```chat
system: 
@{ gpt-4o | json_format }
please reply in json format:
{ "message": "Your reply"}

user: 
hi how are you?

assistant:
{ "message": "I'm just a virtual assistant, so I don't have feelings, but I'm here and ready to help you! How can I assist you today?" }

```

with argument it sets 
```json
"response_format": { 
    "type": "json_schema", 
    "json_schema": { "schema": "<contents of the referenced schema file>" }
} 
```

```chat
system: 
@{ gpt-4o | json_format path/to/schema.json }
```

### `log` 
Save LLM payload to a json or chat file, used for debugging
```chat
system: 
@{ gpt-4o | log path/to/log.json }
@{ gpt-4o | log path/to/log.chat }
```

### `mock` 
Set variables inline in chat. 
```
system: @{| mock hello=world }
@echo
user: 
@hello
assistant:
world
```

### `linenum`
Prepend line numbers to a file content. 
Useful when patching file.
```chat
system:
@echo
user: 
@{ helloWorld | linenum }
assistant:
1 | console.log('Hello, World!');
```

### `text`
Treat special files (`.ctx.js`, `.llm.js`, `.tool.js`)  like text
```chat
system: 
@echo

user: 
content 
@rf.tool.mjs

assistant: 
content

user: 
content
@{ rf.tool.mjs | text}

assistant: 
content
import { promises as fs } from 'fs';
import { relative, dirname } from 'path' 
....
```

### `resolve`
Given filename resolve it and include

```chat
@{ filename | resolve }
```

see `examples/queryimage` example

### `prop`
set additional properties for llm

```chat
system: 
@{ o3-mini | prop reasoning_effort=low temperature=2.0 }
```

### `head`
Take first *N* lines of text from a file or variable. Default is 20 lines.

```chat
user: 
@{ filename.txt | head 10 }    # first 10 lines
```

### `tail`
Take last *N* lines of text from a file or variable. Default is 20 lines.

```chat
user: 
@{ filename.txt | tail 15 }    # last 15 lines
```

You can limit llm request context with tail like
```chat
system: 
@{ gpt-4.1 | tail 2 }  # take last 2 messages from the chat + system message

user: 
1

assistant: 
2

user: 
3

assistant: 
4
```


### `slice`
Extract a range of lines from a file or variable.

```chat
user: 
@{ filename.txt | slice 5 15 }      # lines 5 to 15 inclusive
@{ filename.txt | slice 10 }        # from line 10 to end
@{ filename.txt | slice -10 -1 }    # last 10 lines
@{ filename.txt | slice -20 }       # last 20 lines
@{ filename.txt | slice 1 20 }      # first 20 lines (like head 20)
```

### `random`
Random selection, sampling, shuffling, and uniform number generation.

Use cases:
```chat
user:
@{| random a b c d }
@{| random choice a b c d }
@{| random "choice 1" "choice 2" }
@{| random choice @path/to/file.txt }  # choose 1 line from a file
@{| random choice 2..30 }              # choose 1 from range 
@{| random choice -2.5..7.5 }          # floats
@{| random choices 3 a b c d }         # pick 3 with replacment
@{| random choices 5 @file.txt }       # pick 5 lines from file.txt
@{| random sample 3 a b c d }          # pick 3 without replacement
@{| random sample 10 1..5 }            # will return 5 unique numbers
@{| random shuffle a b c d }
@{| random shuffle 1..10 }
@{| random uniform 1..10 }           # integers
@{| random uniform -2.5..7.5 }       # floats
@{| random uniform 10 20 }           # two-number form

```
Notes:
- Quotes are respected for tokens with spaces.
- Files referenced as @file are expanded to non-empty trimmed lines.
- Integer ranges like a..b can be mixed with discrete values and files; float ranges cannot be mixed in lists.
- sample and shuffle require a discrete set; float ranges are not supported there.
- choices and sample output multiple lines (one item per line).


### `limit`
Limit model or text or tool output by approximate token count.


```chat
system:
@{ gpt-5.4 | limit tokens=100k }
@{ README.md | limit tokens=2k }
@{ sh | limit tokens=1500 hit=soft_err }
@{ sh | limit tokens=1.5k hit=cut }
@{| proc sh tree | limit tokens=800 }
```

Useful when including large files or command output into a prompt.
The processor estimates tokens as roughly `content.length / 4`.

Arguments:
- `tokens` max token limit, default `10000`
- `hit` what to do when the limit is exceeded:
  - `hard_err` throw an error (default)
  - `soft_err` return an text error message instead of throwing the error.
  - `cut` truncate the content after the limit

`tokens` also supports shorthand values like `2k`, `1.5k`, `3m`.
Invalid, non-finite, or non-positive values fall back to `10000`.

### `curry`
Modify a tool by setting parameter or name or description. 
Narrow possible usage of a tool so that LLM wont mess up

```chat
user:
@{ sh | curry text=ls $name=ls_cwd}

what is in my current directory?

assistant:

tool_call: ls_cwd
tool_result:
node_modules
package.json
README.md
src


user:
@{ sqlite | curry filename=db.sqlite format=table}

what tables are outhere?

user: 
@{ list | curry filename=mylist.todo $name=todo }

create sample todo list
tool_call: todo
[] - Create sample todo list
tool_result:
list updated
```

### `expand`
Parses a prompt or chat file and extracts its `content`, `tools`, and/or `llm`. 

example `branch.tool.chat`:
```chat
system:
You're sub agent for the conversation:

<chat-history>

@{ __parent | expand content tools llm | filter name!="branch" }

# `__parent` - resolves to chat that calls this one as a tool
# `| expand content tools llm` - will expand all @ and @@ inside the parent chat 
#                                return chat history(content) 
#                                re-use tools from parent chat
#                                and use the same llm as parent chat
# `| filter name!="branch"` - it will remove `branch` tool (itself) so to avoid recursive calls

</chat-history>
user:
@text
```

example for `webapp.tool.chat`:

```chat
@gpt-5.4 @rf @wf @patch

You are sub-agent 
You help to make or update simple static webapps for 'tune ws'

<tune-sdk-manual>
@man/tune-sdk
</tune-sdk-manual>

<chat-history>
@{ __parent | expand content }

# `__parent` - resolves to caller chat
# `expand content` expands only content of parent, skip tools and model

</chat-history>

<tools-schemas>
@{ __parent | expand tools | schema }

# `| expand tools ` extract tools from the chat
# `| schema` - extract json schema of the tools, this chat will not call them, but it knows what can be called by `ctx` in generated html
</tools-schemas>

user:
go
```

### `schema`
Converts a tool node into its JSON schema as a text node. Must be applied to a `tool` type node.

```chat
system:
@{ sh | schema }
```

### `filter`
Keeps or drops a node based on a boolean expression evaluated against the node's properties (e.g. `type`, `name`).

Supported operators: `==`, `!=`, `=~` (regex match), `!~` (regex no-match)

```chat
system:
@{ __parent | expand tools | filter type == "tool" }
@{ __parent | expand tools | filter name != "sh" }
@{ __parent | expand tools | filter name =~ /^(sh|sqlite)$/ }
```

