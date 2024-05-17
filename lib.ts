import { distinct } from 'https://deno.land/std@0.171.0/collections/distinct.ts';
import {
	DOMParser,
	Element,
	HTMLDocument,
} from 'https://deno.land/x/deno_dom@v0.1.43/deno-dom-wasm.ts';
import TurndownService from 'npm:turndown';

const turndownService = new TurndownService();

export async function crawl(
	startUrl: string,
	boundingPath?: string | null,
): Promise<Set<string>> {
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
		// console.log(`${currentUrl} added to visited set`);
		visited.add(currentUrl);

		// Get links and add unvisited to stack
		// console.log(`Crawling ${currentUrl} for URLs`);
		const resp = await fetch(currentUrl);
		const htmlString = await resp.text();
		const document = new DOMParser().parseFromString(htmlString, 'text/html');
		if (document) {
			const main = document.querySelector('.main');
			if (main) {
				const markdown = turndownService.turndown(main.innerHTML);
				// console.log(markdown);
				pageContents.add(markdown);
			} else {
				// console.log('========');
				// console.log(currentUrl);
				// console.log('MARKDOWN');
				const markdown = turndownService.turndown(document.body.innerHTML);
				// console.log(markdown);
				pageContents.add(markdown);
			}
			for (const url of getOnwardUrls(document, currentUrl)) {
				if (
					!visited.has(url) &&
					(!boundingPath || url.includes(boundingPath)) &&
					!stack.includes(url)
				) {
					// console.log(`Adding ${url} to stack`);
					stack.push(url);
				}
			}
		}
	}

	return pageContents;
}

function getOnwardUrls(document: HTMLDocument, baseUrl: string): string[] {
	const anchorElements = [...document.querySelectorAll('a')] as Element[];

	// console.log(`${anchorElements.length} anchor elements on page`);
	const urls: string[] = anchorElements
		.map((anchorElement) => {
			const href = anchorElement.getAttribute('href');
			if (href) {
				// Second argument gets ignored if href is an absolute path
				// console.log('href', href);
				const url = new URL(href, baseUrl);
				// console.log('url', url.toString());
				url.search = '';
				url.hash = '';
				// console.log(`Stripped URL: ${url.toString()}`);
				return url.toString();
			} else {
				// console.error("No href on anchor element");
				return null;
			}
		})
		.filter(notEmpty);

	// console.log(`${urls.length} of which had hrefs`);

	const distinctUrls = distinct(urls);

	// console.log(`${distinctUrls.length} of which were distinct (after stripping hash and query string)`);

	return distinctUrls;
}

export async function anthropic(prompt: string, apiKey: string) {
	const claudePrompt = `\n\nHuman: ${prompt}\n\nAssistant:`;
	const data = {
		prompt: claudePrompt,
		model: 'claude-v1-100k',
		// A maximum number of tokens to generate before stopping.
		max_tokens_to_sample: 300,
		stop_sequences: ['\n\nHuman:'],
	};
	const options = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey
		},
		body: JSON.stringify(data),
	};

	try {
		console.log('Prompt: ', prompt);
		console.log('fetching Anthropic completion...');
		const resp = await fetch('https://api.anthropic.com/v1/complete', options);
		const json = await resp.json();

		// TODO: handle non-200 response
		if (resp.status !== 200) {
			console.error(`Got ${resp.status} from Anthropic`);
			return { success: false, error: json };
		}
		return { success: true, data: json.completion };
	} catch (err) {
		// TODO: surface error in UI
		console.error('Error getting completion: ', err);
		return { success: false, error: err };
	}
}

export function notEmpty<TValue>(
	value: TValue | null | undefined,
): value is TValue {
	if (value === null || value === undefined) return false;
	return true;
}
