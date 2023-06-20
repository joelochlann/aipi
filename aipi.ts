import { DOMParser, Element, HTMLDocument } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import { distinct } from "https://deno.land/std@0.171.0/collections/distinct.ts";

// const startPage = prompt("Page to start from: ");
// const baseURL = prompt("Bounding URL: ");


function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  if (value === null || value === undefined) return false;
  return true;
}

async function anthropic(prompt: string) {
  const claudePrompt = `\n\nHuman: ${prompt}\n\nAssistant:`;
  const data = {
    prompt: claudePrompt,
    model: "claude-v1-100k",
    // A maximum number of tokens to generate before stopping.
    max_tokens_to_sample: 300,
    stop_sequences: ["\n\nHuman:"],
  };
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key":
        "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",
    },
    body: JSON.stringify(data),
  };

  try {
    console.log("Prompt: ", prompt);
    console.log("fetching Anthropic completion...");
    const resp = await fetch("https://api.anthropic.com/v1/complete", options);
    const json = await resp.json();

    // TODO: handle non-200 response
    if (resp.status !== 200) {
      console.error(`Got ${resp.status} from Anthropic`);
      return { success: false, error: json };
    }
    return { success: true, data: json.completion };
  } catch (err) {
    // TODO: surface error in UI
    console.error("Error getting completion: ", err);
    return { success: false, error: err };
  }
}

// async function crawl(startUrl: URL, allUrls: URL[]): Promise<URL[]> {
    // visited[startUrl.href] = true;
    // console.log(`Crawling ${startUrl.href} for URLs`);
    // const start = await fetch(startUrl);
    // const startHtmlString = await start.text();
    // const document = new DOMParser().parseFromString(startHtmlString, "text/html");

    // if (document) {
    //     const urls = getOnwardUrls(document, startUrl)
    //         .filter(u => !visited[u.href]);

    //     console.log(`Got ${urls.length} URLs, iterating...`);
    //     for (const url of urls) {
    //         const newUrls = await crawl(url, [url, ...allUrls]);
    //         // return newUrls;
    //         allUrls = [...newUrls, ...allUrls];
    //     }
    // }

    // return distinct(allUrls);
// }

async function crawl(startUrl: string, boundingPath?: string): Promise<Set<string>> {
    const stack = [startUrl];
    const visited: Set<string> = new Set();
    const pageContents: Set<string> = new Set();

    while (stack.length) {
        const currentUrl = stack.pop();
        if (!currentUrl) {
            // Should never happen because of while (stack.length)
            return visited;
        }

        // TODO: edge case. fetch error
        console.log(`${currentUrl} added to visited set`);
        visited.add(currentUrl);

        // Get links and add unvisited to stack
        console.log(`Crawling ${currentUrl} for URLs`);
        const resp = await fetch(currentUrl);
        const htmlString = await resp.text();
        const document = new DOMParser().parseFromString(htmlString, "text/html");
        if (document) {
            for (const url of getOnwardUrls(document, currentUrl)) {
                if (!visited.has(url) && (!boundingPath || url.includes(boundingPath)) && !stack.includes(url)) {
                    console.log(`Adding ${url} to stack`);
                    stack.push(url);

                    const main = document.querySelector('.main')
                    if (main) {
                        pageContents.add(main.innerText);
                    } else {
                        pageContents.add(document.body.innerText);
                    }
                }
            }
        }
    }

    return pageContents;
}

function getOnwardUrls(document: HTMLDocument, baseUrl: string): string[] {
    const anchorElements = [...document.querySelectorAll("a")] as Element[];

    console.log(`${anchorElements.length} anchor elements on page`);
    const urls: string[] = anchorElements
        .map(anchorElement => {
            const href = anchorElement.getAttribute("href");
            if (href) {
                // Second argument gets ignored if href is an absolute path
                const url = new URL(href, baseUrl);
                url.search = '';
                url.hash = '';
                return url.toString();
            } else {
                // console.error("No href on anchor element");
                return null;
            }
        })
        .filter(notEmpty)
    
    console.log(`${urls.length} of which had hrefs`);
    
    const distinctUrls = distinct(urls);
    
    console.log(`${distinctUrls.length} of which were distinct (after stripping hash and query string)`);

    return distinctUrls;
}

const pages = await crawl(
    "https://developer-specs.company-information.service.gov.uk/guides/index",
    "https://developer-specs.company-information.service.gov.uk"
);
console.log('===========================');
console.log('FINISHED!!!!!');
console.log(`Got ${pages.size} pages`);
console.log('===========================');


const prompt = `You will receive the documentation to an API, enclosed in triple quotes ("""). Each page of documentation will be separated by the line =======. Your job is to translate user queries in human language into queries for the API. Here is the documentation: \n"""\n${Array.from(pages).join("/n=======/n")}\n"""\n. Here is the user query: which companies is Jacob Rees-Mogg an officer of?`;
const completion = await anthropic(prompt);
console.log(completion.data);