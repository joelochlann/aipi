import { Input } from 'https://deno.land/x/cliffy@v1.0.0-rc.3/prompt/input.ts';
import { crawl } from './lib.ts';
import OpenAI from 'npm:openai';
import { ChatCompletionMessageParam } from 'npm:openai/resources/chat';
import { authFromUserInput } from './auth.ts';
import { _TextDecoder } from 'https://deno.land/std@0.151.0/node/_utils.ts';

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

// const apiName = await Input.prompt("API name: ");

// // If file exists at cache/${apiName}, read variables from there
// // Otherwise, prompt user for variables and write to cache/${apiName}
// const cacheDir = 'cache';
// const cachePath = `${cacheDir}/${apiName}.json`;

// let cached;
// try {
//   const cached = await Deno.readTextFile(cachePath);
// } catch (e) {
//   console.error(`No cache file found at ${cachePath}`);
// }

const documentationRootPage = (
	await Input.prompt('Documentation root page: ')
).trim();
if (!documentationRootPage) {
	console.error('No documentation root page provided');
	Deno.exit(1);
}
const documentationBoundingPath = (
	await Input.prompt('Documentation bounding path: ')
).trim();
const documentationPages = await crawl(
	documentationRootPage,
	documentationBoundingPath,
);
console.error(`Got ${documentationPages.size} pages`);

// if (prompt('Show docs? (Y/N)') === 'Y') {
// 	console.dir(documentationPages);
// }

// if (prompt('Continue? (Y/N)') !== 'Y') {
// 	Deno.exit(0);
// }
const auth = await authFromUserInput();

while (true) {
	const query = await Input.prompt('What do you want to do with the API? ');

	const requestType = `type Request = {
  /**
   * A string to set request's URL.
   * Any GET parameters must be encoded in the URL as query parameters.
   */
  url: string;

  /**
   * A string to set request's method.
   */
  method: string;

  /**
   * An optional object to set request's body.
   * This should only be used for POST requests.
   */
  body?: string;
}`;

	const systemPrompt: ChatCompletionMessageParam = {
		role: 'system',
		content:
			'You are a helpful assistant that helps developers query unfamiliar APIs. You will receive the documentation to an API, enclosed in triple quotes ("""). Each page of documentation will be separated by the line =======. Your job is to translate user queries in human language into queries for the API. You must return only valid JSON. Do not wrap the JSON in any other text. Do not wrap the JSON in a ```json``` code fence.',
	};

	const userPromptMessage: string = [
		`You will receive the documentation to an API, enclosed in triple quotes ("""). Each page of documentation will be separated by the line =======. Your job is to translate user queries in human language into queries for the API. Here is the documentation: \n"""\n${Array.from(
			documentationPages,
		).join('/n=======/n')}\n"""`,
		`Please provide the API call as a JSON object matching the following type: ${requestType}. Do not wrap the object in any other text. Do not wrap the object in a \`\`\`json\`\`\` code fence.`,
		`Here is the user query: "${query}"`,
	].join('\n');

	// console.log(userPromptMessage);

	const userPrompt: ChatCompletionMessageParam = {
		role: 'user',
		content: userPromptMessage,
	};

	const chatCompletion = await openai.chat.completions.create({
		messages: [systemPrompt, userPrompt],
		model: 'gpt-4-1106-preview',
	});

	const response = chatCompletion.choices[0].message.content;
	console.error('Response: ');
	console.dir(response);

	if (!response) {
		console.log('Response empty, exiting');
		Deno.exit(0);
	}

	if (prompt('Continue? (Y/N)') !== 'Y') {
		Deno.exit(0);
	}

	const requestData = JSON.parse(response);

	let requestInit: RequestInit = {
		method: requestData.method,
		body: requestData.body,
	};
	let url = new URL(requestData.url);
	if (auth?.headers) {
		requestInit = {
			...requestInit,
			headers: auth.headers,
		};
	} else if (auth?.queryParameters) {
		url.searchParams.append(
			auth.queryParameters.name,
			auth.queryParameters.value,
		);
	}

	console.log('Request init: ');
	console.dir(requestInit);

	const resp = await fetch(url, requestInit);
	const json = await resp.json();
	console.log('Response JSON: ');
	console.dir(json);
}
