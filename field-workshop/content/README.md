# Where to edit the text you see

| Web page | File |
| --- | --- |
| Home (`/#home`) | `home.json` |
| Challenge 1 (`/#challenge-1`) | `challenge-1.json` |
| Challenge 2–4 | The matching `challenge-N.json` |
| Storefront (`/storefront`) | `storefront.json` |
| Network Faults (`localhost:8089`, all tabs) | `network-faults.json` |
| Commands (`/tools`) | `tools.json` |

Each JSON belongs to that page. Text is written out in full. There are no shared fragments to look up elsewhere. Repeated labels are intentionally duplicated so each page can be edited independently.

## Challenge pages

The fields follow the page's content:

| JSON field | Where it appears |
| --- | --- |
| `pageTitle` | Browser tab title |
| `title`, `level`, `scenario` | Challenge heading and customer problem |
| `why`, `reproduce`, `assignment` | Brief and assignment question |
| `ready` | “Before you start” |
| `tasks[].title`, `tasks[].instruction` | All five tasks under “Your tasks”, visible on the challenge page |
| `mitigationHelp` | Extra guidance in task 4, when provided |
| `done[]` | “You are finished when…” |
| `fields[].label`, `fields[].prompt` | Labels and instructions above the answer boxes |
| `solution[]` | Example solution, revealed after submitting notes |
| `text` | Headings, buttons, links and status messages on this page |
| `navigation` | Header and sidebar labels on this page |
| `validation` | Submission error messages |

Keep `id`, `number` and `fields[].key` unchanged so saved answers still work.

## Home and other pages

`home.json` contains the general expandable experiment `guide`, `challengeSummaries`, Home `text`, and its `navigation`. Editing a Home summary does not change a challenge's instructions. `exportTitle` is the title in downloaded notes.

The other page files group their visible labels, results and messages into sections. For example, `storefront.json` has `storefrontPage` for its header, `catalog` for the catalog UI, `storefront` for result text, and `api` for product names and server messages. `network-faults.json` includes all three tabs and their error messages. `tools.json` contains the command reference.

Single-brace placeholders such as `{number}`, `{milliseconds}` and `{label}` insert live values; keep these intact. `pageTitle` and `javascriptRequired` supply the browser tab title and the message shown when JavaScript is disabled.

After editing, rebuild/restart the Docker stack and refresh the browser. Editing a host file does not update an already running container.
