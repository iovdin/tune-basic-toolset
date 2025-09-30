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
  - [sh](#sh) execute shell command
  - [cmd](#cmd) execute Windows cmd command
  - [powershell](#powershell) execute PowerShell command
  - [osa](#osa) manage reminders/notes/calendar (AppleScript/macOS)
  - [jina_r](#jina_r) fetch webpage content
  - [list](#list) keep list of tasks todo (loops for LLM)
  - [sqlite](#sqlite) execute sqlite queries 
  - [py](#py) run python code
  - [js](#js) run javascript code
  - [turn](#turn) handoff based agent (shared context)
  - [message](#message) talk to another chat/agent (separate context)
- [Processors](#processors)
  - [proc](#proc) converts tool to processor
  - [shp](#shp) include shell command output
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
Execute shell command
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

### `js`
execute javascript code
```chat
user: @js
1234 + 4311

tool_call: js {"inputType":"commonjs"}
1234 + 4311

tool_result:
5545

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

### `shp`
Insert shell command output
```chat
system:
include project file list to system prompt
@{| shp git ls-files }

include buffer content on osx
@{| shp pbpaste }

include current date
@{| shp date }

pipe filename content to shell command
@{ a.log | shp tail }

@{ a.log | shp grep pattern }

print screen of one of tmux session
@{| shp tmux capture-pane -t 0 -p }

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

